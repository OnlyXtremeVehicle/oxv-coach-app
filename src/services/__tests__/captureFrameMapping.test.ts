import { GpsFix, type RaceBoxData } from '@/types/telemetry';

import {
  EMPTY_LAP_MAXIMA,
  EMPTY_MAXIMA,
  lapMaximaToColumns,
  nextElapsedMs,
  raceBoxToFrameInsert,
  updateLapMaxima,
  updateMaxima,
} from '../captureFrameMapping';

function frame(
  overrides: Partial<{
    fix: GpsFix;
    lat: number;
    lon: number;
    alt: number;
    acc: number;
    sats: number;
    speed: number;
    heading: number;
    headingValid: boolean;
    gx: number;
    gy: number;
    gz: number;
    rx: number;
    ry: number;
    rz: number;
    battery: number;
    itow: number;
  }> = {}
): RaceBoxData {
  const o = {
    fix: GpsFix.Fix3D,
    lat: 45.6,
    lon: -0.14,
    alt: 30,
    acc: 1.2,
    sats: 12,
    speed: 144,
    heading: 90,
    headingValid: true,
    gx: 0.3,
    gy: -1.1,
    gz: 1.0,
    rx: 1,
    ry: 2,
    rz: 3,
    battery: 80,
    itow: 123456,
    ...overrides,
  };
  return {
    timestamp: {
      year: 2026,
      month: 7,
      day: 1,
      hour: 12,
      minute: 0,
      second: 0,
      nanoseconds: 0,
      iTOW: o.itow,
    },
    gps: {
      fix: o.fix,
      satellites: o.sats,
      latitude: o.lat,
      longitude: o.lon,
      altitude: o.alt,
      accuracy: o.acc,
    },
    motion: { speed: o.speed, heading: o.heading, headingValid: o.headingValid },
    imu: {
      gForceX: o.gx,
      gForceY: o.gy,
      gForceZ: o.gz,
      rotRateX: o.rx,
      rotRateY: o.ry,
      rotRateZ: o.rz,
    },
    battery: { isCharging: false, level: o.battery },
  };
}

// ---------------------------------------------------------------------------
// `elapsed_ms` est la CLÉ D'IDEMPOTENCE des trames (UNIQUE (session_id,
// elapsed_ms) + UPSERT DO NOTHING) : deux trames réelles distinctes partageant
// une valeur seraient JETÉES en silence par la base. Ces tests VERROUILLENT la
// stricte croissance — leur échec signalerait une perte de données du pilote.
// ---------------------------------------------------------------------------
describe('nextElapsedMs — stricte croissance (Valencia §4.6)', () => {
  it('suit l’horloge murale quand elle avance normalement', () => {
    // 25 Hz : une trame toutes les 40 ms, aucun clamp ne s'applique.
    expect(nextElapsedMs(1_000_040, 1_000_000, 0)).toBe(40);
    expect(nextElapsedMs(1_000_080, 1_000_000, 40)).toBe(80);
  });

  it('DEUX TRAMES DANS LA MÊME MILLISECONDE reçoivent des elapsed STRICTEMENT différents', () => {
    // Cas prouvé : le RaceBox livre plusieurs trames par notification BLE,
    // drainées dans le MÊME tick synchrone → `Date.now()` identique.
    const now = 1_000_500;
    const start = 1_000_000;
    const a = nextElapsedMs(now, start, 0);
    const b = nextElapsedMs(now, start, a);
    const c = nextElapsedMs(now, start, b);
    expect(a).toBe(500);
    expect(b).toBe(501);
    expect(c).toBe(502);
    expect(new Set([a, b, c]).size).toBe(3); // aucune collision de clé
  });

  it('un RECUL D’HORLOGE ne fige plus elapsed : la suite avance de 1 ms par trame', () => {
    // Resynchro NTP au retour réseau : `now - startMs` recule de 2 s. L'ancien
    // `Math.max(now - start, last)` épinglait ~50 trames sur la même valeur.
    const start = 1_000_000;
    let last = 10_000;
    const out: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      last = nextElapsedMs(start + 8_000, start, last); // horloge reculée à 8 s
      out.push(last);
    }
    expect(out).toEqual([10_001, 10_002, 10_003, 10_004, 10_005]);
    expect(new Set(out).size).toBe(5);
  });

  it('se recale seule dès que l’horloge murale rattrape', () => {
    // La compression n'est que temporaire : aucune dérive permanente.
    const start = 1_000_000;
    const compressed = nextElapsedMs(start + 8_000, start, 10_000); // 10_001
    expect(compressed).toBe(10_001);
    expect(nextElapsedMs(start + 12_000, start, compressed)).toBe(12_000);
  });

  it('est strictement croissante quelle que soit l’horloge (propriété générale)', () => {
    const start = 1_000_000;
    // Horloge chaotique : constante, en recul, en avance, en saut.
    const clocks = [500, 500, 500, 200, 100, 4_000, 4_000, 3_999, 9_000];
    let last = 0;
    for (const dt of clocks) {
      const next = nextElapsedMs(start + dt, start, last);
      expect(next).toBeGreaterThan(last); // STRICTEMENT — jamais >=
      last = next;
    }
  });
});

describe('raceBoxToFrameInsert (P0 write path)', () => {
  it('mappe les colonnes lues par l’analyse', () => {
    const row = raceBoxToFrameInsert(frame(), 'sess-1', 1500.7);
    expect(row.session_id).toBe('sess-1');
    expect(row.elapsed_ms).toBe(1501); // arrondi
    expect(row.latitude).toBe(45.6);
    expect(row.longitude).toBe(-0.14);
    expect(row.altitude_m).toBe(30);
    expect(row.speed_kmh).toBe(144);
    expect(row.speed_ms).toBeCloseTo(40, 5); // 144/3.6
    expect(row.gps_fix).toBe(GpsFix.Fix3D);
    expect(row.fix_valid).toBe(true);
    expect(row.gps_accuracy_m).toBe(1.2);
    expect(row.satellites).toBe(12);
    expect(row.g_force_x).toBe(0.3);
    expect(row.g_force_y).toBe(-1.1);
    expect(row.battery_level).toBe(80);
    expect(row.itow_ms).toBe(123456);
  });

  it('clampe elapsed_ms négatif à 0', () => {
    expect(raceBoxToFrameInsert(frame(), 's', -50).elapsed_ms).toBe(0);
  });

  it('met heading à null si cap non valide', () => {
    expect(raceBoxToFrameInsert(frame({ headingValid: false }), 's', 0).heading).toBeNull();
  });

  it('fix_valid false sous Fix3D', () => {
    expect(raceBoxToFrameInsert(frame({ fix: GpsFix.Fix2D }), 's', 0).fix_valid).toBe(false);
  });
});

describe('updateMaxima', () => {
  it('retient les maxima (latéral = |Y|, longitudinal = |X|)', () => {
    let m = EMPTY_MAXIMA;
    m = updateMaxima(m, frame({ speed: 100, gx: 0.2, gy: -0.5 }));
    m = updateMaxima(m, frame({ speed: 180, gx: -0.9, gy: 1.4 }));
    m = updateMaxima(m, frame({ speed: 150, gx: 0.3, gy: -0.8 }));
    expect(m.maxSpeedKmh).toBe(180);
    expect(m.maxGLateral).toBeCloseTo(1.4, 5);
    expect(m.maxGLongitudinal).toBeCloseTo(0.9, 5);
  });
});

// ---------------------------------------------------------------------------
// MAXIMA PAR TOUR — la donnée que `laps.max_*` n'avait jamais reçue.
//
// Sans ces valeurs, `computeSmoothness` lisait `max_g_lateral ?? 0` sur chaque
// tour : écart-type nul, fluidité 100 fabriquée sur 100 % des séances réelles.
// Ces tests verrouillent la CONVENTION D'AXES (identique à updateMaxima et à
// sessionTelemetryMapping.test.ts) et le refus de fabriquer un zéro.
// ---------------------------------------------------------------------------
describe('updateLapMaxima — accumulation par tour', () => {
  it('retient le latéral en VALEUR ABSOLUE (un virage à gauche compte autant)', () => {
    let m = EMPTY_LAP_MAXIMA;
    m = updateLapMaxima(m, frame({ gy: 0.6 })); // droite
    m = updateLapMaxima(m, frame({ gy: -1.2 })); // gauche, plus fort
    m = updateLapMaxima(m, frame({ gy: 0.9 }));
    expect(m.maxGLateral).toBeCloseTo(1.2, 5);
  });

  it('sépare FREINAGE (x > 0) et ACCÉLÉRATION (x < 0) — convention verrouillée', () => {
    let m = EMPTY_LAP_MAXIMA;
    m = updateLapMaxima(m, frame({ gx: 0.9 })); // gros freinage
    m = updateLapMaxima(m, frame({ gx: -0.4 })); // accélération
    m = updateLapMaxima(m, frame({ gx: 0.2 })); // petit freinage
    // Le freinage ne doit JAMAIS récupérer le 0.4 d'accélération, et
    // l'accélération jamais le 0.9 de freinage : c'est l'inversion d'axes qui
    // fausserait le QDI entier.
    expect(m.maxGBraking).toBeCloseTo(0.9, 5);
    expect(m.maxGAccel).toBeCloseTo(0.4, 5);
  });

  it('un tour mesuré SANS freinage porte un freinage de 0 (observation, pas trou)', () => {
    // Nuance essentielle : 0 mesuré ≠ null. Ici on a bien regardé, et il n'a
    // jamais freiné.
    const m = updateLapMaxima(EMPTY_LAP_MAXIMA, frame({ gx: -0.5 }));
    expect(m.maxGBraking).toBe(0);
    expect(m.maxGAccel).toBeCloseTo(0.5, 5);
  });

  it('retient la vitesse max et alimente la moyenne depuis la MÊME source', () => {
    let m = EMPTY_LAP_MAXIMA;
    m = updateLapMaxima(m, frame({ speed: 100 }));
    m = updateLapMaxima(m, frame({ speed: 180 }));
    m = updateLapMaxima(m, frame({ speed: 140 }));
    expect(m.maxSpeedKmh).toBe(180);
    expect(lapMaximaToColumns(m).avg_speed_kmh).toBeCloseTo(140, 5);
  });

  it('est une transformation PURE (n’altère pas l’accumulateur reçu)', () => {
    const before = { ...EMPTY_LAP_MAXIMA };
    updateLapMaxima(EMPTY_LAP_MAXIMA, frame({ speed: 200, gy: 1.5 }));
    expect(EMPTY_LAP_MAXIMA).toEqual(before);
  });
});

describe('lapMaximaToColumns — absent = null, JAMAIS 0', () => {
  it('un tour sans AUCUNE trame rattachée rend tout null', () => {
    // Le cœur de la correction : ce tour se rendra « — », pas « 0 ».
    expect(lapMaximaToColumns(undefined)).toEqual({
      max_speed_kmh: null,
      avg_speed_kmh: null,
      max_g_lateral: null,
      max_g_braking: null,
      max_g_accel: null,
    });
  });

  it('un accumulateur vierge rend tout null (aucun 0 par défaut)', () => {
    const cols = lapMaximaToColumns({ ...EMPTY_LAP_MAXIMA });
    expect(cols.max_g_lateral).toBeNull();
    expect(cols.max_speed_kmh).toBeNull();
    expect(cols.avg_speed_kmh).toBeNull();
    // Le verrou : surtout pas 0 — c'est ce zéro-là qui fabriquait la fluidité.
    expect(cols.max_g_lateral).not.toBe(0);
  });

  it('projette les mesures réelles sur les colonnes `laps`', () => {
    let m = EMPTY_LAP_MAXIMA;
    m = updateLapMaxima(m, frame({ speed: 120, gx: 0.8, gy: -1.1 }));
    m = updateLapMaxima(m, frame({ speed: 160, gx: -0.6, gy: 0.4 }));
    const cols = lapMaximaToColumns(m);
    expect(cols.max_speed_kmh).toBe(160);
    expect(cols.avg_speed_kmh).toBeCloseTo(140, 5);
    expect(cols.max_g_lateral).toBeCloseTo(1.1, 5);
    expect(cols.max_g_braking).toBeCloseTo(0.8, 5);
    expect(cols.max_g_accel).toBeCloseTo(0.6, 5);
  });
});
