/**
 * LES `numeric` DEVIENNENT DES NOMBRES. UNE FOIS, À LA FRONTIÈRE.
 *
 * ===========================================================================
 * LA PRÉMISSE D'ORIGINE A ÉTÉ REMESURÉE LE 01/09/2026 — ELLE EST FAUSSE
 * ===========================================================================
 *
 * Ce module affirmait, et vingt commentaires du dépôt le répètent après lui :
 * *« PostgREST sérialise `numeric` en CHAÎNE JSON, pour préserver la précision
 * décimale. »* Le brief exige qu'une affirmation de plus de deux semaines se
 * remesure. Elle l'a été, contre l'instance de production :
 *
 *     curl -H "apikey: <clé publiable>" ".../rest/v1/vehicules_eligibles?select=masse_kg&limit=2"
 *     → [{"masse_kg":1035.0}, {"masse_kg":1550.0}]
 *
 * `masse_kg` est un `numeric(6,1)`, `duration_seconds` un `numeric(7,3)` : même
 * type, même sérialisation. **Les nombres arrivent NON QUOTÉS.** PostgREST
 * construit son corps de réponse avec le JSON de PostgreSQL, et `to_json` d'un
 * `numeric` n'émet pas de guillemets.
 *
 * Ce qui voyage RÉELLEMENT en chaîne, et que la généralisation a englobé :
 * les paramètres de navigation (`finLogic.ts` le dit justement), et tout ce qui
 * transite par un stockage texte. Les défauts corrigés en août étaient réels ;
 * leur cause a été mal nommée, et le mauvais nom s'est propagé.
 *
 * ===========================================================================
 * POURQUOI CE MODULE RESTE, ET POURQUOI RIEN NE CHANGE
 * ===========================================================================
 *
 * Une coercition de frontière est juste quelle que soit la forme reçue :
 * `Number(92.5)` vaut `Number("92.5")`. Le comportement de l'application est
 * donc IDENTIQUE avant et après cette relecture — aucune ligne de code n'est
 * touchée, seule la raison change.
 *
 * Et elle garde une vertu que la prémisse fausse cachait : elle transforme une
 * valeur illisible en `null` plutôt qu'en `NaN`. `NaN` traverse les gardes
 * `!== null` sans broncher et ressort en « — », en trait corrompu, ou en
 * comparaison toujours fausse. `null` dit l'absence, et toutes les lectures du
 * dépôt savent la rendre.
 *
 * CE QU'IL NE FAUT PLUS FAIRE : diagnostiquer un défaut avec cette prémisse.
 * Deux constats de la recette du 30/08 ont été écrits ainsi — « la marge
 * globale ne s'affiche pas, `typeof === 'number'` échoue sur la chaîne
 * PostgREST » — et les deux étaient faux. Le fil affichait bien ses 60,4 %.
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
 * être ajoutée ici sort du champ de la conversion en silence.
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
