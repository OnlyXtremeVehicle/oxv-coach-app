/**
 * Base de temps MONOTONE (Valencia §4.6).
 *
 * Certaines mesures de durée intra-session (chronos de tours) ne peuvent pas se
 * fier à l'horloge murale `Date.now()` : throttling en arrière-plan, resynchro
 * NTP ou saut d'horloge peuvent la faire RECULER entre deux lectures, ce qui
 * fausse — voire rend négatives — les durées calculées par simple différence.
 *
 * Ce helper applique la MÊME convention que l'`elapsed_ms` des trames dans
 * `captureSessionService` : on ne retient jamais une valeur inférieure à la
 * précédente. La suite des valeurs retournées est donc NON DÉCROISSANTE, et la
 * DIFFÉRENCE de deux instants monotones est toujours ≥ 0 — jamais faussée par un
 * recul d'horloge.
 */

/**
 * Avance une base de temps monotone : renvoie le max entre la lecture murale et
 * le dernier point retenu (jamais un recul). Fonction PURE, sans état interne :
 * l'appelant conserve `lastMono` et le repasse au tour suivant.
 *
 * @param lastMono Dernière valeur monotone retenue (0 à l'armement).
 * @param wallNow  Lecture d'horloge murale courante (`Date.now()`).
 * @returns La nouvelle valeur monotone, ≥ `lastMono`.
 */
export function nextMonotonic(lastMono: number, wallNow: number): number {
  return Math.max(wallNow, lastMono);
}
