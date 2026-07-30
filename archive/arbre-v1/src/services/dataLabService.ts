/**
 * dataLabService — assemble une vue d'ensemble d'une session pour le Data Lab
 * (§4.2, §24). Au lieu que chaque écran-feuille (carte, virages, tours…) découvre
 * seul ce qui est disponible, cet agrégateur dit, en un appel, ce que la session
 * contient et quelles couches sont activables — avec un état vide HONNÊTE quand il
 * n'y a pas encore de matière (doctrine : ne jamais maquiller l'absence).
 *
 * N'introduit aucune table : lit `telemetry_sessions` (total_frames), les tours et
 * les analyses de segment déjà persistés. Les écrans-feuilles gardent leurs propres
 * fetchs — cet agrégateur ne les remplace pas, il les éclaire. La dérivation des
 * couches/état vide vit dans `dataLabLogic` (pure, testée).
 */

import { supabase } from '@/lib/supabase';
import { type DataLabAvailability, deriveDataLabAvailability } from '@/services/dataLabLogic';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';

export type { DataLabLayer, DataLabLayerKey } from '@/services/dataLabLogic';

export interface DataLabSessionView extends DataLabAvailability {
  sessionId: string;
  found: boolean;
  sessionName: string | null;
  circuitName: string | null;
  frameCount: number;
  validLapCount: number;
  cornerCount: number;
}

/**
 * Assemble la vue Data Lab d'une session. Best-effort : si une lecture échoue,
 * on dégrade proprement (compteur à 0) plutôt que de jeter.
 */
export async function getDataLabSessionView(sessionId: string): Promise<DataLabSessionView> {
  const { data: s } = await supabase
    .from('telemetry_sessions')
    .select('id, name, circuit_name, total_frames')
    .eq('id', sessionId)
    .maybeSingle();

  const found = Boolean(s);
  const frameCount = (s?.total_frames as number | null) ?? 0;

  const [laps, corners] = await Promise.all([
    fetchSessionLaps(sessionId).catch(() => []),
    listSegmentAnalysesForSession(sessionId).catch(() => []),
  ]);
  const validLapCount = laps.filter((l) => !l.is_outlap && !l.is_inlap).length;
  const cornerCount = corners.length;

  const { layers, emptyReason } = deriveDataLabAvailability({
    found,
    frameCount,
    validLapCount,
    cornerCount,
  });

  return {
    sessionId,
    found,
    sessionName: (s?.name as string | null) ?? null,
    circuitName: (s?.circuit_name as string | null) ?? null,
    frameCount,
    validLapCount,
    cornerCount,
    layers,
    emptyReason,
  };
}
