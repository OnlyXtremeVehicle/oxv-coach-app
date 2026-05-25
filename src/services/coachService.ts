/**
 * Service coach — lecture des pilotes assignés et de leurs sessions.
 *
 * Toutes les requêtes passent par les RLS Supabase (cf. migration 0016) :
 *   - `coach_pilots_view` filtre déjà sur `coach_id = auth.uid()` ET
 *     `pilot_consent_at IS NOT NULL`
 *   - `telemetry_sessions` policy `telemetry_sessions_coach_select` autorise
 *     SELECT via `is_coach_of(user_id)`
 *
 * Aucune écriture côté coach (lecture seule par doctrine — un coach ne
 * modifie jamais les données du pilote).
 */

import { supabase } from '@/lib/supabase';

export interface CoachPilotRow {
  pilotId: string;
  firstName: string | null;
  lastName: string | null;
  pilotLevel: string | null;
  avatarUrl: string | null;
  assignmentId: string;
  assignedAt: string;
  pilotConsentAt: string | null;
  notes: string | null;
}

export interface PilotSessionSummary {
  id: string;
  startedAt: string;
  circuitName: string | null;
  lapCount: number | null;
  bestLapSeconds: number | null;
  durationSeconds: number | null;
  /** Marge globale issue de app_session_analyses, ou null si pas encore analysée. */
  marginGlobal: number | null;
  marginZone: 'green' | 'yellow' | 'red' | null;
}

/**
 * Liste les pilotes assignés au coach courant, déjà filtrés par RLS sur
 * `coach_pilots_view` (only consented, only active).
 */
export async function listMyPilots(): Promise<CoachPilotRow[]> {
  const { data, error } = await supabase
    .from('coach_pilots_view')
    .select(
      'pilot_id, first_name, last_name, pilot_level, avatar_url, assignment_id, assigned_at, pilot_consent_at, notes'
    )
    .order('assigned_at', { ascending: false });

  if (error) {
    console.warn('[OXV][coach] listMyPilots :', error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    pilotId: row.pilot_id as string,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    pilotLevel: (row.pilot_level as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    assignmentId: row.assignment_id as string,
    assignedAt: row.assigned_at as string,
    pilotConsentAt: (row.pilot_consent_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }));
}

/**
 * Liste les sessions d'un pilote spécifique (filtrées par RLS coach).
 * Joint app_session_analyses pour avoir la marge globale d'un coup.
 */
export async function listPilotSessions(pilotId: string): Promise<PilotSessionSummary[]> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select(
      'id, started_at, circuit_name, lap_count, best_lap_seconds, duration_seconds, status, app_session_analyses(margin_global, margin_zone)'
    )
    .eq('user_id', pilotId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[OXV][coach] listPilotSessions :', error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const analysisJoined = row.app_session_analyses as
      | { margin_global?: number | null; margin_zone?: string | null }[]
      | { margin_global?: number | null; margin_zone?: string | null }
      | null;
    const firstAnalysis = Array.isArray(analysisJoined) ? analysisJoined[0] : analysisJoined;
    return {
      id: row.id as string,
      startedAt: row.started_at as string,
      circuitName: (row.circuit_name as string | null) ?? null,
      lapCount: (row.lap_count as number | null) ?? null,
      bestLapSeconds: (row.best_lap_seconds as number | null) ?? null,
      durationSeconds: (row.duration_seconds as number | null) ?? null,
      marginGlobal:
        firstAnalysis?.margin_global !== null && firstAnalysis?.margin_global !== undefined
          ? Number(firstAnalysis.margin_global)
          : null,
      marginZone:
        (firstAnalysis?.margin_zone as 'green' | 'yellow' | 'red' | null | undefined) ?? null,
    };
  });
}
