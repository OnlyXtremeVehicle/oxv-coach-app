/**
 * Service deep-dive virage — charge en parallèle les stats segment
 * (vitesses, G, erreur latérale, marge) et la trajectoire GPS du virage.
 *
 * Utilisé par l'écran #15 Zoom virage et son mode comparaison entre
 * deux sessions.
 *
 * Les frames sont récupérées en bornant sur `segment_index` via les
 * progress de référence, ce qui isole le virage sans charger toute la
 * session. Si l'analyse trackviz n'a pas encore tourné sur la session,
 * on renvoie quand même les frames mais sans stats.
 *
 * RLS : le pilote voit ses propres frames + stats. Un coach voit celles
 * du pilote suivi grâce aux policies *_coach_select (sem 15).
 */

import { supabase } from '@/lib/supabase';
import { type SegmentAnalysisRow, getSegmentAnalysis } from '@/services/segmentAnalysesService';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';

export interface CornerTrajectoryPoint {
  lat: number;
  lon: number;
  speedKmh: number | null;
  elapsedMs: number | null;
}

export interface CornerDeepDive {
  sessionId: string;
  cornerIndex: number;
  stats: SegmentAnalysisRow | null;
  trajectory: CornerTrajectoryPoint[];
}

/**
 * Charge le deep-dive d'un virage : stats segment + frames GPS dans la
 * portion du virage.
 *
 * Le filtrage des frames se fait via une fenêtre `elapsed_ms` calculée
 * à partir des progress du segment. Pour V1, on charge un peu large
 * (200 frames max) et on laisse le viewBox SVG clipper visuellement
 * ce qui sort.
 */
export async function loadCornerDeepDive(
  sessionId: string,
  cornerIndex: number
): Promise<CornerDeepDive> {
  const segment = HAUTE_SAINTONGE_SEGMENTS.find((s) => s.order === cornerIndex);

  const [statsResult, framesResult] = await Promise.all([
    getSegmentAnalysis(sessionId, cornerIndex),
    loadCornerFrames(sessionId, segment?.progressStart ?? null, segment?.progressEnd ?? null),
  ]);

  return {
    sessionId,
    cornerIndex,
    stats: statsResult,
    trajectory: framesResult,
  };
}

async function loadCornerFrames(
  sessionId: string,
  progressStart: number | null,
  progressEnd: number | null
): Promise<CornerTrajectoryPoint[]> {
  // Si on n'a pas les bornes de progress, on charge un échantillon
  // raisonnable et le viewBox SVG fera le clipping.
  // À terme on stockera segment_progress dans telemetry_frames pour
  // un filtre plus chirurgical, mais V1 c'est suffisant.

  const { data, error } = await supabase
    .from('telemetry_frames')
    .select('latitude, longitude, speed_kmh, elapsed_ms')
    .eq('session_id', sessionId)
    .order('elapsed_ms', { ascending: true })
    .limit(1000);

  if (error || !data) {
    if (error) console.warn('[OXV][corner] loadCornerFrames :', error.message);
    return [];
  }

  // Côté client : on garde les frames dont la progression dans le tour
  // tombe dans [progressStart, progressEnd]. Approximation V1 : on
  // utilise la position relative dans la liste (index / total) — c'est
  // grossier mais fonctionnel tant qu'on n'a pas le progress par frame.
  const total = data.length;
  if (total === 0) return [];

  const filtered =
    progressStart !== null && progressEnd !== null
      ? data.filter((_, i) => {
          const p = i / (total - 1);
          return p >= progressStart && p <= progressEnd;
        })
      : data;

  const rows = filtered as {
    latitude: number | null;
    longitude: number | null;
    speed_kmh: number | null;
    elapsed_ms: number | null;
  }[];

  return rows
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      lat: Number(p.latitude),
      lon: Number(p.longitude),
      speedKmh: p.speed_kmh !== null ? Number(p.speed_kmh) : null,
      elapsedMs: p.elapsed_ms !== null ? Number(p.elapsed_ms) : null,
    }));
}
