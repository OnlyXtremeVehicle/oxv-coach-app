/**
 * Tests unitaires du calcul de marge composite V1.
 *
 * Vise à figer le contrat des seuils et la sémantique métier (vert
 * confortable, jaune à explorer, rouge terrain serré) avant que
 * l'algo ne soit étendu en V2 (transfert de charge, sous/sur-virage).
 */

import { computeMargin, DEFAULT_VEHICLE } from '../marginCalculator';
import type { Lap, TelemetrySession } from '@/types/telemetry';

function lap(overrides: Partial<Lap> = {}): Lap {
  return {
    id: `lap-${Math.random()}`,
    session_id: 's1',
    lap_number: 1,
    is_best_lap: false,
    is_outlap: false,
    is_inlap: false,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: 100,
    max_speed_kmh: 150,
    avg_speed_kmh: 100,
    max_g_lateral: 0.7,
    max_g_braking: -0.9,
    max_g_accel: 0.5,
    distance_meters: 2500,
    start_lat: 45.6,
    start_lon: -0.14,
    end_lat: 45.6,
    end_lon: -0.14,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function session(maxGLat: number): Pick<TelemetrySession, 'max_g_lateral'> {
  return { max_g_lateral: maxGLat };
}

describe('computeMargin', () => {
  it('renvoie 100 sur une session vierge (pas de G observé, pas de tours)', () => {
    const out = computeMargin({ session: session(0), laps: [] });
    expect(out.marginVehicle).toBe(100);
    expect(out.marginPilot).toBe(100);
    expect(out.marginGlobal).toBe(100);
    expect(out.marginZone).toBe('green');
  });

  it('renvoie zone verte sur un pilotage régulier loin de la limite', () => {
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100.0, max_g_lateral: 0.5 }),
      lap({ lap_number: 2, duration_seconds: 100.3, max_g_lateral: 0.52 }),
      lap({ lap_number: 3, duration_seconds: 100.5, max_g_lateral: 0.51 }),
      lap({ lap_number: 4, duration_seconds: 100.2, max_g_lateral: 0.5 }),
    ];
    const out = computeMargin({ session: session(0.55), laps });
    expect(out.marginGlobal).toBeGreaterThan(50);
    expect(out.marginZone).toBe('green');
  });

  it('renvoie zone rouge quand véhicule saturé et tours très irréguliers', () => {
    const laps = [
      lap({ lap_number: 1, duration_seconds: 90, max_g_lateral: 1.0 }),
      lap({ lap_number: 2, duration_seconds: 110, max_g_lateral: 0.2 }),
      lap({ lap_number: 3, duration_seconds: 95, max_g_lateral: 0.95 }),
      lap({ lap_number: 4, duration_seconds: 115, max_g_lateral: 0.3 }),
    ];
    const out = computeMargin({ session: session(1.05), laps });
    expect(out.marginGlobal).toBeLessThan(15);
    expect(out.marginZone).toBe('red');
  });

  it('ignore les outlap et inlap dans le calcul pilote', () => {
    const laps = [
      lap({ lap_number: 1, duration_seconds: 130, is_outlap: true, max_g_lateral: 0.3 }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.6 }),
      lap({ lap_number: 3, duration_seconds: 100.1, max_g_lateral: 0.61 }),
      lap({ lap_number: 4, duration_seconds: 140, is_inlap: true, max_g_lateral: 0.2 }),
    ];
    const out = computeMargin({ session: session(0.65), laps });
    // Seuls les tours 2 et 3 comptent : très réguliers.
    expect(out.validLapCount).toBe(2);
    expect(out.breakdown.regularity).toBeGreaterThan(95);
  });

  it('renvoie marge véhicule = 0 quand G observé dépasse la limite calibrée', () => {
    const out = computeMargin({
      session: session(1.5),
      laps: [lap({ lap_number: 1 })],
      vehicle: { maxGLateral: 1.0 },
    });
    expect(out.marginVehicle).toBe(0);
  });

  it('respecte la pondération 40% véhicule + 60% pilote', () => {
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.5 }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.5 }),
    ];
    // Tours parfaitement réguliers → pilote 100. Véhicule à G ~ 50% → marge ~ 50.
    // Attendu global ≈ 0.4 * 50 + 0.6 * 100 = 80.
    const out = computeMargin({ session: session(0.5), laps });
    expect(out.marginGlobal).toBeGreaterThanOrEqual(75);
    expect(out.marginGlobal).toBeLessThanOrEqual(85);
  });

  it('clamp les sorties dans [0, 100]', () => {
    const out = computeMargin({
      session: session(-10), // négatif → traité comme 0
      laps: [],
    });
    expect(out.marginGlobal).toBeGreaterThanOrEqual(0);
    expect(out.marginGlobal).toBeLessThanOrEqual(100);
  });

  it('utilise DEFAULT_VEHICLE quand pas de vehicle fourni', () => {
    const out = computeMargin({ session: session(DEFAULT_VEHICLE.maxGLateral / 2), laps: [] });
    expect(out.marginVehicle).toBe(50);
  });
});
