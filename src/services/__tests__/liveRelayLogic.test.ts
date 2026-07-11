import { raceBoxToLiveFrame } from '@/services/liveRelayLogic';
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
