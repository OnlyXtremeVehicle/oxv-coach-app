/**
 * Studio Coach — agrégation de séance (P0, cf. VISION_COACH_STUDIO.md).
 *
 * Réunit en UN payload ce que l'interface Studio du coach consomme au retour
 * aux stands : le TRIAGE factuel (virages les plus serrés), le radar QDI, le
 * résumé des marges, les moments-clés et la méta séance. Pur assemblage de
 * services déjà en place et testés (triage, QDI, analyses, key moments) —
 * l'UI viendra avec la refonte.
 *
 * Doctrine : des FAITS. Le triage désigne où regarder ; il ne dit pas quoi
 * faire (la cause reste au coach, ou à une suggestion IA qu'il valide — C3).
 */

import { getAnalysisForSession } from '@/services/analysesService';
import { listMyPilots } from '@/services/coachService';
import { getSessionTriage } from '@/services/coachTriageService';
import type { TriageCorner } from '@/services/coachTriageLogic';
import { computeKeyMoments, type KeyMoment } from '@/services/keyMomentsLogic';
import { getQdiForSession, type QdiRecord } from '@/services/qdiService';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { supabase } from '@/lib/supabase';
import type { MarginZone } from '@/types/domain';

export interface StudioMarginSummary {
  global: number | null;
  zone: MarginZone | null;
  vehicle: number | null;
  pilot: number | null;
}

export interface StudioSession {
  sessionId: string;
  circuitName: string | null;
  /** Nom du pilote de la séance (via listMyPilots, RLS consentement), null si non résolu. */
  pilotName: string | null;
  /** Début de séance (ISO), null si non renseigné. */
  startedAt: string | null;
  bestLapSeconds: number | null;
  lapCount: number;
  /** Smart Flagging : les virages les plus serrés (fait seul). */
  triage: TriageCorner[];
  /** Radar QDI (null si pas encore calculé). */
  qdi: QdiRecord | null;
  margins: StudioMarginSummary;
  keyMoments: KeyMoment[];
}

/**
 * Payload Studio d'une séance pour le coach. Best-effort : chaque brique
 * dégrade proprement (null / vide) si sa donnée manque, jamais d'invention.
 */
export async function getStudioSession(telemetrySessionId: string): Promise<StudioSession | null> {
  const { data: session } = await supabase
    .from('telemetry_sessions')
    .select('id, user_id, started_at, circuit_name, lap_count, best_lap_seconds')
    .eq('id', telemetrySessionId)
    .maybeSingle();
  if (!session) return null;

  const [triage, qdi, analysis, laps, segments, pilots] = await Promise.all([
    getSessionTriage(telemetrySessionId),
    getQdiForSession(telemetrySessionId),
    getAnalysisForSession(telemetrySessionId),
    fetchSessionLaps(telemetrySessionId),
    listSegmentAnalysesForSession(telemetrySessionId),
    listMyPilots(),
  ]);

  const pilot = pilots.find((p) => p.pilotId === (session as { user_id?: string }).user_id);
  const pilotName = pilot
    ? [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || null
    : null;

  const keyMoments = computeKeyMoments({
    laps: laps.map((l) => ({
      lapNumber: l.lap_number,
      durationSeconds: l.duration_seconds,
      isOutlap: l.is_outlap,
      isInlap: l.is_inlap,
    })),
    segments: segments.map((s) => ({
      segmentIndex: s.segmentIndex,
      segmentName: s.segmentName,
      maxGLateral: s.maxGLateral,
    })),
  });

  return {
    sessionId: telemetrySessionId,
    circuitName: session.circuit_name ?? null,
    pilotName,
    startedAt: (session as { started_at?: string | null }).started_at ?? null,
    bestLapSeconds: session.best_lap_seconds ?? null,
    lapCount: session.lap_count ?? laps.filter((l) => !l.is_outlap && !l.is_inlap).length,
    triage,
    qdi,
    margins: {
      global: analysis?.marginGlobal ?? null,
      zone: analysis?.marginZone ?? null,
      vehicle: analysis?.marginVehicle ?? null,
      pilot: analysis?.marginPilot ?? null,
    },
    keyMoments,
  };
}
