/**
 * Service Admin — Analyse session : diagnostic + relance de pipeline (PR-83).
 *
 * DIAGNOSTIC (lecture) : agrège, pour une session, l'état réel du pipeline à
 * partir des tables existantes (telemetry_sessions, app_session_analyses,
 * app_segment_analyses, session_insights, laps). Aucune table de diagnostic —
 * zéro schéma.
 *
 * ATTENTION — CETTE LIGNE AFFIRMAIT « Admin-only (RLS `is_admin()` sur ces
 * tables) ». **C'EST FAUX POUR AU MOINS UNE DES QUATRE.** Vérifié le
 * 02/08/2026 : `session_insights` ne porte que trois policies — propriétaire,
 * `service_role`, et coach — sans aucune branche administrateur.
 *
 * Deux conséquences, opposées et toutes deux mauvaises :
 *   • un administrateur qui n'est pas propriétaire n'y lit RIEN, et le
 *     diagnostic paraît vide sans dire pourquoi ;
 *   • un mainteneur qui croit ce commentaire ajoutera demain une requête en
 *     supposant une protection qui n'existe pas. Le dépôt est PUBLIC : la RLS
 *     est la seule barrière réelle.
 *
 * Ne rien conclure d'ici sur la protection d'une table : la lire dans
 * `pg_policies`. Consigné en D-30.
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
import { analyzeAndPersistSession } from '@/services/analyzeSessionService';

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

/**
 * RECALCULE LES SEGMENTS DE CETTE SÉANCE, DEPUIS L'APPAREIL.
 *
 * `analyzeAndPersistSession` tourne à la fin d'un run (`rec/fin`). Une séance
 * antérieure à un changement de calcul n'en profite donc jamais — et c'est le
 * cas de toutes celles roulées avant le 01/09/2026, jour où la piste a cessé
 * d'être écrite en dur : elles n'ont aucun segment, parce que la garde du 30/08
 * refusait de segmenter hors de Haute Saintonge.
 *
 * Ce geste les rattrape, une par une. Il vit ici plutôt que dans un cron parce
 * que le calcul est CÔTÉ APPLICATION : le recalage sur le tracé, le découpage
 * et les marges par segment sont du TypeScript, pas du SQL. Un cron ne peut pas
 * l'appeler.
 *
 * Ne lève jamais — `analyzeAndPersistSession` rattrape tout et le dit dans ses
 * notes. On en remonte les deux nombres qui comptent : combien de trames ont
 * été lues, combien de segments ont été écrits.
 */
export async function relaunchSegments(
  sessionId: string,
  userId: string
): Promise<RelaunchResult> {
  try {
    const r = await analyzeAndPersistSession({ telemetrySessionId: sessionId, userId });
    if (r.segmentsPersisted > 0) {
      return {
        ok: true,
        message: `${r.segmentsPersisted} segment(s) écrit(s) depuis ${r.sampleCount} trames.`,
      };
    }
    // Aucun segment n'est un RÉSULTAT, pas forcément une panne : le circuit peut
    // n'avoir ni tracé ni virages en base. La note du service le dit.
    const derniere = r.notes[r.notes.length - 1] ?? 'aucune note';
    return { ok: false, message: `Aucun segment écrit. ${derniere}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
