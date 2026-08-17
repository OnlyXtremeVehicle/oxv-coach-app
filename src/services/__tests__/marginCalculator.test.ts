/**
 * Tests unitaires du calcul de marge composite V1.
 *
 * Vise à figer le contrat des seuils et la sémantique métier (vert
 * confortable, jaune à explorer, rouge terrain serré) avant que
 * l'algo ne soit étendu en V2 (transfert de charge, sous/sur-virage).
 */

import { computeMargin, isMarginResolved } from '../marginCalculator';
import type { Lap, TelemetrySession } from '@/types/telemetry';

/**
 * UN VÉHICULE CARACTÉRISÉ, EXPLICITE.
 *
 * Ces tests portent sur l'ARITHMÉTIQUE de la marge véhicule : il leur faut donc
 * un dénominateur. Il est écrit ici, dans le test, et non repris d'un défaut du
 * code de production — c'est toute la différence avec `DEFAULT_VEHICLE`, qui
 * s'appliquait aux vraies séances sans qu'aucune donnée le soutienne.
 */
const VEHICULE = { maxGLateral: 1.0 } as const;

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

/**
 * TROIS tours, et non deux, DEPUIS LE 14/08/2026.
 *
 * `computeConsistency` est déléguée à `computeRegularite`, qui refuse en
 * dessous de trois tours : deux tours ne donnent qu'UN écart, et un écart n'est
 * pas une dispersion. Sous trois tours la constance vaut `null`, donc la marge
 * pilote aussi, donc la marge globale — absence, jamais zéro.
 *
 * Les fixtures d'avant en avaient deux et passaient : la formule absolue, elle,
 * acceptait n'importe quel nombre de tours. Le changement de minimum est une
 * conséquence assumée du passage au coefficient de variation, pas un effet de
 * bord — il est épinglé par son propre test plus bas.
 */
function regularLaps(): Lap[] {
  return [
    lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.5 }),
    lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.5 }),
    lap({ lap_number: 3, duration_seconds: 100, max_g_lateral: 0.5 }),
  ];
}

describe('computeMargin', () => {
  it('renvoie 100 de marge véhicule sur un 0 g RÉELLEMENT observé', () => {
    // 0 g mesuré = la voiture n'a jamais tourné : la marge véhicule est
    // entière. C'est le seul cas où 100 est honnête (contraste avec le NULL).
    const out = computeMargin({ session: session(0), laps: regularLaps(), vehicle: VEHICULE });
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
      lap({ lap_number: 4, duration_seconds: 99.9, max_g_lateral: 0.59 }),
      lap({ lap_number: 5, duration_seconds: 140, is_inlap: true, max_g_lateral: 0.2 }),
    ];
    const out = computeMargin({ session: session(0.65), laps, vehicle: VEHICULE });
    // Seuls les tours 2, 3 et 4 comptent : très réguliers.
    expect(out.validLapCount).toBe(3);
    expect(out.breakdown.consistency).toBeGreaterThan(95);
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
      lap({ lap_number: 3, duration_seconds: 100, max_g_lateral: 0.5 }),
    ];
    // Tours parfaitement réguliers → pilote 100. Véhicule à G ~ 50% → marge ~ 50.
    // Attendu global ≈ 0.4 * 50 + 0.6 * 100 = 80.
    const out = computeMargin({ session: session(0.5), laps, vehicle: VEHICULE });
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

  /**
   * CE TEST ÉPINGLAIT LA FABRICATION — IL ÉPINGLE MAINTENANT SON RETRAIT.
   *
   * Il s'appelait « utilise DEFAULT_VEHICLE quand pas de vehicle fourni » et
   * vérifiait que la constante inventée s'appliquait bien. Il passait, et il
   * décrivait exactement le défaut : `input.vehicle` n'est JAMAIS passé par le
   * seul appelant de production, donc 100 % des séances portaient un
   * dénominateur de 1,0 g qu'aucune donnée ne soutenait.
   *
   * Un test vert peut documenter une fabrication aussi fidèlement qu'il
   * documenterait une règle.
   */
  it('sans véhicule fourni, il n’y a PAS de marge véhicule', () => {
    const out = computeMargin({ session: session(0.5), laps: regularLaps() });
    expect(out.marginVehicle).toBeNull();
    expect(out.base).toBe('pilote-seul');
  });

  it('la marge globale se replie alors sur la marge PILOTE, à l’identique', () => {
    const out = computeMargin({ session: session(0.5), laps: regularLaps() });
    expect(out.marginGlobal).toBe(out.marginPilot);
  });

  /**
   * Et quand le véhicule EST caractérisé, la pondération 40/60 reprend. Le
   * chemin n'est pas mort : il attend une donnée que la base ne porte pas
   * encore.
   */
  it('un véhicule caractérisé rend la pondération 40/60', () => {
    const out = computeMargin({
      session: session(0.5),
      laps: regularLaps(),
      vehicle: { maxGLateral: 1.0 },
    });
    expect(out.marginVehicle).toBe(50);
    expect(out.base).toBe('complete');
    expect(out.marginGlobal).toBe(Math.round(0.4 * 50 + 0.6 * (out.marginPilot as number)));
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
    const out = computeMargin({ session: session(null), laps: regularLaps(), vehicle: VEHICULE });

    expect(out.marginVehicle).toBeNull();
    expect(out.breakdown.vehicle).toBeNull();
    expect(isMarginResolved(out)).toBe(false);
    /**
     * MISE À JOUR DU 14/08 — ET UNE NUANCE QUI M'A REPRIS.
     *
     * La marge globale ne devient plus nulle : le véhicule n'est pas mesurable
     * sur cette séance, elle se replie donc sur le PILOTE, et `base` le dit.
     *
     * J'avais d'abord ajouté ici `marginGlobal).not.toBe(100)`, par réflexe.
     * Faux : ce cas emploie `regularLaps()`, des tours parfaitement réguliers.
     * La marge pilote VAUT 100, et c'est honnête — 100 fabriqué et 100 mesuré
     * sont deux choses différentes, et c'est précisément la distinction que ce
     * bloc de tests défend.
     *
     * Le verrou porte donc sur le VÉHICULE, qui est le sujet du finding.
     */
    expect(out.marginGlobal).toBe(out.marginPilot);
    expect(out.base).toBe('pilote-seul');
    expect(out.marginVehicle).not.toBe(100);
  });

  it('ne fabrique JAMAIS 100 % de marge pilote sans tours (session vierge)', () => {
    const out = computeMargin({ session: session(0.8), laps: [], vehicle: VEHICULE });

    expect(out.marginPilot).toBeNull();
    expect(out.breakdown.consistency).toBeNull();
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
      consistency: null,
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
    // Comme ci-dessus : repli sur la marge pilote, jamais un 100 % fabriqué.
    expect(out.marginGlobal).toBe(out.marginPilot);
    expect(out.base).toBe('pilote-seul');
  });
});

// ============================================================================
// FLUIDITÉ — la dernière fabrication du write-path.
//
// `laps.max_g_lateral` n'était écrit par personne (buildLapRows l'omettait, aucun
// trigger ne le calculait). Le `Number(l.max_g_lateral ?? 0)` d'ici transformait
// donc tous les tours en 0 g : écart-type nul → fluidité 100, sur 100 % des
// séances réelles, pour ~24 % de la marge globale (0,6 × 0,4). Des zéros
// identiques ne sont pas une constance parfaite : c'est une absence de données.
// ============================================================================
describe('computeMargin — fluidité : tours sans mesure', () => {
  it('ne fabrique JAMAIS 100 de fluidité quand AUCUN tour n’a de max_g_lateral', () => {
    // Exactement les séances déjà captées avant l'écriture de la colonne.
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: null }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: null }),
      lap({ lap_number: 3, duration_seconds: 100, max_g_lateral: null }),
    ];
    const out = computeMargin({ session: session(0.5), laps });

    // Le verrou du finding : avant, stddev([0,0,0]) = 0 → smoothness = 100.
    expect(out.breakdown.smoothness).toBeNull();
    expect(out.breakdown.smoothness).not.toBe(100);
    // La fluidité manque → pas de marge pilote, donc pas de marge globale.
    expect(out.marginPilot).toBeNull();
    expect(out.marginGlobal).toBeNull();
    expect(out.marginZone).toBeNull();
    expect(isMarginResolved(out)).toBe(false);
    // La régularité, elle, est RÉELLE (les temps au tour sont mesurés) et reste
    // exposée : on ne perd pas une donnée vraie au passage.
    expect(out.breakdown.consistency).toBeGreaterThan(95);
  });

  it('un SEUL tour mesuré ne suffit pas à une dispersion → null', () => {
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.6 }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: null }),
      lap({ lap_number: 3, duration_seconds: 100, max_g_lateral: null }),
    ];
    const out = computeMargin({ session: session(0.5), laps });
    expect(out.breakdown.smoothness).toBeNull();
    expect(out.marginGlobal).toBeNull();
  });

  it('ignore les tours sans mesure et calcule sur les tours RÉELLEMENT mesurés', () => {
    // Deux tours mesurés suffisent : la dispersion porte sur EUX, le tour muet
    // n'entre pas comme un 0 (qui aurait explosé l'écart-type à ~0,28).
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.6 }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.62 }),
      lap({ lap_number: 3, duration_seconds: 100, max_g_lateral: null }),
    ];
    const out = computeMargin({ session: session(0.65), laps, vehicle: VEHICULE });

    // stddev([0.6, 0.62]) = 0.01 ≤ 0.05 → fluidité 100, et cette fois c'est vrai.
    expect(out.breakdown.smoothness).toBe(100);
    expect(out.marginGlobal).not.toBeNull();
    expect(isMarginResolved(out)).toBe(true);
  });

  it('des tours mesurés et DISPERSÉS donnent une fluidité basse (valeur réelle)', () => {
    // Contre-épreuve : le calcul distingue bien un vrai pilotage irrégulier d'un
    // « tout à 0 ». stddev([0.2, 1.1]) = 0.45 → 100 − 0.40 × 200 = 20.
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.2 }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 1.1 }),
    ];
    const out = computeMargin({ session: session(1.1), laps });
    expect(out.breakdown.smoothness).toBeCloseTo(20, 5);
  });

  it('écarte un max_g_lateral corrompu comme une absence (jamais 0 g)', () => {
    const laps = [
      lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: Number.NaN }),
      lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.6 }),
    ];
    const out = computeMargin({ session: session(0.6), laps });
    expect(out.breakdown.smoothness).toBeNull();
    expect(out.marginGlobal).toBeNull();
  });
});

/**
 * LE MINIMUM DE TROIS TOURS — conséquence assumée, épinglée ici.
 *
 * Jusqu'au 14/08/2026 la constance acceptait deux tours : la formule absolue se
 * contentait d'un écart-type, quel qu'en soit le nombre de termes. Déléguée à
 * `computeRegularite`, elle hérite de sa garde.
 *
 * Ce n'est pas une perte : deux tours donnent UN écart. Appeler cela une mesure
 * de régularité, c'est la même thinness que le zéro fabriqué — on affiche un
 * chiffre là où il n'y a pas de quoi en faire un.
 *
 * Et la marge globale disparaît AVEC elle, plutôt que de se rabattre sur la
 * seule fluidité : une somme à un terme n'est pas une somme.
 */
describe('la constance exige trois tours, et le dit par une absence', () => {
  const deuxTours = [
    lap({ lap_number: 1, duration_seconds: 100, max_g_lateral: 0.5 }),
    lap({ lap_number: 2, duration_seconds: 100, max_g_lateral: 0.5 }),
  ];

  it('deux tours : constance absente, jamais un zéro ni un cent', () => {
    const out = computeMargin({ session: session(0.5), laps: deuxTours });
    expect(out.breakdown.consistency).toBeNull();
  });

  it('la fluidité, elle, reste mesurée — une absence n’en entraîne pas deux', () => {
    const out = computeMargin({ session: session(0.5), laps: deuxTours });
    expect(out.breakdown.smoothness).not.toBeNull();
  });

  it('sans constance, pas de marge pilote ni de marge globale', () => {
    const out = computeMargin({ session: session(0.5), laps: deuxTours });
    expect(out.marginPilot).toBeNull();
    expect(out.marginGlobal).toBeNull();
    expect(isMarginResolved(out)).toBe(false);
  });

  it('le troisième tour suffit à tout rouvrir', () => {
    const troisTours = [
      ...deuxTours,
      lap({ lap_number: 3, duration_seconds: 100, max_g_lateral: 0.5 }),
    ];
    const out = computeMargin({ session: session(0.5), laps: troisTours });
    expect(out.breakdown.consistency).toBe(100);
    expect(out.marginGlobal).not.toBeNull();
  });
});

describe('isMarginResolved', () => {
  it('accepte une marge dont toutes les composantes sont réelles', () => {
    const out = computeMargin({ session: session(0.5), laps: regularLaps(), vehicle: VEHICULE });
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
