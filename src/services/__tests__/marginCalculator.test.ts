/**
 * Tests unitaires du calcul de marge composite V1.
 *
 * Vise à figer le contrat des seuils et la sémantique métier (vert
 * confortable, jaune à explorer, rouge terrain serré) avant que
 * l'algo ne soit étendu en V2 (transfert de charge, sous/sur-virage).
 */

import { computeMargin, isMarginResolved, DEFAULT_VEHICLE } from '../marginCalculator';
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

function session(maxGLat: number | null): Pick<TelemetrySession, 'max_g_lateral'> {
  return { max_g_lateral: maxGLat };
}

function regularLaps(): Lap[] {
  return [
    lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.5 }),
    lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.5 }),
  ];
}

describe('computeMargin', () => {
  it('renvoie 100 de marge véhicule sur un 0 g RÉELLEMENT observé', () => {
    // 0 g mesuré = la voiture n'a jamais tourné : la marge véhicule est
    // entière. C'est le seul cas où 100 est honnête (contraste avec le NULL).
    const out = computeMargin({ session: session(0), laps: regularLaps() });
    expect(out.marginVehicle).toBe(100);
    expect(isMarginResolved(out)).toBe(true);
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
      laps: regularLaps(),
    });
    expect(out.marginGlobal).toBeGreaterThanOrEqual(0);
    expect(out.marginGlobal).toBeLessThanOrEqual(100);
  });

  it('utilise DEFAULT_VEHICLE quand pas de vehicle fourni', () => {
    const out = computeMargin({
      session: session(DEFAULT_VEHICLE.maxGLateral / 2),
      laps: regularLaps(),
    });
    expect(out.marginVehicle).toBe(50);
  });
});

// ============================================================================
// DONNÉE ABSENTE → PAS DE MARGE (finding [3], durcissement Valencia)
//
// `max_g_lateral` n'est écrit qu'à la clôture de la session : une séance encore
// en `recording` (op `complete` pas drainée) le porte à NULL. Le lire comme
// « 0 g observé » donnait 100 % de marge — chiffre roi du bilan, faux, et
// persisté définitivement. Une entrée absente doit produire `null`, jamais 100.
// ============================================================================
describe('computeMargin — honnêteté de la donnée absente', () => {
  it('ne fabrique JAMAIS 100 % quand max_g_lateral est NULL (session non close)', () => {
    const out = computeMargin({ session: session(null), laps: regularLaps() });

    expect(out.marginVehicle).toBeNull();
    expect(out.marginGlobal).toBeNull();
    expect(out.marginZone).toBeNull();
    expect(out.breakdown.vehicle).toBeNull();
    expect(isMarginResolved(out)).toBe(false);
    // Le verrou du finding : surtout pas 100.
    expect(out.marginGlobal).not.toBe(100);
    expect(out.marginVehicle).not.toBe(100);
  });

  it('ne fabrique JAMAIS 100 % de marge pilote sans tours (session vierge)', () => {
    const out = computeMargin({ session: session(0.8), laps: [] });

    expect(out.marginPilot).toBeNull();
    expect(out.breakdown.regularity).toBeNull();
    expect(out.breakdown.smoothness).toBeNull();
    expect(out.validLapCount).toBe(0);
    // La marge véhicule est réelle (0,8 g sur 1,0 g calibré → 20 %), mais le
    // composite 40/60 n'est pas calculable pour autant.
    expect(out.marginVehicle).toBeCloseTo(20, 5);
    expect(out.marginGlobal).toBeNull();
    expect(isMarginResolved(out)).toBe(false);
  });

  it('ne fabrique pas de dispersion sur un tour unique (rien à disperser)', () => {
    const out = computeMargin({
      session: session(0.8),
      laps: [lap({ lap_number: 1, duration_seconds: 100 })],
    });

    expect(out.validLapCount).toBe(1);
    expect(out.marginPilot).toBeNull();
    expect(out.marginGlobal).toBeNull();
    expect(isMarginResolved(out)).toBe(false);
  });

  it('cas nominal du scénario Valencia : session en `recording`, aucun tour remonté', () => {
    // La séance vient d'être arrêtée, la file de synchro draine encore : ni
    // max_g_lateral ni tours. L'ancien calcul rendait 0.4×100 + 0.6×100 = 100.
    const out = computeMargin({ session: session(null), laps: [] });

    expect(out.marginGlobal).toBeNull();
    expect(out.marginZone).toBeNull();
    expect(out.marginVehicle).toBeNull();
    expect(out.marginPilot).toBeNull();
    expect(out.breakdown).toEqual({
      vehicle: null,
      pilot: null,
      regularity: null,
      smoothness: null,
    });
    expect(isMarginResolved(out)).toBe(false);
  });

  it('rend null sur un max_g_lateral non numérique (donnée corrompue ≠ 0 g)', () => {
    const out = computeMargin({
      session: { max_g_lateral: Number.NaN },
      laps: regularLaps(),
    });
    expect(out.marginVehicle).toBeNull();
    expect(out.marginGlobal).toBeNull();
  });
});

describe('isMarginResolved', () => {
  it('accepte une marge dont toutes les composantes sont réelles', () => {
    const out = computeMargin({ session: session(0.5), laps: regularLaps() });
    expect(isMarginResolved(out)).toBe(true);
    if (isMarginResolved(out)) {
      // Le narrowing donne bien des nombres aux appelants (persistance, coach).
      expect(typeof out.marginGlobal).toBe('number');
      expect(typeof out.breakdown.smoothness).toBe('number');
    }
  });

  it('rejette dès qu’une seule composante manque', () => {
    expect(isMarginResolved(computeMargin({ session: session(null), laps: regularLaps() }))).toBe(
      false
    );
    expect(isMarginResolved(computeMargin({ session: session(0.5), laps: [] }))).toBe(false);
  });
});
