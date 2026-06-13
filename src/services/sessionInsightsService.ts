/**
 * Lecture des insights d'une session (table `session_insights`).
 *
 * Renvoie la dernière ligne d'insights pour une session de télémétrie, ou null
 * si aucune n'existe encore (cas courant tant que `telemetry_frames` est vide,
 * avant Valence). La ligne de démo `mirror-insights-demo` (7 virages) est
 * renvoyée telle quelle pour la session Haute Saintonge de démonstration.
 */

import { supabase } from '@/lib/supabase';
import type {
  AnatomyCorner,
  CornerRecord,
  DataQuality,
  IdealLap,
  SessionInsights,
} from '@/circuit/sessionInsights';

export async function fetchSessionInsights(
  telemetrySessionId: string
): Promise<SessionInsights | null> {
  const { data, error } = await supabase
    .from('session_insights')
    .select(
      'telemetry_session_id, user_id, engine_version, n_laps, n_frames, anatomy, dispersion, chassis_balance, load_transfer, ideal_lap, data_quality'
    )
    .eq('telemetry_session_id', telemetrySessionId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Les colonnes JSONB arrivent en `Json` ; on les rattache aux formes du contrat.
  return {
    telemetry_session_id: data.telemetry_session_id,
    user_id: data.user_id ?? 'unknown',
    engine_version: data.engine_version ?? '',
    n_laps: data.n_laps ?? 0,
    n_frames: data.n_frames ?? 0,
    anatomy: (data.anatomy as unknown as AnatomyCorner[] | null) ?? null,
    dispersion: (data.dispersion as unknown as CornerRecord | null) ?? null,
    chassis_balance: (data.chassis_balance as unknown as CornerRecord | null) ?? null,
    load_transfer: (data.load_transfer as unknown as CornerRecord | null) ?? null,
    ideal_lap: (data.ideal_lap as unknown as IdealLap | null) ?? null,
    data_quality: (data.data_quality as unknown as DataQuality | null) ?? null,
  };
}
