/**
 * Tests unitaires du parser UBX RaceBox Mini S.
 *
 * Couvre : checksum Fletcher-8, validation de trame complète, décodage
 * d'un payload de référence, et reconstruction depuis un flux fragmenté
 * (cas réel BLE : les chunks ne sont pas alignés sur les trames).
 *
 * On ne dépend pas de fichiers .ubx réels — les trames sont synthétisées
 * dans le test pour rester déterministe et auto-suffisant. Quand une
 * vraie fixture sera disponible (Q5), un test supplémentaire de
 * compte-de-frames pourra être ajouté ici.
 */

import {
  computeChecksum,
  isChecksumValid,
  isRaceBoxDataMessage,
  parseRaceBoxDataMessage,
  UbxFrameBuffer,
} from '../parser';
import { GpsFix, RACEBOX_PROTOCOL } from '@/types/telemetry';

/** Construit une trame RaceBox Data valide (88 octets) avec checksum correct. */
function buildValidFrame(payloadFiller?: (dv: DataView) => void): Uint8Array {
  const payloadLength = RACEBOX_PROTOCOL.RACEBOX_DATA_PAYLOAD_SIZE; // 80
  const frame = new Uint8Array(RACEBOX_PROTOCOL.RACEBOX_DATA_TOTAL_SIZE); // 88

  frame[0] = RACEBOX_PROTOCOL.UBX_SYNC_1;
  frame[1] = RACEBOX_PROTOCOL.UBX_SYNC_2;
  frame[2] = RACEBOX_PROTOCOL.RACEBOX_CLASS;
  frame[3] = RACEBOX_PROTOCOL.RACEBOX_DATA_ID;
  frame[4] = payloadLength & 0xff;
  frame[5] = (payloadLength >> 8) & 0xff;

  if (payloadFiller) {
    // Le DataView pointe sur la zone payload (offset 6, len 80).
    const dv = new DataView(frame.buffer, 6, payloadLength);
    payloadFiller(dv);
  }

  // Checksum Fletcher-8 sur octets 2..(2+4+payloadLength-1) inclus.
  let ckA = 0;
  let ckB = 0;
  for (let i = 2; i < 6 + payloadLength; i++) {
    ckA = (ckA + frame[i]) & 0xff;
    ckB = (ckB + ckA) & 0xff;
  }
  frame[86] = ckA;
  frame[87] = ckB;

  return frame;
}

describe('computeChecksum', () => {
  it('matches the checksum embedded in a freshly built frame', () => {
    const frame = buildValidFrame();
    const { ckA, ckB } = computeChecksum(frame);
    expect(ckA).toBe(frame[86]);
    expect(ckB).toBe(frame[87]);
  });

  it('is sensitive to a single-bit flip in the payload', () => {
    const frame = buildValidFrame();
    const before = computeChecksum(frame);
    frame[20] ^= 0x01;
    const after = computeChecksum(frame);
    expect(after).not.toEqual(before);
  });
});

describe('isChecksumValid', () => {
  it('returns true on a valid frame', () => {
    expect(isChecksumValid(buildValidFrame())).toBe(true);
  });

  it('returns false when the embedded checksum is corrupt', () => {
    const frame = buildValidFrame();
    frame[86] = (frame[86] + 1) & 0xff;
    expect(isChecksumValid(frame)).toBe(false);
  });

  it('returns false on a frame too short to contain a checksum', () => {
    expect(isChecksumValid(new Uint8Array(4))).toBe(false);
  });
});

describe('isRaceBoxDataMessage', () => {
  it('accepts a well-formed RaceBox data frame', () => {
    expect(isRaceBoxDataMessage(buildValidFrame())).toBe(true);
  });

  it('rejects a frame of the wrong total size', () => {
    expect(isRaceBoxDataMessage(new Uint8Array(50))).toBe(false);
    expect(isRaceBoxDataMessage(new Uint8Array(128))).toBe(false);
  });

  it('rejects a frame missing the UBX sync bytes', () => {
    const f = buildValidFrame();
    f[0] = 0x00;
    expect(isRaceBoxDataMessage(f)).toBe(false);
  });

  it('rejects a frame with an unexpected class or message ID', () => {
    const wrongClass = buildValidFrame();
    wrongClass[2] = 0x01;
    expect(isRaceBoxDataMessage(wrongClass)).toBe(false);

    const wrongId = buildValidFrame();
    wrongId[3] = 0x02;
    expect(isRaceBoxDataMessage(wrongId)).toBe(false);
  });

  it('rejects a frame with a corrupt checksum', () => {
    const f = buildValidFrame();
    f[86] = (f[86] + 1) & 0xff;
    expect(isRaceBoxDataMessage(f)).toBe(false);
  });
});

describe('parseRaceBoxDataMessage', () => {
  it('returns null for an invalid frame', () => {
    expect(parseRaceBoxDataMessage(new Uint8Array(88))).toBeNull();
  });

  it('decodes a payload with known values', () => {
    // Latitude 45.6004, longitude -0.1410 (finish line Beltoise).
    // Altitude 50 m. Speed 100 km/h. Heading 270°. Sat 12. Fix 3D.
    // gForce X=0.5g Y=-0.2g Z=1.0g.
    const lat = Math.round(45.6004 * 1e7);
    const lon = Math.round(-0.141 * 1e7);
    const altMm = 50_000; // 50 m → 50000 mm
    const speedMmS = Math.round((100 * 1000) / 3.6); // 100 km/h → ~27778 mm/s
    const headingDeg5 = Math.round(270 * 1e5);

    const frame = buildValidFrame((dv) => {
      // Le DataView a un offset 0 = début payload (octet 6 de la trame),
      // donc les offsets ci-dessous sont (parser.ts offset - 6).
      dv.setUint8(0, 0); // version
      dv.setUint16(4, 2026, true); // year (offset 4)
      dv.setUint8(6, 5); // month
      dv.setUint8(7, 24); // day
      dv.setUint8(20, GpsFix.Fix3D); // fix status (offset 20 → trame offset 26)
      dv.setUint8(23, 12); // satellites (offset 23 → trame offset 29)
      dv.setInt32(24, lon, true); // longitude (offset 24 → trame 30)
      dv.setInt32(28, lat, true); // latitude (offset 28 → trame 34)
      dv.setInt32(36, altMm, true); // altitude (offset 36 → trame 42)
      dv.setUint32(40, 5_000, true); // accuracy 5 m
      dv.setUint32(48, speedMmS, true); // speed
      dv.setUint32(52, headingDeg5, true); // heading
      dv.setUint8(67, 75); // battery 75% (offset 67 → trame 73)
      dv.setInt16(68, 500, true); // gForceX = 0.5 g
      dv.setInt16(70, -200, true); // gForceY = -0.2 g
      dv.setInt16(72, 1000, true); // gForceZ = 1.0 g
    });

    const data = parseRaceBoxDataMessage(frame);
    expect(data).not.toBeNull();
    expect(data!.gps.latitude).toBeCloseTo(45.6004, 4);
    expect(data!.gps.longitude).toBeCloseTo(-0.141, 4);
    expect(data!.gps.altitude).toBeCloseTo(50, 1);
    expect(data!.gps.satellites).toBe(12);
    expect(data!.gps.fix).toBe(GpsFix.Fix3D);
    expect(data!.motion.speed).toBeCloseTo(100, 0);
    expect(data!.motion.heading).toBeCloseTo(270, 1);
    expect(data!.imu.gForceX).toBeCloseTo(0.5, 2);
    expect(data!.imu.gForceY).toBeCloseTo(-0.2, 2);
    expect(data!.imu.gForceZ).toBeCloseTo(1.0, 2);
    expect(data!.battery.level).toBe(75);
    expect(data!.battery.isCharging).toBe(false);
  });
});

describe('UbxFrameBuffer', () => {
  it('extracts a single complete frame from one chunk', () => {
    const buf = new UbxFrameBuffer();
    const frames = buf.push(buildValidFrame());
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(RACEBOX_PROTOCOL.RACEBOX_DATA_TOTAL_SIZE);
  });

  it('skips garbage bytes before the first valid frame', () => {
    const buf = new UbxFrameBuffer();
    const garbage = new Uint8Array([0x12, 0x34, 0xff, 0xab, 0xb5]); // un 0xB5 piège
    const valid = buildValidFrame();
    const combined = new Uint8Array(garbage.length + valid.length);
    combined.set(garbage, 0);
    combined.set(valid, garbage.length);

    const frames = buf.push(combined);
    expect(frames).toHaveLength(1);
  });

  it('reassembles a frame split across multiple BLE chunks', () => {
    const buf = new UbxFrameBuffer();
    const frame = buildValidFrame();

    // Push en 3 morceaux comme le ferait un transport BLE 20-byte MTU.
    expect(buf.push(frame.slice(0, 20))).toEqual([]);
    expect(buf.push(frame.slice(20, 60))).toEqual([]);
    const out = buf.push(frame.slice(60));

    expect(out).toHaveLength(1);
    expect(Array.from(out[0])).toEqual(Array.from(frame));
  });

  it('extracts multiple frames from a back-to-back stream', () => {
    const buf = new UbxFrameBuffer();
    const f1 = buildValidFrame();
    const f2 = buildValidFrame();
    const combined = new Uint8Array(f1.length + f2.length);
    combined.set(f1, 0);
    combined.set(f2, f1.length);

    const frames = buf.push(combined);
    expect(frames).toHaveLength(2);
  });

  it('clears its internal state on demand', () => {
    const buf = new UbxFrameBuffer();
    buf.push(new Uint8Array([0xb5, 0x62, 0xff, 0x01]));
    expect(buf.size).toBeGreaterThan(0);
    buf.clear();
    expect(buf.size).toBe(0);
  });
});
