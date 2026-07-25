import { parseHeartRateMeasurement, type HeartRateSample } from '../heartRateParser';

/**
 * Vecteurs dérivés à la main depuis la spec BLE 0x2A37 (le doc protocole OXV
 * étant absent). Chaque octet est commenté. Octet 0 = flags ; les entiers
 * multi-octets (HR 16 bits, energy, R-R) sont LITTLE-ENDIAN.
 *
 * Rappel flags : bit0 = HR 16 bits, bits1-2 = contact, bit3 = energy, bit4 = R-R.
 */

describe('parseHeartRateMeasurement — format HR', () => {
  it('HR 8 bits, aucun flag → contact "unsupported", pas de R-R', () => {
    // flags = 0x00 (tout à zéro) ; HR = 0x3C = 60 bpm.
    const bytes = new Uint8Array([0x00, 0x3c]);
    expect(parseHeartRateMeasurement(bytes)).toEqual<HeartRateSample>({
      hrBpm: 60,
      contact: 'unsupported',
      rrMs: [],
    });
  });

  it('HR 16 bits little-endian (valeur > 255)', () => {
    // flags = 0x01 (bit0 posé => HR sur 16 bits) ; HR = 0x012C = 300 bpm,
    // encodé LE => [0x2C, 0x01].
    const bytes = new Uint8Array([0x01, 0x2c, 0x01]);
    const out = parseHeartRateMeasurement(bytes);
    expect(out).not.toBeNull();
    expect(out?.hrBpm).toBe(300);
    expect(out?.rrMs).toEqual([]);
  });
});

describe('parseHeartRateMeasurement — état du contact', () => {
  it('bits contact == 3 → "ok"', () => {
    // flags = 0b0000_0110 = 0x06 (bits1-2 = 11 = 3) ; HR = 0x4B = 75.
    const out = parseHeartRateMeasurement(new Uint8Array([0x06, 0x4b]));
    expect(out?.contact).toBe('ok');
    expect(out?.hrBpm).toBe(75);
  });

  it('bits contact == 2 → "poor" (électrodes non détectées)', () => {
    // flags = 0b0000_0100 = 0x04 (bits1-2 = 10 = 2) ; HR = 0x4B = 75.
    const out = parseHeartRateMeasurement(new Uint8Array([0x04, 0x4b]));
    expect(out?.contact).toBe('poor');
  });

  it('bits contact == 1 → "unsupported"', () => {
    // flags = 0b0000_0010 = 0x02 (bits1-2 = 01 = 1) ; HR = 0x4B = 75.
    const out = parseHeartRateMeasurement(new Uint8Array([0x02, 0x4b]));
    expect(out?.contact).toBe('unsupported');
  });
});

describe('parseHeartRateMeasurement — energy expended', () => {
  it("saute les 2 octets d'energy et lit le R-R au bon offset", () => {
    // flags = 0b0001_1000 = 0x18 (bit3 energy + bit4 R-R) ; HR 8 bits.
    //   [0]=flags 0x18
    //   [1]=HR 0x46 = 70
    //   [2..3]=energy 0x03E8 = 1000 LE => [0xE8, 0x03]  (DOIT être ignoré)
    //   [4..5]=R-R 0x0400 = 1024 LE => [0x00, 0x04] => 1024*1000/1024 = 1000 ms
    const bytes = new Uint8Array([0x18, 0x46, 0xe8, 0x03, 0x00, 0x04]);
    const out = parseHeartRateMeasurement(bytes);
    expect(out?.hrBpm).toBe(70);
    expect(out?.rrMs).toEqual([1000]); // preuve que l'offset R-R est APRÈS le skip
  });

  it('même trame SANS le flag energy décale le R-R (contrôle négatif)', () => {
    // flags = 0x10 (R-R seul, pas d'energy). Les octets 0xE8 0x03 deviennent
    // alors le PREMIER R-R = 0x03E8 = 1000 => 1000*1000/1024 ≈ 976.5625 ms,
    // et 0x0400 = 1024 => 1000 ms. Démontre que l'octet 0x18 ci-dessus a bien
    // provoqué un saut, pas un simple hasard.
    const bytes = new Uint8Array([0x10, 0x46, 0xe8, 0x03, 0x00, 0x04]);
    const out = parseHeartRateMeasurement(bytes);
    expect(out?.rrMs).toHaveLength(2);
    expect(out?.rrMs[0]).toBeCloseTo(976.5625, 6);
    expect(out?.rrMs[1]).toBe(1000);
  });
});

describe('parseHeartRateMeasurement — intervalles R-R et conversion', () => {
  it('un seul R-R : 512 (1/1024 s) → 500 ms exact', () => {
    // flags = 0x10 (R-R) ; HR = 0x50 = 80 ; R-R = 0x0200 = 512 LE => [0x00, 0x02].
    // 512 * 1000 / 1024 = 500.
    const bytes = new Uint8Array([0x10, 0x50, 0x00, 0x02]);
    const out = parseHeartRateMeasurement(bytes);
    expect(out?.rrMs).toEqual([500]);
  });

  it('plusieurs R-R : 1024 → 1000 ms, 512 → 500 ms', () => {
    // flags = 0x10 ; HR = 80 ; R-R #1 = 1024 [0x00,0x04], #2 = 512 [0x00,0x02].
    const bytes = new Uint8Array([0x10, 0x50, 0x00, 0x04, 0x00, 0x02]);
    const out = parseHeartRateMeasurement(bytes);
    expect(out?.rrMs).toEqual([1000, 500]);
  });

  it("conserve la précision flottante (pas d'arrondi) : 300 → 292.96875 ms", () => {
    // flags = 0x10 ; HR = 80 ; R-R = 0x012C = 300 LE => [0x2C, 0x01].
    // 300 * 1000 / 1024 = 292.96875 (valeur exacte représentable en double).
    const bytes = new Uint8Array([0x10, 0x50, 0x2c, 0x01]);
    const out = parseHeartRateMeasurement(bytes);
    expect(out?.rrMs).toHaveLength(1);
    expect(out?.rrMs[0]).toBe(292.96875);
  });

  it('flag R-R posé mais aucun octet restant → tableau vide (honnête, pas null)', () => {
    // flags = 0x10 ; HR 8 bits ; rien après => 0 intervalle, reste pair (0).
    const out = parseHeartRateMeasurement(new Uint8Array([0x10, 0x50]));
    expect(out?.rrMs).toEqual([]);
  });
});

describe('parseHeartRateMeasurement — trames malformées → null', () => {
  it('buffer vide → null', () => {
    expect(parseHeartRateMeasurement(new Uint8Array([]))).toBeNull();
  });

  it('flags seul (1 octet, pas de HR) → null', () => {
    expect(parseHeartRateMeasurement(new Uint8Array([0x00]))).toBeNull();
  });

  it('HR 16 bits annoncé mais < 3 octets → null', () => {
    // flags = 0x01 (16 bits) mais un seul octet de HR fourni.
    expect(parseHeartRateMeasurement(new Uint8Array([0x01, 0x2c]))).toBeNull();
  });

  it('energy annoncé mais tronqué → null', () => {
    // flags = 0x08 (energy) ; HR = 0x50 ; un seul octet d'energy au lieu de 2.
    expect(parseHeartRateMeasurement(new Uint8Array([0x08, 0x50, 0xe8]))).toBeNull();
  });

  it('R-R tronqué (octet impair restant) → null', () => {
    // flags = 0x10 (R-R) ; HR = 0x50 ; un seul octet de R-R au lieu de 2.
    expect(parseHeartRateMeasurement(new Uint8Array([0x10, 0x50, 0x00]))).toBeNull();
  });

  it('entrée non-Uint8Array → null (garde défensive runtime)', () => {
    // Cast volontaire : simule un appel JS non typé passant un tableau nu.
    expect(parseHeartRateMeasurement([0x00, 0x3c] as unknown as Uint8Array)).toBeNull();
  });
});
