import { GpsFix, type RaceBoxData } from '@/types/telemetry';

import { EMPTY_MAXIMA, raceBoxToFrameInsert, updateMaxima } from '../captureFrameMapping';

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
