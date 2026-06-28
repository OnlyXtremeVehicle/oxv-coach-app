/**
 * Service Passeport — identité piste CUMULATIVE du pilote (PR-40).
 *
 * Agrège l'empreinte de pilotage sur les séances récentes (signature cumulée,
 * descriptive) + les faits d'identité (séances, circuits, ancienneté). Doctrine :
 * un portrait, jamais un rang ni un score. Réutilise computeSignature et
 * loadPilotStats. Aucune nouvelle table (zéro schéma).
 */

import { supabase } from '@/lib/supabase';
import {
  type PilotSignature,
  type SignatureSegmentInput,
  computeSignature,
} from '@/services/pilotSignatureService';
import { type PilotStats, loadPilotStats } from '@/services/statsService';

export interface Passport {
  stats: PilotStats;
  /** Empreinte cumulée (silhouette descriptive) sur les séances récentes. */
  signature: PilotSignature;
  /** Date de la première séance complétée (« membre depuis »). */
  memberSince: string | null;
  /** Nombre de circuits distincts visités. */
  circuitCount: number;
}

const RECENT_SESSIONS = 6;

export async function loadPassport(userId: string): Promise<Passport> {
  const stats = await loadPilotStats(userId);

  const { data: recent } = await supabase
    .from('telemetry_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(RECENT_SESSIONS);
  const ids = ((recent ?? []) as { id: string }[]).map((r) => r.id);

  let signature = computeSignature({ segments: [], lapTimesSeconds: [] });
  if (ids.length > 0) {
    const [segRes, lapRes] = await Promise.all([
      supabase
        .from('app_segment_analyses')
        .select(
          'segment_index, segment_name, kind, entry_speed_kmh, apex_speed_kmh, exit_speed_kmh, max_g_lateral, max_g_braking, margin_percent'
        )
        .in('telemetry_session_id', ids),
      supabase.from('laps').select('duration_seconds, is_outlap, is_inlap').in('session_id', ids),
    ]);
    const segments: SignatureSegmentInput[] = (
      (segRes.data ?? []) as Record<string, unknown>[]
    ).map((s) => ({
      segmentIndex: Number(s.segment_index),
      segmentName: (s.segment_name as string | null) ?? null,
      kind: (s.kind as string | null) ?? null,
      entrySpeedKmh: s.entry_speed_kmh != null ? Number(s.entry_speed_kmh) : null,
      apexSpeedKmh: s.apex_speed_kmh != null ? Number(s.apex_speed_kmh) : null,
      exitSpeedKmh: s.exit_speed_kmh != null ? Number(s.exit_speed_kmh) : null,
      maxGLateral: s.max_g_lateral != null ? Number(s.max_g_lateral) : null,
      maxGBraking: s.max_g_braking != null ? Number(s.max_g_braking) : null,
      marginPercent: s.margin_percent != null ? Number(s.margin_percent) : null,
    }));
    const lapTimesSeconds = ((lapRes.data ?? []) as Record<string, unknown>[])
      .filter((l) => !l.is_outlap && !l.is_inlap)
      .map((l) => Number(l.duration_seconds))
      .filter((n) => Number.isFinite(n) && n > 0);
    signature = computeSignature({ segments, lapTimesSeconds });
  }

  const { data: first } = await supabase
    .from('telemetry_sessions')
    .select('started_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const memberSince = (first as { started_at?: string } | null)?.started_at ?? null;

  return {
    stats,
    signature,
    memberSince,
    circuitCount: Object.keys(stats.byCircuit).length,
  };
}
