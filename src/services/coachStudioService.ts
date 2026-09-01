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
import type { MarginBase } from '@/services/marginCalculator';
import { getQdiForSession, type QdiRecord } from '@/services/qdiService';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { supabase } from '@/lib/supabase';
import type { MarginZone } from '@/types/domain';

/** Colonne `numeric` de PostgREST : chaîne au runtime. Null sur illisible. */
function nombreOuNull(brut: unknown): number | null {
  if (brut === null || brut === undefined || brut === '') return null;
  const n = typeof brut === 'number' ? brut : Number(brut);
  return Number.isFinite(n) ? n : null;
}

/**
 * Le nombre de tours à afficher.
 *
 * La colonne `lap_count` n'est pas toujours renseignée, et vaut alors 0 — un
 * zéro que `??` laisse passer. Quand elle ne dit rien d'utilisable mais que des
 * tours ont réellement été comptés, on montre le compte réel : afficher « 0 tour »
 * au-dessus d'une liste de tours est un mensonge que le pilote voit.
 */
function lapCountFiable(colonne: unknown, comptesReels: number): number {
  const n = nombreOuNull(colonne);
  if (n !== null && n > 0) return n;
  return comptesReels;
}

export interface StudioMarginSummary {
  global: number | null;
  zone: MarginZone | null;
  vehicle: number | null;
  pilot: number | null;
  /**
   * SUR QUOI LE CHIFFRE REPOSE. `null` pour une ligne antérieure au 14/08/2026.
   *
   * Il voyage jusqu'au rapport parce que l'en-tête de la cellule en dépend :
   * `pilote-seul` est l'état de TOUTES les séances aujourd'hui — aucun véhicule
   * n'est caractérisé — et intituler le chiffre « MARGE GLOBALE » laisse croire
   * à une pondération véhicule/pilote qui n'a pas eu lieu.
   */
  base: MarginBase | null;
}

export interface StudioSession {
  sessionId: string;
  circuitName: string | null;
  /** Nom du pilote de la séance (via listMyPilots, RLS consentement), null si non résolu. */
  pilotName: string | null;
  /**
   * Identifiant du pilote — `null` quand le binôme n'est pas résolu.
   *
   * Exposé le 14/08/2026 pour la NOTE DE SÉANCE : écrire le bilan du coach dans
   * `coach_annotations` exige `pilot_id`, et l'écran ne l'avait pas. Le service
   * le résolvait déjà pour le nom ; il le jetait une ligne plus loin.
   */
  pilotId: string | null;
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
    // Le studio se monte sans ses segments : le panneau de triage dira
    // « en attente » plutôt que de faire tomber l'écran entier.
    listSegmentAnalysesForSession(telemetrySessionId).catch(() => []),
    listMyPilots(),
  ]);

  const pilot = pilots.find((p) => p.pilotId === (session as { user_id?: string }).user_id);
  const pilotName = pilot
    ? [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || null
    : null;

  const keyMoments = computeKeyMoments({
    laps: laps.map((l) => ({
      lapNumber: l.lap_number,
      // `duration_seconds` est une colonne `numeric` : PostgREST la rend en
      // CHAÎNE au runtime. Sans coercition, « 102.700 » < « 95.200 » est VRAI
      // (comparaison lexicographique) et le tour le plus LENT devenait la
      // référence. Même piège que dans le comparateur du pilote.
      durationSeconds: Number(l.duration_seconds),
      isOutlap: l.is_outlap,
      isInlap: l.is_inlap,
    })),
    segments: segments.map((s) => ({
      segmentIndex: s.segmentIndex,
      segmentName: s.segmentName,
      maxGLateral: s.maxGLateral,
    })),
    gLateralMaxSeance: nombreOuNull(
      (session as { max_g_lateral?: number | string | null }).max_g_lateral
    ),
  });

  return {
    sessionId: telemetrySessionId,
    circuitName: session.circuit_name ?? null,
    pilotName,
    pilotId: pilot?.pilotId ?? null,
    startedAt: (session as { started_at?: string | null }).started_at ?? null,
    // Colonnes `numeric` rendues en CHAÎNE par PostgREST : on coerce, sinon le
    // formateur affiche « — » sur un chrono pourtant présent.
    bestLapSeconds: nombreOuNull(session.best_lap_seconds),
    // `??` ne se déclenche PAS sur 0 : l'en-tête annonçait « 0 tour » pendant
    // que le panneau Tours en listait plusieurs. On retient donc le compte réel
    // dès que la colonne ne dit rien d'utilisable.
    lapCount: lapCountFiable(
      session.lap_count,
      laps.filter((l) => !l.is_outlap && !l.is_inlap).length
    ),
    triage,
    qdi,
    margins: {
      global: analysis?.marginGlobal ?? null,
      zone: analysis?.marginZone ?? null,
      vehicle: analysis?.marginVehicle ?? null,
      pilot: analysis?.marginPilot ?? null,
      base: analysis?.marginBase ?? null,
    },
    keyMoments,
  };
}
