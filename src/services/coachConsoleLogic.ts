/**
 * Console de direction coach — logique pure (P4, VISION_COACH_STUDIO.md).
 *
 * Décision C1 : AUCUN classement inter-pilotes. La console montre l'état de
 * CHAQUE pilote comparé à SA propre séance précédente — jamais à un autre.
 * `computeSelfTrend` est directionnel et FACTUEL (marge en hausse/baisse/stable),
 * pas un verdict « meilleur/moins bon ». Pur, testé.
 */

export type SelfTrend = 'up' | 'down' | 'flat' | null;

/**
 * Tendance de la marge globale entre la dernière séance et la précédente DU
 * MÊME pilote. `null` si l'une des deux manque (honnêteté). `epsilon` = seuil
 * en points sous lequel on considère stable.
 */
export function computeSelfTrend(
  last: number | null,
  previous: number | null,
  epsilon = 1
): SelfTrend {
  if (last == null || previous == null || !Number.isFinite(last) || !Number.isFinite(previous)) {
    return null;
  }
  const delta = last - previous;
  if (Math.abs(delta) < epsilon) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/** Garde la séance la plus récente par pilote à partir d'une liste triée desc. */
export function latestPerPilot<T extends { userId: string }>(
  rowsDescByDate: T[]
): Map<string, T[]> {
  const byPilot = new Map<string, T[]>();
  for (const row of rowsDescByDate) {
    const list = byPilot.get(row.userId) ?? [];
    list.push(row);
    byPilot.set(row.userId, list);
  }
  return byPilot;
}
