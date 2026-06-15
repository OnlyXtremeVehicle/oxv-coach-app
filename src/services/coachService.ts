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
import { type MarginZone } from '@/types/domain';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';

export interface SessionSnapshot {
  sessionId: string;
  startedAt: string;
  marginGlobal: number | null;
  marginZone: MarginZone | null;
  bestLapSeconds: number | null;
  lapCount: number | null;
  trajectory: { lat: number; lon: number; speed: number | null }[];
  zoneByIndex: Record<number, MarginZone>;
  marginByIndex: Record<number, number>;
}

/**
 * Charge en parallèle la trajectoire GPS et les zones de marge par virage
 * pour une session donnée. Utilisé par la vue coach comparative pour
 * afficher 2 cartes côte à côte.
 *
 * RLS : le coach voit les `telemetry_frames` et `app_segment_analyses` du
 * pilote suivi grâce aux policies *_coach_select définies en migration
 * 0016 (sem 15).
 */
export async function loadSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
  const [sessionResult, framesResult, zonesResult] = await Promise.all([
    supabase
      .from('telemetry_sessions')
      .select(
        'id, started_at, best_lap_seconds, lap_count, app_session_analyses(margin_global, margin_zone)'
      )
      .eq('id', sessionId)
      .maybeSingle(),
    supabase
      .from('telemetry_frames')
      .select('latitude, longitude, speed_kmh')
      .eq('session_id', sessionId)
      .order('elapsed_ms', { ascending: true })
      .limit(1000),
    getCornerMarginsZones(sessionId),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    if (sessionResult.error) {
      console.warn('[OXV][coach] loadSessionSnapshot session :', sessionResult.error.message);
    }
    return null;
  }
  if (framesResult.error) {
    console.warn('[OXV][coach] loadSessionSnapshot frames :', framesResult.error.message);
  }

  const row = sessionResult.data as Record<string, unknown>;
  const analysisJoined = row.app_session_analyses as
    | { margin_global?: number | null; margin_zone?: string | null }[]
    | { margin_global?: number | null; margin_zone?: string | null }
    | null;
  const firstAnalysis = Array.isArray(analysisJoined) ? analysisJoined[0] : analysisJoined;

  const framesData = (framesResult.data ?? []) as {
    latitude: number | null;
    longitude: number | null;
    speed_kmh: number | null;
  }[];
  const trajectory = framesData
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      lat: Number(p.latitude),
      lon: Number(p.longitude),
      speed: p.speed_kmh !== null ? Number(p.speed_kmh) : null,
    }));

  return {
    sessionId: row.id as string,
    startedAt: row.started_at as string,
    marginGlobal:
      firstAnalysis?.margin_global !== null && firstAnalysis?.margin_global !== undefined
        ? Number(firstAnalysis.margin_global)
        : null,
    marginZone: (firstAnalysis?.margin_zone as MarginZone | null | undefined) ?? null,
    bestLapSeconds: row.best_lap_seconds !== null ? Number(row.best_lap_seconds) : null,
    lapCount: row.lap_count !== null ? Number(row.lap_count) : null,
    trajectory,
    zoneByIndex: zonesResult?.zones ?? {},
    marginByIndex: zonesResult?.numeric ?? {},
  };
}

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
 * Loggue un accès coach aux données pilote dans admin_audit, en
 * fire-and-forget (n'attend pas, ne bloque pas la requête principale).
 *
 * Délègue à la fonction Postgres `log_coach_view` qui vérifie elle-même
 * que l'appelant est bien coach actif et consenti — un user lambda ne
 * peut donc pas bombarder les logs avec de faux events.
 */
export function logCoachView(
  targetPilotId: string,
  options?: { sessionId?: string; subtype?: string }
): void {
  supabase
    .rpc('log_coach_view', {
      target_pilot_uuid: targetPilotId,
      action_subtype: options?.subtype ?? 'coach_view',
      target_session_uuid: options?.sessionId ?? undefined,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn('[OXV][coach] logCoachView :', error.message);
    });
}

/**
 * Liste les sessions d'un pilote spécifique (filtrées par RLS coach).
 * Joint app_session_analyses pour avoir la marge globale d'un coup.
 * Loggue l'accès dans admin_audit (fire-and-forget).
 */
export async function listPilotSessions(pilotId: string): Promise<PilotSessionSummary[]> {
  logCoachView(pilotId, { subtype: 'coach_view_sessions' });

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

// ============================================================================
// Dashboard coach — synthèse pour le hub
// ============================================================================

export interface CoachDashboardSummary {
  pilotCount: number;
  /** Sessions complétées des pilotes suivis dans les N derniers jours. */
  recentSessionCount: number;
  recentSessionsDays: number;
  /** Sessions des pilotes suivis dans les dernières 24h (alertes). */
  lastDaySessionCount: number;
  /** Annotations brouillon du coach (non partagées avec le pilote). */
  draftAnnotationCount: number;
  /** Annotations partagées par le coach (cumulé, depuis toujours). */
  sharedAnnotationCount: number;
}

/**
 * Charge la synthèse du dashboard coach en parallèle. Best-effort : si
 * une requête échoue, on renvoie 0 plutôt que faire planter le hub.
 *
 * RLS appliqué :
 *   - `coach_pilots_view` filtre déjà sur coach_id = auth.uid()
 *   - `telemetry_sessions` policy coach_select autorise les sessions des
 *     pilotes suivis
 *   - `coach_annotations` policy coach FOR ALL autorise les notes propres
 */
export async function loadCoachDashboardSummary(): Promise<CoachDashboardSummary> {
  const recentDays = 7;
  const since7d = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
  const since1d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Pilotes assignés (via vue, RLS-filtered)
  const pilotsPromise = supabase
    .from('coach_pilots_view')
    .select('pilot_id', { count: 'exact', head: true });

  // 2. IDs pilotes pour requêter leurs sessions ensuite
  const pilotIdsPromise = supabase.from('coach_pilots_view').select('pilot_id');

  const [pilotsResult, pilotIdsResult] = await Promise.all([pilotsPromise, pilotIdsPromise]);

  const pilotIds = (pilotIdsResult.data ?? []).map(
    (r: Record<string, unknown>) => r.pilot_id as string
  );

  if (pilotIds.length === 0) {
    return {
      pilotCount: pilotsResult.count ?? 0,
      recentSessionCount: 0,
      recentSessionsDays: recentDays,
      lastDaySessionCount: 0,
      draftAnnotationCount: 0,
      sharedAnnotationCount: 0,
    };
  }

  // 3. Sessions 7j (count) + 24h (count) en parallèle
  const recent7dPromise = supabase
    .from('telemetry_sessions')
    .select('id', { count: 'exact', head: true })
    .in('user_id', pilotIds)
    .eq('status', 'completed')
    .gte('started_at', since7d);

  const recent1dPromise = supabase
    .from('telemetry_sessions')
    .select('id', { count: 'exact', head: true })
    .in('user_id', pilotIds)
    .eq('status', 'completed')
    .gte('started_at', since1d);

  // 4. Annotations brouillon + partagées du coach (cast `as never` car
  // database.types n'a pas encore coach_annotations)
  const draftsPromise = supabase
    .from('coach_annotations')
    .select('id', { count: 'exact', head: true })
    .eq('visibility', 'private')
    .is('deleted_at', null);

  const sharedPromise = supabase
    .from('coach_annotations')
    .select('id', { count: 'exact', head: true })
    .eq('visibility', 'shared')
    .is('deleted_at', null);

  const [recent7d, recent1d, drafts, shared] = await Promise.all([
    recent7dPromise,
    recent1dPromise,
    draftsPromise,
    sharedPromise,
  ]);

  return {
    pilotCount: pilotsResult.count ?? 0,
    recentSessionCount: recent7d.count ?? 0,
    recentSessionsDays: recentDays,
    lastDaySessionCount: recent1d.count ?? 0,
    draftAnnotationCount: drafts.count ?? 0,
    sharedAnnotationCount: shared.count ?? 0,
  };
}
