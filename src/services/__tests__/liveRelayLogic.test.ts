import { buildBiometryEvent, raceBoxToLiveFrame } from '@/services/liveRelayLogic';
import type { BioSample } from '@/services/v2/biometryBufferLogic';
import type { RaceBoxData } from '@/types/telemetry';

function raceBox(
  over: {
    speed?: number;
    gForceX?: number;
    gForceY?: number;
  } = {}
): RaceBoxData {
  return {
    timestamp: {
      year: 2026,
      month: 7,
      day: 11,
      hour: 12,
      minute: 0,
      second: 0,
      nanoseconds: 0,
      iTOW: 0,
    },
    gps: { fix: 3, satellites: 12, latitude: 45.6, longitude: -0.5, altitude: 30, accuracy: 1 },
    motion: { speed: over.speed ?? 138, heading: 90, headingValid: true },
    imu: {
      gForceX: over.gForceX ?? 0.3,
      gForceY: over.gForceY ?? 0.9,
      gForceZ: 1,
      rotRateX: 0,
      rotRateY: 0,
      rotRateZ: 0,
    },
  } as unknown as RaceBoxData;
}

describe('raceBoxToLiveFrame (map pure trame RaceBox → LiveFrame)', () => {
  it('mappe vitesse (déjà km/h) et G (lat=Y, long=X)', () => {
    const f = raceBoxToLiveFrame(raceBox({ speed: 142, gForceX: 0.25, gForceY: 1.1 }), {
      lap: 3,
      lapStartMs: 1000,
      nowMs: 25000,
    });
    expect(f.speedKmh).toBe(142);
    expect(f.gLat).toBe(1.1); // gForceY
    expect(f.gLong).toBe(0.25); // gForceX
  });

  it('calcule le chrono du tour courant (now − lapStart)', () => {
    const f = raceBoxToLiveFrame(raceBox(), { lap: 2, lapStartMs: 10000, nowMs: 34318 });
    expect(f.chronoMs).toBe(24318);
    expect(f.lap).toBe(2);
    expect(f.atMs).toBe(34318);
  });

  it('chrono jamais négatif (garde-fou horloge)', () => {
    const f = raceBoxToLiveFrame(raceBox(), { lap: 1, lapStartMs: 5000, nowMs: 4000 });
    expect(f.chronoMs).toBe(0);
  });

  it('secteur/virage honnêtement nuls sans contexte', () => {
    const f = raceBoxToLiveFrame(raceBox(), { lap: 1, lapStartMs: 0, nowMs: 1000 });
    expect(f.sector).toBeNull();
    expect(f.cornerIndex).toBeNull();
    expect(f.cornerWatch).toBe(false);
  });

  it('propage secteur/virage quand le contexte les connaît', () => {
    const f = raceBoxToLiveFrame(raceBox(), {
      lap: 4,
      lapStartMs: 0,
      nowMs: 1000,
      sector: 2,
      cornerIndex: 3,
      cornerWatch: true,
    });
    expect(f.sector).toBe(2);
    expect(f.cornerIndex).toBe(3);
    expect(f.cornerWatch).toBe(true);
  });
});

function bio(over: Partial<BioSample> & { ts: number }): BioSample {
  return {
    hrBpm: over.hrBpm ?? 150,
    rrMs: over.rrMs ?? [],
    contact: over.contact ?? 'ok',
    ts: over.ts,
  };
}

describe('buildBiometryEvent (événement biométrique live, pur)', () => {
  it('tampon vide → null (jamais de valeur fabriquée)', () => {
    expect(buildBiometryEvent([], 10000)).toBeNull();
  });

  it('aucun échantillon dans la fenêtre récente → null', () => {
    // Seul échantillon à 5 s avant la fenêtre récente [8000, 10000].
    const samples = [bio({ ts: 3000, hrBpm: 160 })];
    expect(buildBiometryEvent(samples, 10000, { windowMs: 2000 })).toBeNull();
  });

  it('moyenne la FC sur la fenêtre récente (arrondi bpm)', () => {
    const samples = [
      bio({ ts: 9000, hrBpm: 150 }),
      bio({ ts: 9500, hrBpm: 155 }),
      bio({ ts: 9900, hrBpm: 160 }),
    ];
    const ev = buildBiometryEvent(samples, 10000, { windowMs: 2000 });
    expect(ev).not.toBeNull();
    expect(ev!.hrBpm).toBe(155); // (150+155+160)/3
    expect(ev!.atMs).toBe(10000);
  });

  it('ignore les échantillons hors fenêtre récente dans la moyenne', () => {
    const samples = [
      bio({ ts: 3000, hrBpm: 90 }), // hors fenêtre → ignoré
      bio({ ts: 9000, hrBpm: 150 }),
      bio({ ts: 9800, hrBpm: 150 }),
    ];
    const ev = buildBiometryEvent(samples, 10000, { windowMs: 2000 });
    expect(ev!.hrBpm).toBe(150);
  });

  it('écarte les FC non exploitables (0 / non finies) de la moyenne', () => {
    const samples = [
      bio({ ts: 9000, hrBpm: 0 }), // capteur qui décroche → ignoré
      bio({ ts: 9500, hrBpm: 148 }),
      bio({ ts: 9900, hrBpm: 152 }),
    ];
    const ev = buildBiometryEvent(samples, 10000, { windowMs: 2000 });
    expect(ev!.hrBpm).toBe(150);
  });

  it('fenêtre récente sans aucune FC exploitable → null', () => {
    const samples = [bio({ ts: 9500, hrBpm: 0 }), bio({ ts: 9900, hrBpm: 0 })];
    expect(buildBiometryEvent(samples, 10000, { windowMs: 2000 })).toBeNull();
  });

  it('contact = état du plus récent échantillon de la fenêtre', () => {
    const samples = [
      bio({ ts: 9000, contact: 'ok' }),
      bio({ ts: 9900, contact: 'poor' }), // le plus récent
    ];
    const ev = buildBiometryEvent(samples, 10000, { windowMs: 2000 });
    expect(ev!.contact).toBe('poor');
  });

  it('R-R insuffisant (référence vide) → tendance stable, jamais inventée', () => {
    const samples = [bio({ ts: 9500, rrMs: [800, 810] }), bio({ ts: 9900, rrMs: [805] })];
    const ev = buildBiometryEvent(samples, 10000, { windowMs: 2000, baselineMs: 60000 });
    expect(ev!.rrTrend).toBe('stable');
  });

  it('tendance R-R en hausse quand la dispersion récente dépasse la référence', () => {
    // Référence [antérieure] : R-R quasi constants → RMSSD faible.
    // Récent : R-R très dispersés → RMSSD élevé → « en hausse ».
    const samples: BioSample[] = [
      bio({ ts: 2000, rrMs: [800, 801, 800, 801, 800] }), // baseline antérieure
      bio({ ts: 3000, rrMs: [800, 801, 800, 801] }),
      bio({ ts: 9200, rrMs: [700, 900, 700, 900] }), // récent, dispersé
      bio({ ts: 9800, rrMs: [700, 900, 700, 900] }),
    ];
    const ev = buildBiometryEvent(samples, 10000, { windowMs: 2000, baselineMs: 60000 });
    expect(ev!.rrTrend).toBe('en hausse');
  });

  it('sortie STRICTEMENT factuelle : hrBpm, rrTrend, contact, atMs — aucun autre champ', () => {
    const ev = buildBiometryEvent([bio({ ts: 9900, hrBpm: 150 })], 10000);
    expect(Object.keys(ev!).sort()).toEqual(['atMs', 'contact', 'hrBpm', 'rrTrend']);
  });
});
