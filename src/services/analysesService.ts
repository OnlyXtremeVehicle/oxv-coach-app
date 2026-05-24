/**
 * Lecture / écriture de `app_session_analyses` — résultat de marge composite.
 *
 * Pattern V1 : compute à la volée côté client (marginCalculator), upsert en
 * base via `upsertAnalysis()` puis lecture rapide via `getAnalysisForSession()`
 * à la prochaine ouverture du bilan. Une seule analyse par session
 * (contrainte UNIQUE).
 */

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';
import type { MarginZone } from '@/types/domain';

import type { ComputeMarginOutput } from './marginCalculator';

export interface SessionAnalysis {
  id: string;
  telemetrySessionId: string;
  userId: string;
  marginGlobal: number;
  marginZone: MarginZone | null;
  marginVehicle: number | null;
  marginPilot: number | null;
  breakdown: Record<string, number> | null;
  nextFocusCornerIndex: number | null;
  nextFocusPhrase: string | null;
  debriefText: string | null;
  algoVersion: string;
  computedAt: string;
}

interface AnalysisRow {
  id: string;
  telemetry_session_id: string;
  user_id: string;
  margin_global: number | null;
  margin_zone: string | null;
  margin_vehicle: number | null;
  margin_pilot: number | null;
  margin_breakdown: Json | null;
  next_focus_corner_index: number | null;
  next_focus_phrase: string | null;
  debrief_text: string | null;
  algo_version: string;
  computed_at: string;
}

export async function getAnalysisForSession(
  telemetrySessionId: string
): Promise<SessionAnalysis | null> {
  const { data, error } = await supabase
    .from('app_session_analyses')
    .select(
      'id, telemetry_session_id, user_id, margin_global, margin_zone, margin_vehicle, margin_pilot, margin_breakdown, next_focus_corner_index, next_focus_phrase, debrief_text, algo_version, computed_at'
    )
    .eq('telemetry_session_id', telemetrySessionId)
    .maybeSingle();

  if (error) {
    console.warn('[OXV] getAnalysisForSession :', error.message);
    return null;
  }
  if (!data) return null;
  return mapRow(data as AnalysisRow);
}

export async function upsertAnalysis(input: {
  telemetrySessionId: string;
  userId: string;
  result: ComputeMarginOutput;
}): Promise<SessionAnalysis | null> {
  const { data, error } = await supabase
    .from('app_session_analyses')
    .upsert(
      {
        telemetry_session_id: input.telemetrySessionId,
        user_id: input.userId,
        margin_global: input.result.marginGlobal,
        margin_zone: input.result.marginZone,
        margin_vehicle: input.result.marginVehicle,
        margin_pilot: input.result.marginPilot,
        margin_breakdown: input.result.breakdown as unknown as Json,
        algo_version: 'v1.0',
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'telemetry_session_id' }
    )
    .select(
      'id, telemetry_session_id, user_id, margin_global, margin_zone, margin_vehicle, margin_pilot, margin_breakdown, next_focus_corner_index, next_focus_phrase, debrief_text, algo_version, computed_at'
    )
    .single();

  if (error) {
    console.warn('[OXV] upsertAnalysis :', error.message);
    return null;
  }
  return mapRow(data as AnalysisRow);
}

function mapRow(row: AnalysisRow): SessionAnalysis {
  const breakdown =
    row.margin_breakdown &&
    typeof row.margin_breakdown === 'object' &&
    !Array.isArray(row.margin_breakdown)
      ? (row.margin_breakdown as Record<string, number>)
      : null;

  return {
    id: row.id,
    telemetrySessionId: row.telemetry_session_id,
    userId: row.user_id,
    marginGlobal: Number(row.margin_global ?? 0),
    marginZone: (row.margin_zone as MarginZone) ?? null,
    marginVehicle: row.margin_vehicle !== null ? Number(row.margin_vehicle) : null,
    marginPilot: row.margin_pilot !== null ? Number(row.margin_pilot) : null,
    breakdown,
    nextFocusCornerIndex: row.next_focus_corner_index,
    nextFocusPhrase: row.next_focus_phrase,
    debriefText: row.debrief_text,
    algoVersion: row.algo_version,
    computedAt: row.computed_at,
  };
}
