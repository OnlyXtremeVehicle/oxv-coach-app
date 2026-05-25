/**
 * Orchestration de l'analyse post-session.
 *
 * Sem 13 J1 — câble le pipeline complet entre la fin d'un roulage et la
 * disponibilité du bilan :
 *
 *   samples (UBX local OU telemetry_frames DB)
 *     → trackviz.analyzeTrackVizSession
 *     → upsertSegmentAnalyses (14 lignes app_segment_analyses)
 *     → laps (fetchSessionLaps DB) → computeMargin
 *     → upsertAnalysis (1 ligne app_session_analyses, marge globale)
 *
 * Cette fonction est appelée depuis l'écran #11 « Données en sécurité »
 * pendant la phase de préservation, avant la transition vers #12 « Bilan
 * prêt ». L'erreur n'est jamais bloquante côté UI — si l'analyse échoue,
 * on passe quand même au bilan, qui affichera le fallback approprié.
 *
 * Trois sources de samples possibles, dans cet ordre de priorité :
 *
 *   1. `localUbxUri` fourni en option → on parse le fichier UBX local
 *      (la session vient juste de se terminer, on a tout en mémoire flash)
 *   2. `telemetry_frames` en DB → fallback rapide pour les sessions
 *      historiques ou si pas de .ubx local
 *   3. Storage `.ubx` distant → V1.1, pas câblé V1
 *
 * Tout est best-effort : si rien ne marche, on persiste juste la marge
 * globale calculée depuis les laps (déjà câblé sem 5), sans segment-level.
 */

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import { UbxFrameBuffer, parseRaceBoxDataMessage } from '@/ubx/parser';
import { analyzeTrackVizSession } from '@/trackviz/analysis';
import type { TrackVizRecordingSample } from '@/trackviz/types';
import type { Lap, RaceBoxData, TelemetrySession } from '@/types/telemetry';

import { computeMargin } from './marginCalculator';
import { upsertAnalysis } from './analysesService';
import { generateDebrief } from './debriefGenerator';
import { scheduleDebriefNotification } from './pushNotificationsService';
import { listSegmentAnalysesForSession, upsertSegmentAnalyses } from './segmentAnalysesService';
import { fetchSessionLaps } from './sessionsService';

export type AnalyzeSourceKind = 'ubx_local' | 'telemetry_frames' | 'none';

export interface AnalyzeSessionInput {
  telemetrySessionId: string;
  userId: string;
  /** Si fourni, le .ubx local est parsé en priorité. */
  localUbxUri?: string;
}

export interface AnalyzeSessionResult {
  ok: boolean;
  source: AnalyzeSourceKind;
  /** Nombre de samples passés à `analyzeTrackVizSession`. 0 si fallback laps-only. */
  sampleCount: number;
  /** Nombre de segments persistés (max 14). */
  segmentsPersisted: number;
  /** Marge globale calculée, 0..100, ou null si rien à calculer. */
  marginGlobal: number | null;
  /** Détail libre pour log / debug. */
  notes: string[];
}

const FRAMES_PAGE_SIZE = 1000;
const TRACKVIZ_DOWNSAMPLE_MAX = 600;

// ============================================================================
// PIPELINE PRINCIPAL
// ============================================================================

/**
 * Analyse complète d'une session de roulage + persistance.
 *
 * Ne lève jamais : toute erreur est rattrapée et reflétée dans `result.notes`.
 * L'appelant peut donc faire confiance au résultat pour piloter la navigation.
 */
export async function analyzeAndPersistSession(
  input: AnalyzeSessionInput
): Promise<AnalyzeSessionResult> {
  const notes: string[] = [];
  let source: AnalyzeSourceKind = 'none';
  let samples: TrackVizRecordingSample[] = [];

  // ── Source 1 : .ubx local ────────────────────────────────────────────────
  if (input.localUbxUri) {
    try {
      samples = await parseUbxFile(input.localUbxUri);
      if (samples.length > 0) {
        source = 'ubx_local';
        notes.push(`UBX local parsé : ${samples.length} samples bruts.`);
      } else {
        notes.push('UBX local vide ou non parsable.');
      }
    } catch (e) {
      notes.push(`UBX local KO : ${errMsg(e)}`);
    }
  }

  // ── Source 2 : telemetry_frames DB ───────────────────────────────────────
  if (samples.length === 0) {
    try {
      samples = await fetchSamplesFromFrames(input.telemetrySessionId);
      if (samples.length > 0) {
        source = 'telemetry_frames';
        notes.push(`telemetry_frames lus : ${samples.length} samples.`);
      } else {
        notes.push('Aucune frame en DB pour cette session.');
      }
    } catch (e) {
      notes.push(`Lecture telemetry_frames KO : ${errMsg(e)}`);
    }
  }

  // Downsample si trop de samples (perf SVG + perf analyse)
  if (samples.length > TRACKVIZ_DOWNSAMPLE_MAX) {
    samples = downsample(samples, TRACKVIZ_DOWNSAMPLE_MAX);
    notes.push(`Downsamplé à ${samples.length} pour analyse.`);
  }

  let segmentsPersisted = 0;

  // ── Analyse trackviz par segment ─────────────────────────────────────────
  if (samples.length >= 2) {
    try {
      const analysis = analyzeTrackVizSession(samples);
      segmentsPersisted = await upsertSegmentAnalyses({
        telemetrySessionId: input.telemetrySessionId,
        userId: input.userId,
        segments: analysis.segments,
      });
      notes.push(`Segments persistés : ${segmentsPersisted}/${analysis.segments.length}.`);
    } catch (e) {
      notes.push(`Analyse trackviz KO : ${errMsg(e)}`);
    }
  } else {
    notes.push('Pas assez de samples pour analyse par segment.');
  }

  // ── Marge globale (depuis laps + session) ────────────────────────────────
  let marginGlobal: number | null = null;
  let computedFirstName: string | null = null;
  let computedCircuitName = 'Beltoise';
  let computedStartedAt = new Date().toISOString();
  let computedBestLap: number | null = null;
  let computedLapCount = 0;
  let computedVehicle: number | null = null;
  let computedPilot: number | null = null;

  try {
    const [session, laps] = await Promise.all([
      fetchSession(input.telemetrySessionId),
      fetchSessionLaps(input.telemetrySessionId),
    ]);
    if (session) {
      const result = computeMargin({ session, laps });
      marginGlobal = result.marginGlobal;
      computedVehicle = result.marginVehicle;
      computedPilot = result.marginPilot;
      computedCircuitName = session.circuit_name ?? 'Beltoise';
      computedStartedAt = session.started_at;
      computedBestLap = session.best_lap_seconds ?? null;
      computedLapCount = laps.filter((l) => !l.is_outlap && !l.is_inlap).length;
      await upsertAnalysis({
        telemetrySessionId: input.telemetrySessionId,
        userId: input.userId,
        result,
      });
      notes.push(`Marge globale persistée : ${result.marginGlobal.toFixed(1)} %.`);
    } else {
      notes.push('Session introuvable pour calcul de marge globale.');
    }
  } catch (e) {
    notes.push(`Marge globale KO : ${errMsg(e)}`);
  }

  // ── Debrief J+1 généré (OpenAI d'abord, fallback local sinon) ──────────
  if (marginGlobal !== null) {
    try {
      // Tentative OpenAI via Edge Function generate-debrief-ai
      const { error: aiError } = await supabase.functions.invoke('generate-debrief-ai', {
        body: { sessionId: input.telemetrySessionId },
      });

      if (!aiError) {
        notes.push('Debrief J+1 généré via OpenAI.');
      } else {
        // Fallback local — toujours doctrinal, juste moins riche narrativement
        console.warn('[OXV] OpenAI debrief KO, fallback local :', aiError.message);
        const segments = await listSegmentAnalysesForSession(input.telemetrySessionId);
        const debrief = generateDebrief({
          firstName: computedFirstName,
          circuitName: computedCircuitName,
          sessionStartedAt: computedStartedAt,
          marginGlobal,
          marginZone: null,
          marginVehicle: computedVehicle,
          marginPilot: computedPilot,
          lapCount: computedLapCount,
          bestLapSeconds: computedBestLap,
          segments,
        });
        await updateDebriefText(input.telemetrySessionId, debrief.text);
        notes.push('Debrief J+1 généré (fallback local).');
      }

      // Programmation de la notif locale J+1. Best-effort.
      const notifId = await scheduleDebriefNotification({
        userId: input.userId,
        sessionId: input.telemetrySessionId,
      });
      if (notifId) notes.push(`Notif debrief J+1 programmée (${notifId.slice(0, 8)}…).`);
    } catch (e) {
      notes.push(`Debrief KO : ${errMsg(e)}`);
    }
  }

  return {
    ok: segmentsPersisted > 0 || marginGlobal !== null,
    source,
    sampleCount: samples.length,
    segmentsPersisted,
    marginGlobal,
    notes,
  };
}

// ============================================================================
// SOURCE 1 — Parse d'un fichier UBX local
// ============================================================================

/**
 * Parse un fichier .ubx local et le convertit en `TrackVizRecordingSample[]`.
 *
 * Le fichier est lu en base64 (encoding contraint par expo-file-system),
 * décodé en Uint8Array, puis injecté par chunks dans `UbxFrameBuffer` pour
 * reconstruire les trames. Chaque trame valide est parsée en `RaceBoxData`
 * puis convertie en sample trackviz avec un `elapsed_ms` relatif au premier.
 */
export async function parseUbxFile(uri: string): Promise<TrackVizRecordingSample[]> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(`Fichier introuvable : ${uri}`);
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));

  // Injection par chunks de 4 ko pour éviter une surcharge mémoire instantanée
  const buffer = new UbxFrameBuffer();
  const chunkSize = 4096;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    const newFrames = buffer.push(chunk);
    frames.push(...newFrames);
  }

  const samples: TrackVizRecordingSample[] = [];
  let originMs: number | null = null;

  for (const frameBytes of frames) {
    const data = parseRaceBoxDataMessage(frameBytes);
    if (!data) continue;
    // RaceBox ne donne pas d'elapsed_ms relatif natif → on dérive depuis iTOW
    // (Time Of Week en ms). Le premier sample fixe l'origine.
    if (originMs === null) originMs = data.timestamp.iTOW;
    const elapsedMs = data.timestamp.iTOW - originMs;
    samples.push(raceBoxToTrackVizSample(data, elapsedMs));
  }

  // Tri par sécurité (UBX est déjà ordonné mais on protège)
  samples.sort((a, b) => a.elapsed_ms - b.elapsed_ms);
  return samples;
}

// ============================================================================
// SOURCE 2 — Lecture des telemetry_frames DB
// ============================================================================

interface FrameRow {
  elapsed_ms: number;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  gps_accuracy_m: number | null;
  gps_fix: number | null;
  satellites: number | null;
  speed_kmh: number | null;
  heading: number | null;
  g_force_x: number | null;
  g_force_y: number | null;
  g_force_z: number | null;
  battery_level: number | null;
}

async function fetchSamplesFromFrames(sessionId: string): Promise<TrackVizRecordingSample[]> {
  // Pagination explicite (par défaut 1000 lignes max côté supabase-js)
  const samples: TrackVizRecordingSample[] = [];
  let offset = 0;
  // Bornes de sécurité : une session 10 min @ 5 Hz = 3000 frames. On stoppe à 50k.
  const SAFETY_LIMIT = 50_000;

  while (offset < SAFETY_LIMIT) {
    const { data, error } = await supabase
      .from('telemetry_frames')
      .select(
        'elapsed_ms, latitude, longitude, altitude_m, gps_accuracy_m, gps_fix, satellites, speed_kmh, heading, g_force_x, g_force_y, g_force_z, battery_level'
      )
      .eq('session_id', sessionId)
      .order('elapsed_ms', { ascending: true })
      .range(offset, offset + FRAMES_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as FrameRow[];
    for (const row of page) {
      if (row.latitude === null || row.longitude === null) continue;
      samples.push({
        elapsed_ms: row.elapsed_ms,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        altitude_m: row.altitude_m !== null ? Number(row.altitude_m) : null,
        speed_kmh: row.speed_kmh !== null ? Number(row.speed_kmh) : 0,
        heading_deg: row.heading !== null ? Number(row.heading) : null,
        g_force_x: row.g_force_x !== null ? Number(row.g_force_x) : 0,
        g_force_y: row.g_force_y !== null ? Number(row.g_force_y) : 0,
        g_force_z: row.g_force_z !== null ? Number(row.g_force_z) : 1,
        gps_accuracy_m: row.gps_accuracy_m !== null ? Number(row.gps_accuracy_m) : null,
        gps_fix: row.gps_fix !== null ? Number(row.gps_fix) : 0,
        satellites: row.satellites,
        battery_level: row.battery_level,
        source: 'ble',
      });
    }
    if (page.length < FRAMES_PAGE_SIZE) break;
    offset += FRAMES_PAGE_SIZE;
  }

  return samples;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Conversion `RaceBoxData` (parser UBX) → `TrackVizRecordingSample` (analyse).
 * Exporté pour les tests et pour un usage temps réel hypothétique.
 */
export function raceBoxToTrackVizSample(
  data: RaceBoxData,
  elapsedMs: number
): TrackVizRecordingSample {
  return {
    elapsed_ms: Math.max(0, elapsedMs),
    latitude: data.gps.latitude,
    longitude: data.gps.longitude,
    altitude_m: data.gps.altitude,
    speed_kmh: data.motion.speed,
    heading_deg: data.motion.headingValid ? data.motion.heading : null,
    g_force_x: data.imu.gForceX,
    g_force_y: data.imu.gForceY,
    g_force_z: data.imu.gForceZ,
    gps_accuracy_m: data.gps.accuracy,
    gps_fix: data.gps.fix,
    satellites: data.gps.satellites,
    battery_level: data.battery.level,
    source: 'ble',
  };
}

/**
 * Downsample uniforme — garde N samples répartis sur la durée totale.
 * Préserve toujours le premier et le dernier sample pour ne pas tronquer
 * artificiellement la session.
 */
function downsample<T>(samples: T[], target: number): T[] {
  if (samples.length <= target) return samples;
  const step = (samples.length - 1) / (target - 1);
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    const idx = Math.round(i * step);
    out.push(samples[idx]);
  }
  return out;
}

async function fetchSession(sessionId: string): Promise<TelemetrySession | null> {
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as TelemetrySession;
}

async function updateDebriefText(sessionId: string, text: string): Promise<void> {
  const { error } = await supabase
    .from('app_session_analyses')
    .update({ debrief_text: text })
    .eq('telemetry_session_id', sessionId);
  if (error) throw new Error(error.message);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// Export interne pour faciliter les tests unitaires
export const __testing = {
  downsample,
  fetchSamplesFromFrames,
  raceBoxToTrackVizSample,
};

// Lap est ré-exporté implicitement pour faciliter le typage côté appelant
// (évite à l'app/(app)/donnees-securite d'importer 2 modules)
export type { Lap };
