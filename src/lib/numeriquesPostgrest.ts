/**
 * LES COLONNES `numeric` ARRIVENT EN CHAÎNES. UNE FOIS, À LA FRONTIÈRE.
 *
 * ===========================================================================
 * LE DÉFAUT, ET POURQUOI IL REVIENT
 * ===========================================================================
 *
 * PostgREST sérialise `numeric` en CHAÎNE JSON — pour préserver la précision
 * décimale. Une colonne déclarée `number` en TypeScript vaut donc `"83.412"`
 * au runtime, et le compilateur affirme le contraire.
 *
 * Ça ne plante jamais. Ça ment, en silence, et toujours de la même façon :
 *
 *   Number.isFinite("83.412")   → false
 *   typeof "83.412" === 'number' → false
 *   "102.7" < "95.2"             → true   (comparaison lexicographique)
 *
 * Le dépôt a corrigé ce défaut TROIS FOIS, à trois endroits, sans jamais le
 * corriger à sa source :
 *
 *   - `distance_km`, documenté ;
 *   - `format.ts`, où le formateur rendait « — » sur des chronos présents ;
 *   - `nombresDuTour`, le 13/08/2026, quand la section DELTA affirmait
 *     « pas deux tours à comparer » sur une séance de vingt tours.
 *
 * Et il restait vivant sur `telemetry_sessions`, où il produisait le pire des
 * trois : **toute séance était célébrée comme record personnel**, parce que
 * `typeof s.best_lap_seconds === 'number'` écartait TOUTES les autres séances
 * et laissait la comparaison sans rien à comparer.
 *
 * ===========================================================================
 * POURQUOI ICI, ET PAS CHEZ LES APPELANTS
 * ===========================================================================
 *
 * La frontière réseau est le seul endroit où l'on sait d'où vient la valeur.
 * Vingt mètres plus loin, un `Number(x)` défensif est indiscernable d'une
 * conversion inutile, et personne n'ose le retirer.
 *
 * Les listes de colonnes sont figées par `numeriquesPostgrest.guard.test.ts`,
 * qui les compare au SCHÉMA RÉEL : une colonne `numeric` ajoutée en base sans
 * être ajoutée ici rouvre le trou en silence, et c'est exactement comme ça
 * qu'il a survécu à trois corrections.
 */

/** Colonnes `numeric` de `telemetry_sessions`. */
export const NUMERIQUES_SEANCE = [
  'max_speed_kmh',
  'max_g_lateral',
  'max_g_longitudinal',
  'distance_km',
  'best_lap_seconds',
  'avg_lap_seconds',
] as const;

/** Colonnes `numeric` de `laps`. */
export const NUMERIQUES_TOUR = [
  'duration_seconds',
  'max_speed_kmh',
  'avg_speed_kmh',
  'max_g_lateral',
  'max_g_braking',
  'max_g_accel',
  'distance_meters',
  'start_lat',
  'start_lon',
  'end_lat',
  'end_lon',
] as const;

/**
 * Convertit en nombres les colonnes nommées d'une ligne PostgREST.
 *
 * **Une valeur illisible devient `null`, jamais `NaN`.** `NaN` traverse les
 * gardes `!== null` sans broncher et ressort en « — », en trait de graphique
 * corrompu, ou en comparaison toujours fausse. `null` dit l'absence, et toutes
 * les lectures du dépôt savent la rendre.
 *
 * La ligne d'origine n'est jamais modifiée.
 *
 * ---
 *
 * Le paramètre de type est LIBRE (`<T>`) et non contraint à
 * `Record<string, unknown>` : les lignes Supabase arrivent typées
 * (`TelemetrySession`, `Lap`, une projection ad hoc), et exiger la contrainte
 * obligerait chaque appelant à élargir puis re-caster. Deux conversions au
 * lieu de zéro, dans du code dont le sujet EST une conversion mal faite.
 */
export function coerceNumeriques<T>(row: T, colonnes: readonly string[]): T {
  const converti: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const col of colonnes) {
    const v = converti[col];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    converti[col] = Number.isFinite(n) ? n : null;
  }
  return converti as T;
}

/** Une ligne `telemetry_sessions`, ses `numeric` en nombres. */
export function nombresDeSeance<T>(row: T): T {
  return coerceNumeriques(row, NUMERIQUES_SEANCE);
}

/** Une ligne `laps`, ses `numeric` en nombres. */
export function nombresDuTour<T>(row: T): T {
  return coerceNumeriques(row, NUMERIQUES_TOUR);
}

/**
 * Applique `nombresDeSeance` à une liste, en tolérant `null`/`undefined`.
 *
 * Les lectures Supabase rendent `data: T[] | null` ; ce raccourci évite que
 * chaque appelant réinvente le `?? []`, et surtout qu'un appelant l'oublie et
 * saute la conversion sur le chemin d'erreur.
 */
export function seancesEnNombres<T>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? []).map((r) => nombresDeSeance(r));
}
