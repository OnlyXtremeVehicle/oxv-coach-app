/**
 * Smart Flagging coach — chargement (Studio Coach).
 *
 * Charge les analyses par segment d'une séance (via segmentAnalysesService,
 * RLS : le coach voit celles du pilote suivi consenti) et applique le triage
 * factuel `rankTriageCorners`. Mince : toute la logique est pure et testée.
 */

import { rankTriageCorners, type TriageCorner, type TriageZone } from '@/services/coachTriageLogic';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';

/** Les virages à regarder en priorité pour une séance (les plus serrés). */
export async function getSessionTriage(
  telemetrySessionId: string,
  limit = 3
): Promise<TriageCorner[]> {
  // Le triage rend une liste : une panne y devient une liste vide, comme
  // avant le 01/09. C'est l'appelant qui affiche « en attente ».
  const segments = await listSegmentAnalysesForSession(telemetrySessionId).catch(() => []);
  return rankTriageCorners(
    segments.map((s) => ({
      segmentIndex: s.segmentIndex,
      segmentName: s.segmentName,
      marginPercent: s.marginPercent,
      marginZone: s.marginZone as TriageZone,
    })),
    limit
  );
}
