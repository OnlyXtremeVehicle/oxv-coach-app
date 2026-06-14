/**
 * Service de capture de session (P0 — write path Valence).
 *
 * Orchestre la PREMIÈRE récupération de données réelle, de bout en bout :
 *   1. crée une ligne telemetry_sessions (status 'recording') ;
 *   2. s'abonne au flux BLE (bluetoothService.onData), bufferise les trames,
 *      et les INSÈRE par paquets dans telemetry_frames ;
 *   3. lance la détection de tours (lapDetectionRunner → useSessionStore) et la
 *      capture .ubx locale (captureMode) comme filet de sécurité ;
 *   4. à l'arrêt : flush final, agrégats, status 'completed', upload .ubx.
 *
 * Le mapping trame→ligne est isolé et testé (captureFrameMapping). Ici on ne
 * fait que l'orchestration réseau/état (non testée unitairement — dépend de BLE).
 *
 * Doctrine « silence en piste » : ce service n'affiche rien ; c'est l'écran de
 * roulage qui décide. La capture tourne tant que l'app est au premier plan
 * (V1 ; le BLE en arrière-plan viendra avec les entitlements natifs).
 */

import { bluetoothService } from '@/ble/bluetoothService';
import { startCapture, stopCapture } from '@/ble/captureMode';
import { startLapDetection, stopLapDetection } from '@/ble/lapDetectionRunner';
import { supabase } from '@/lib/supabase';
import { uploadTelemetryFile } from '@/services/telemetryStorage';
import { useSessionStore } from '@/store/useSessionStore';
import type { RaceBoxData } from '@/types/telemetry';

import {
  EMPTY_MAXIMA,
  type SessionMaxima,
  type TelemetryFrameInsert,
  raceBoxToFrameInsert,
  updateMaxima,
} from './captureFrameMapping';

/** Ligne d'arrivée Beltoise (Circuit de Haute Saintonge) — défaut Valence. */
export const BELTOISE_FINISH = { lat: 45.6004, lon: -0.141, radiusM: 40 };

const FLUSH_EVERY_FRAMES = 50;
const FLUSH_INTERVAL_MS = 4_000;

interface CaptureState {
  sessionId: string;
  userId: string;
  startMs: number;
  buffer: TelemetryFrameInsert[];
  total: number;
  maxima: SessionMaxima;
  unsubData: () => void;
  timer: ReturnType<typeof setInterval> | null;
  flushing: boolean;
}

let current: CaptureState | null = null;

export function isCaptureSessionActive(): boolean {
  return current !== null;
}

export interface StartCaptureInput {
  userId: string;
  circuitId?: string | null;
  circuitName?: string | null;
  vehicleId?: string | null;
  finishLine?: { lat: number; lon: number; radiusM?: number };
}

export interface StartCaptureResult {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

/** Crée la session et démarre l'enregistrement (frames + tours + .ubx). */
export async function startCaptureSession(input: StartCaptureInput): Promise<StartCaptureResult> {
  if (current) return { ok: false, error: 'Une capture est déjà active.' };

  const { data, error } = await supabase
    .from('telemetry_sessions')
    .insert({
      user_id: input.userId,
      status: 'recording',
      started_at: new Date().toISOString(),
      circuit_id: input.circuitId ?? null,
      circuit_name: input.circuitName ?? 'Beltoise',
      vehicle_id: input.vehicleId ?? null,
    } as never)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Création de session impossible.' };
  }

  const sessionId = (data as { id: string }).id;
  const startMs = Date.now();
  const finish = input.finishLine ?? BELTOISE_FINISH;

  const state: CaptureState = {
    sessionId,
    userId: input.userId,
    startMs,
    buffer: [],
    total: 0,
    maxima: { ...EMPTY_MAXIMA },
    unsubData: () => undefined,
    timer: null,
    flushing: false,
  };
  current = state;

  // Filet de sécurité : capture .ubx brute locale (jamais bloquant).
  try {
    startCapture();
  } catch {
    /* capture locale indisponible — on continue, les frames partent en DB */
  }

  // Détection de tours (écrit lapCount/bestLapMs dans le store).
  startLapDetection({
    finishLineLat: finish.lat,
    finishLineLon: finish.lon,
    finishLineRadiusM: finish.radiusM,
  });

  // État de session partagé (compteurs live).
  useSessionStore.getState().startSession({
    id: sessionId,
    userId: input.userId,
    startedAt: new Date(startMs),
    endedAt: null,
    circuitId: input.circuitId ?? null,
    vehicleId: input.vehicleId ?? null,
  });

  // Flux de trames → buffer → flush par paquets.
  state.unsubData = bluetoothService.onData((frame: RaceBoxData) => {
    if (current !== state) return;
    state.buffer.push(raceBoxToFrameInsert(frame, sessionId, Date.now() - state.startMs));
    state.maxima = updateMaxima(state.maxima, frame);
    if (state.buffer.length >= FLUSH_EVERY_FRAMES) void flush();
  });
  state.timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

  return { ok: true, sessionId };
}

/** Écrit le buffer courant dans telemetry_frames (best-effort, non réentrant). */
async function flush(): Promise<void> {
  const state = current;
  if (!state || state.flushing || state.buffer.length === 0) return;
  state.flushing = true;
  const batch = state.buffer;
  state.buffer = [];
  try {
    const { error } = await supabase.from('telemetry_frames').insert(batch as never);
    if (error) {
      // On ne ré-empile pas (risque de gonfler la mémoire) ; le .ubx local reste
      // le filet de récupération si un lot échoue.
      console.warn('[OXV][capture] écriture frames KO :', error.message);
    } else {
      state.total += batch.length;
    }
  } catch (e) {
    console.warn('[OXV][capture] écriture frames exception :', e instanceof Error ? e.message : e);
  } finally {
    state.flushing = false;
  }
}

export interface StopCaptureResult {
  ok: boolean;
  sessionId?: string;
  ubxUri?: string | null;
  totalFrames?: number;
  error?: string;
}

/**
 * Arrête l'enregistrement : flush final, agrégats, status 'completed', upload .ubx.
 * Retourne le sessionId pour router vers le flux de bilan.
 */
export async function stopCaptureSession(): Promise<StopCaptureResult> {
  const state = current;
  if (!state) return { ok: false, error: 'Aucune capture active.' };

  // 1. Stoppe l'arrivée de nouvelles trames + le timer, puis flush final.
  state.unsubData();
  state.unsubData = () => undefined;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  await flush();

  // 2. Arrête détection de tours + relève les compteurs.
  stopLapDetection();
  const store = useSessionStore.getState();
  const lapCount = store.lapCount;
  const bestLapSeconds = store.bestLapMs != null ? store.bestLapMs / 1000 : null;
  store.endSession();

  // 3. Ferme la capture .ubx locale (filet de sécurité).
  let ubxUri: string | null = null;
  try {
    ubxUri = await stopCapture();
  } catch {
    ubxUri = null;
  }

  // 4. Marque la session 'completed' avec les agrégats.
  const durationSeconds = Math.round((Date.now() - state.startMs) / 1000);
  const { error } = await supabase
    .from('telemetry_sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      lap_count: lapCount,
      best_lap_seconds: bestLapSeconds,
      max_speed_kmh: state.maxima.maxSpeedKmh || null,
      max_g_lateral: state.maxima.maxGLateral || null,
      max_g_longitudinal: state.maxima.maxGLongitudinal || null,
      total_frames: state.total,
    } as never)
    .eq('id', state.sessionId)
    .eq('user_id', state.userId);
  if (error) {
    console.warn('[OXV][capture] complétion de session KO :', error.message);
  }

  const { sessionId, userId, total } = state;
  current = null;

  // 5. Upload du .ubx brut en arrière-plan (best-effort, non bloquant).
  if (ubxUri) {
    uploadTelemetryFile({ fileUri: ubxUri, userId, telemetrySessionId: sessionId }).catch((e) =>
      console.warn('[OXV][capture] upload .ubx KO :', e instanceof Error ? e.message : e)
    );
  }

  return { ok: true, sessionId, ubxUri, totalFrames: total };
}

/** Abandonne la capture en cours : marque 'aborted', sans router vers le bilan. */
export async function abortCaptureSession(): Promise<void> {
  const state = current;
  if (!state) return;
  state.unsubData();
  if (state.timer) clearInterval(state.timer);
  stopLapDetection();
  try {
    await stopCapture();
  } catch {
    /* ignore */
  }
  useSessionStore.getState().abortSession();
  await supabase
    .from('telemetry_sessions')
    .update({ status: 'aborted', ended_at: new Date().toISOString() } as never)
    .eq('id', state.sessionId)
    .eq('user_id', state.userId);
  current = null;
}
