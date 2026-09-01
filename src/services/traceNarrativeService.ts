/**
 * OXV Trace — chargement de la « Trace du jour » (V9 §6).
 *
 * Fin et best-effort : assemble les sources DÉJÀ en base (session, tours,
 * segments, insights, fil du circuit, carnet) et délègue toute la mise en récit
 * à `assembleTraceOfDay` (logique pure, testable). Aucune écriture, aucune IA.
 *
 * Le fil du circuit (soi contre soi) et le ressenti ne sont lus que pour le
 * pilote PROPRIÉTAIRE : le carnet est own-row strict (doctrine), un coach en
 * lecture seule n'y accède pas.
 */

import { supabase } from '@/lib/supabase';
import type { TelemetrySession } from '@/types/telemetry';

import { computeDataConfidence } from './dataConfidenceLogic';
import { getIntentionForSession, type SessionIntention } from './intentionsService';
import { computeKeyMoments } from './keyMomentsLogic';
import { listMyNotes, type PilotNote } from './pilotNotesService';
import { computeRegularity } from './regularityService';
import { listSegmentAnalysesForSession } from './segmentAnalysesService';
import { fetchSessionInsights } from './sessionInsightsService';
import { fetchPreviousSessions, fetchSessionLaps } from './sessionsService';
import { assembleTraceOfDay, type TraceOfDay } from './traceNarrativeLogic';

export interface TraceOfDayResult {
  session: TelemetrySession;
  trace: TraceOfDay;
  /** L'intention posée avant la séance, à juxtaposer (le pilote conclut). */
  intention: SessionIntention | null;
  /** Le ressenti écrit après la séance (note de carnet liée), s'il existe. */
  ressenti: PilotNote | null;
}

/** Session cible : celle passée en param, sinon la dernière séance terminée. */
async function loadSession(
  userId: string,
  sessionId: string | undefined
): Promise<TelemetrySession | null> {
  if (sessionId) {
    const { data } = await supabase
      .from('telemetry_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    return (data as TelemetrySession | null) ?? null;
  }
  const { data } = await supabase
    .from('telemetry_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TelemetrySession | null) ?? null;
}

export async function loadTraceOfDay(
  userId: string,
  sessionId?: string
): Promise<TraceOfDayResult | null> {
  const session = await loadSession(userId, sessionId);
  if (!session) return null;

  const [laps, segments, insights, intention] = await Promise.all([
    fetchSessionLaps(session.id),
    listSegmentAnalysesForSession(session.id),
    fetchSessionInsights(session.id),
    getIntentionForSession(session.id),
  ]);

  const reg = computeRegularity(
    laps
      .filter((l) => !l.is_outlap && !l.is_inlap)
      .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
  );

  const keyMoments = computeKeyMoments({
    laps: laps.map((l) => ({
      lapNumber: l.lap_number,
      durationSeconds: l.duration_seconds,
      isOutlap: l.is_outlap,
      isInlap: l.is_inlap,
    })),
    segments: segments.map((sg) => ({
      segmentIndex: sg.segmentIndex,
      segmentName: sg.segmentName,
      maxGLateral: sg.maxGLateral,
    })),
    // `telemetry_sessions.max_g_lateral` : le maximum de la séance entière,
    // écrit par la capture. Repli quand aucun segment n'est analysé.
    gLateralMaxSeance: session.max_g_lateral ?? null,
  });

  const dq = insights?.data_quality;
  const confidence = computeDataConfidence(
    dq
      ? {
          pctValid: dq.pct_valid,
          framesUsed: dq.frames_used,
          cornersDetected: dq.corners_detected,
          lapsValid: dq.laps_detected,
        }
      : null
  );

  const isOwner = session.user_id === userId;

  // Fil du circuit (soi contre soi) — propriétaire seulement.
  let sessionsHere = 1;
  if (isOwner) {
    const previous = await fetchPreviousSessions(userId, session.circuit_id, 8, session.id);
    sessionsHere = previous.length + 1;
  }

  // Ressenti : la note de carnet rattachée à cette séance (le « après »).
  let ressenti: PilotNote | null = null;
  if (isOwner) {
    const notes = await listMyNotes();
    ressenti = notes.find((n) => n.sessionId === session.id) ?? null;
  }
  const hasRessenti = ressenti != null;

  const trace = assembleTraceOfDay({
    circuitName: session.circuit_name || null,
    lapCount: reg.lapCount,
    bestSeconds: reg.bestSeconds ?? session.best_lap_seconds ?? null,
    spreadSeconds: reg.spreadSeconds,
    band: reg.band,
    confidence,
    keyMoments,
    hasRessenti,
    sessionsHere,
  });

  return { session, trace, intention, ressenti };
}
