/**
 * Service Admin — Analyse session : diagnostic + relance de pipeline (PR-83).
 *
 * DIAGNOSTIC (lecture) : agrège, pour une session, l'état réel du pipeline à
 * partir des tables existantes (telemetry_sessions, app_session_analyses,
 * app_segment_analyses, session_insights, laps). Aucune table de diagnostic —
 * zéro schéma. Admin-only (RLS `is_admin()` sur ces tables).
 *
 * RELANCE (écriture) : ne réécrit rien côté client. Délègue aux edge functions
 * serveur (service_role), qui sont la SEULE voie autorisée à recalculer pour le
 * compte d'un autre pilote :
 *   - compute-session-insights  : recalcule les lectures (session_insights).
 *   - generate-debrief-ai       : régénère le débrief (garde-fou doctrinal côté
 *                                 edge ; peut refuser si opt-out IA du pilote).
 *   - cron-analyze-pending-sessions : relance le calcul des marges en attente.
 */

import { supabase } from '@/lib/supabase';

export interface SessionDiagnostic {
  sessionId: string;
  userId: string;
  name: string | null;
  circuitName: string | null;
  startedAt: string;
  status: string;
  totalFrames: number | null;
  lapCount: number;
  segmentCount: number;
  insightCount: number;
  hasAnalysis: boolean;
  marginGlobal: number | null;
  marginZone: string | null;
  algoVersion: string | null;
  computedAt: string | null;
  hasDebrief: boolean;
  debriefChars: number;
}

type CountTable = 'laps' | 'app_segment_analyses' | 'session_insights';

async function countRows(table: CountTable, column: string, value: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column as never, value);
  if (error) {
    console.warn(`[OXV][admin] count ${table} :`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Charge l'état complet du pipeline pour une session. Admin-only. */
export async function loadSessionDiagnostic(sessionId: string): Promise<SessionDiagnostic | null> {
  const { data: session, error } = await supabase
    .from('telemetry_sessions')
    .select('id, user_id, name, circuit_name, started_at, status, total_frames')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session) {
    if (error) console.warn('[OXV][admin] loadSessionDiagnostic :', error.message);
    return null;
  }

  const { data: analysis } = await supabase
    .from('app_session_analyses')
    .select('margin_global, margin_zone, algo_version, computed_at, debrief_text')
    .eq('telemetry_session_id', sessionId)
    .maybeSingle();

  const [lapCount, segmentCount, insightCount] = await Promise.all([
    countRows('laps', 'session_id', sessionId),
    countRows('app_segment_analyses', 'telemetry_session_id', sessionId),
    countRows('session_insights', 'telemetry_session_id', sessionId),
  ]);

  const a = analysis as Record<string, unknown> | null;
  const debrief = ((a?.debrief_text as string | null) ?? '').trim();

  return {
    sessionId: session.id,
    userId: session.user_id,
    name: session.name ?? null,
    circuitName: session.circuit_name ?? null,
    startedAt: session.started_at,
    status: session.status,
    totalFrames: session.total_frames ?? null,
    lapCount,
    segmentCount,
    insightCount,
    hasAnalysis: a != null && a.margin_global != null,
    marginGlobal: (a?.margin_global as number | null) ?? null,
    marginZone: (a?.margin_zone as string | null) ?? null,
    algoVersion: (a?.algo_version as string | null) ?? null,
    computedAt: (a?.computed_at as string | null) ?? null,
    hasDebrief: debrief.length > 0,
    debriefChars: debrief.length,
  };
}

export interface RelaunchResult {
  ok: boolean;
  message: string;
}

/** Recalcule les lectures (session_insights) côté serveur pour cette session. */
export async function relaunchInsights(sessionId: string): Promise<RelaunchResult> {
  const { error } = await supabase.functions.invoke('compute-session-insights', {
    body: { sessionId },
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: 'Lectures recalculées (serveur).' };
}

/**
 * Régénère le débrief IA pour cette session. L'edge applique le garde-fou
 * doctrinal et peut refuser (opt-out IA du pilote, ou sortie non conforme) :
 * dans ce cas le message le reflète, rien n'est écrit.
 */
export async function relaunchDebrief(sessionId: string): Promise<RelaunchResult> {
  const { error } = await supabase.functions.invoke('generate-debrief-ai', {
    body: { sessionId },
  });
  if (error) {
    return {
      ok: false,
      message: `Refus ou erreur : ${error.message}. Le débrief local descriptif reste la source.`,
    };
  }
  return { ok: true, message: 'Débrief régénéré.' };
}

/**
 * Relance le balayage serveur des sessions completed sans marge persistée
 * (cron-analyze-pending-sessions). Traitement par lot : rattrape cette session
 * si elle est en attente, ainsi que les autres.
 */
export async function relaunchPendingAnalysis(): Promise<RelaunchResult> {
  const { data, error } = await supabase.functions.invoke('cron-analyze-pending-sessions', {});
  if (error) {
    return { ok: false, message: error.message };
  }
  const d = data as { processed?: number; successful?: number } | null;
  const n = d?.successful ?? 0;
  return { ok: true, message: `Analyse en attente relancée : ${n} session(s) traitée(s).` };
}
