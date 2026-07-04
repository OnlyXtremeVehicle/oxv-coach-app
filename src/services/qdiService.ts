/**
 * QDI 5 branches — calcul, persistance et lecture (Lot M1).
 *
 * Calcul déterministe (qdiLogic, `algo_version` estampillé) persisté dans
 * `app_session_analyses.qdi` (jsonb, migration 2026-07-04). Self-only strict :
 * la référence du radar est la médiane des dernières sessions DU PILOTE sur le
 * même circuit — jamais un autre pilote, jamais de classement.
 *
 * Lecture par des tiers CONSENTIS (décision fondateur 2026-07-04, « assumer ») :
 * la colonne qdi hérite des policies SELECT existantes de la table — un coach
 * consenti ou un AMI accepté (double consentement) peut lire les branches d'un
 * pilote. Assumé : le consentement mutuel prime ; l'app n'affiche pour autant
 * aucun comparatif inter-pilotes ni classement.
 *
 * Gating offres (prompt v2) : Signature/Heritage = radar + détail des
 * branches ; Access = radar seul. Le niveau se lit sur les inscriptions du
 * site (`registrations.offer_type`, RLS own). Sans aucune inscription (compte
 * hors parcours commercial), le détail reste visible.
 */

import { supabase } from '@/lib/supabase';
import {
  computeQdi,
  medianBranches,
  type QdiBranches,
  type QdiFrame,
  type QdiLapWindow,
  type QdiResult,
} from '@/services/qdiLogic';
import { loadSessionFrames } from '@/services/sessionTelemetryService';
import { fetchSessionLaps } from '@/services/sessionsService';

export interface QdiRecord extends QdiResult {
  computedAt: string;
  reference: { sessions: number; circuit: string | null };
}

/** Calcule et persiste le QDI d'une session analysée. Best-effort. */
export async function computeAndPersistQdi(sessionId: string): Promise<QdiRecord | null> {
  const { data: session } = await supabase
    .from('telemetry_sessions')
    .select('id, user_id, started_at, circuit_name')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session?.started_at) return null;

  const sessionStartMs = new Date(session.started_at).getTime();
  const [rawFrames, laps] = await Promise.all([
    loadSessionFrames(sessionId),
    fetchSessionLaps(sessionId),
  ]);

  const frames: QdiFrame[] = rawFrames.map((f) => ({
    elapsedMs: f.elapsedMs,
    lat: f.lat,
    lon: f.lon,
    gLat: f.gLat,
    gLong: f.gLong,
  }));
  const windows: QdiLapWindow[] = laps
    .filter((l) => !l.is_outlap && !l.is_inlap && l.started_at && l.ended_at)
    .map((l) => ({
      startMs: new Date(l.started_at).getTime() - sessionStartMs,
      endMs: new Date(l.ended_at).getTime() - sessionStartMs,
      durationSeconds: l.duration_seconds,
    }));

  const result = computeQdi(frames, windows);
  const record: QdiRecord = {
    ...result,
    computedAt: new Date().toISOString(),
    reference: { sessions: 0, circuit: session.circuit_name ?? null },
  };

  // .select() chaîné : sans lui, un UPDATE qui ne touche AUCUNE ligne (analyse
  // pas encore créée, refus RLS) passerait pour un succès — faux « QDI calculé ».
  const { data: updated, error } = await supabase
    .from('app_session_analyses')
    .update({ qdi: record } as never)
    .eq('telemetry_session_id', sessionId)
    .select('telemetry_session_id');
  if (error || !updated || updated.length === 0) return null;
  return record;
}

/** QDI persisté d'une session (null si pas encore calculé). */
export async function getQdiForSession(sessionId: string): Promise<QdiRecord | null> {
  const { data } = await supabase
    .from('app_session_analyses')
    .select('qdi')
    .eq('telemetry_session_id', sessionId)
    .maybeSingle();
  const qdi = (data as { qdi?: QdiRecord | null } | null)?.qdi;
  return qdi ?? null;
}

/**
 * QDI d'une session, avec RECALCUL PARESSEUX : si l'analyse existe mais que le
 * qdi manque (session rattrapée par le cron serveur, qui ne calcule pas le
 * QDI ; ou ancienne session d'avant la migration), on le calcule et on le
 * persiste à la lecture. Le pilote propriétaire est le seul à pouvoir écrire
 * (RLS own-row) — pour un lecteur consenti, le calcul est simplement ignoré.
 */
export async function getOrComputeQdiForSession(sessionId: string): Promise<QdiRecord | null> {
  const existing = await getQdiForSession(sessionId);
  if (existing) return existing;
  try {
    return await computeAndPersistQdi(sessionId);
  } catch {
    return null;
  }
}

/**
 * Référence self-only : médiane par branche des 5 derniers QDI du pilote sur
 * le même circuit (session courante exclue).
 */
export async function getQdiReference(
  userId: string,
  circuitName: string | null,
  excludeSessionId: string
): Promise<{ branches: QdiBranches; sessions: number }> {
  let query = supabase
    .from('telemetry_sessions')
    .select('id')
    .eq('user_id', userId)
    .neq('id', excludeSessionId)
    .order('started_at', { ascending: false })
    .limit(15);
  if (circuitName) query = query.eq('circuit_name', circuitName);
  const { data: sessions } = await query;
  const ids = (sessions ?? []).map((s) => s.id);
  if (ids.length === 0) {
    return {
      branches: {
        trajectoire: null,
        fluidite: null,
        freinage: null,
        acceleration: null,
        regularite: null,
      },
      sessions: 0,
    };
  }

  const { data: analyses } = await supabase
    .from('app_session_analyses')
    .select('qdi, telemetry_session_id')
    .in('telemetry_session_id', ids)
    .not('qdi', 'is', null);
  // PostgREST ne garantit aucun ordre : on retrie selon la récence des
  // sessions (ids déjà triés started_at desc) puis on garde les 5 dernières.
  const orderIndex = new Map(ids.map((id, i) => [id, i]));
  const history = (analyses ?? [])
    .map((a) => a as unknown as { qdi?: QdiBranches | null; telemetry_session_id: string })
    .filter((a) => Boolean(a.qdi))
    .sort(
      (x, y) =>
        (orderIndex.get(x.telemetry_session_id) ?? 99) -
        (orderIndex.get(y.telemetry_session_id) ?? 99)
    )
    .slice(0, 5)
    .map((a) => a.qdi as QdiBranches);
  return { branches: medianBranches(history), sessions: history.length };
}

export type QdiAccessLevel = 'full' | 'simple';

/** Niveau de restitution selon l'offre (Signature/Heritage = détail). */
export async function getQdiAccessLevel(userId: string): Promise<QdiAccessLevel> {
  const { data } = await supabase
    .from('registrations')
    .select('offer_type, status')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(10);
  const offers = (data ?? []).map((r) => String(r.offer_type).toLowerCase());
  if (offers.length === 0) return 'full'; // hors parcours commercial : rien à restreindre
  return offers.some((o) => o.includes('signature') || o.includes('heritage')) ? 'full' : 'simple';
}
