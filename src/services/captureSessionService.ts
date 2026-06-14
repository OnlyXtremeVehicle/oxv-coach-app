/**
 * Service de capture de session (P0 — write path Valence).
 *
 * Orchestre la PREMIÈRE récupération de données réelle, de bout en bout :
 *   1. crée une ligne telemetry_sessions (status 'recording') ;
 *   2. s'abonne au flux BLE (bluetoothService.onData), bufferise les trames,
 *      et les INSÈRE par paquets dans telemetry_frames ;
 *   3. lance la détection de tours (lapDetectionRunner → useSessionStore) et la
 *      capture .ubx locale (captureMode) comme filet de sécurité ;
 *   4. à l'arrêt : flush final (attend un flush en vol puis draine), persiste
 *      les tours dans `laps`, calcule les agrégats, passe la session en
 *      'completed', upload le .ubx.
 *
 * Le mapping trame→ligne est isolé et testé (captureFrameMapping). Ici on ne
 * fait que l'orchestration réseau/état.
 *
 * Doctrine « silence en piste » : ce service n'affiche rien. La capture tourne
 * tant que l'app est au premier plan (V1 ; BLE arrière-plan = entitlements à
 * venir). `elapsed_ms` dérive de l'horloge murale, rendu MONOTONE par session
 * (un éventuel recul d'horloge / throttling arrière-plan ne réordonne pas les
 * trames). iTOW est stocké pour un ordonnancement plus robuste ultérieur.
 */

import { bluetoothService } from '@/ble/bluetoothService';
import { startCapture, stopCapture } from '@/ble/captureMode';
import {
  type RecordedLap,
  getRecordedLaps,
  startLapDetection,
  stopLapDetection,
} from '@/ble/lapDetectionRunner';
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
  dropped: number;
  lastElapsed: number;
  maxima: SessionMaxima;
  unsubData: () => void;
  timer: ReturnType<typeof setInterval> | null;
  flushing: boolean;
  flushPromise: Promise<void> | null;
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
    dropped: 0,
    lastElapsed: 0,
    maxima: { ...EMPTY_MAXIMA },
    unsubData: () => undefined,
    timer: null,
    flushing: false,
    flushPromise: null,
  };
  current = state;

  // Filet de sécurité : capture .ubx brute locale (jamais bloquant).
  try {
    startCapture();
  } catch {
    /* capture locale indisponible — les frames partent quand même en DB */
  }

  // Détection de tours (compteurs live dans le store + enregistrement détaillé).
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
    // elapsed monotone : on n'autorise jamais un recul (clock skew / throttling).
    const elapsed = Math.max(Date.now() - state.startMs, state.lastElapsed);
    state.lastElapsed = elapsed;
    state.buffer.push(raceBoxToFrameInsert(frame, sessionId, elapsed));
    state.maxima = updateMaxima(state.maxima, frame);
    if (state.buffer.length >= FLUSH_EVERY_FRAMES) void flush(state);
  });
  state.timer = setInterval(() => void flush(state), FLUSH_INTERVAL_MS);

  return { ok: true, sessionId };
}

/**
 * Draine le buffer dans telemetry_frames. Non réentrant : un appel concurrent
 * renvoie la promesse du flush en cours. La boucle vide tout le buffer (y
 * compris les trames ajoutées pendant l'écriture), donc un flush final attendu
 * ne laisse aucune queue de session derrière lui.
 */
function flush(state: CaptureState): Promise<void> {
  if (state.flushing) return state.flushPromise ?? Promise.resolve();
  state.flushing = true;
  state.flushPromise = (async () => {
    try {
      while (state.buffer.length > 0) {
        const batch = state.buffer.splice(0); // prend tout, vide en place
        const { error } = await supabase.from('telemetry_frames').insert(batch as never);
        if (error) {
          // Lot perdu (réseau) : on compte la perte ; le .ubx local sert de filet.
          state.dropped += batch.length;
          console.warn('[OXV][capture] écriture frames KO :', error.message);
        } else {
          state.total += batch.length;
        }
      }
    } finally {
      state.flushing = false;
    }
  })();
  return state.flushPromise;
}

/** Attend la fin d'un flush éventuellement en vol, puis draine ce qui reste. */
async function drain(state: CaptureState): Promise<void> {
  if (state.flushPromise) {
    try {
      await state.flushPromise;
    } catch {
      /* déjà loggé */
    }
  }
  await flush(state);
}

/** Persiste les tours détectés dans la table laps (best-effort). */
async function persistLaps(state: CaptureState, laps: RecordedLap[]): Promise<void> {
  if (laps.length === 0) return;
  const bestMs = Math.min(...laps.map((l) => l.durationMs));
  const rows = laps.map((l) => ({
    session_id: state.sessionId,
    lap_number: l.lapNumber,
    duration_seconds: l.durationMs / 1000,
    started_at: new Date(l.startedAtMs).toISOString(),
    ended_at: new Date(l.endedAtMs).toISOString(),
    start_lat: l.startLat,
    start_lon: l.startLon,
    end_lat: l.endLat,
    end_lon: l.endLon,
    is_best_lap: l.durationMs === bestMs,
    is_outlap: false,
    is_inlap: false,
  }));
  const { error } = await supabase.from('laps').insert(rows as never);
  if (error) console.warn('[OXV][capture] écriture laps KO :', error.message);
}

export interface StopCaptureResult {
  ok: boolean;
  sessionId?: string;
  ubxUri?: string | null;
  totalFrames?: number;
  droppedFrames?: number;
  error?: string;
}

/**
 * Arrête l'enregistrement : flush final, persistance des tours, agrégats,
 * status 'completed', upload .ubx. Retourne sessionId + ubxUri pour le bilan.
 */
export async function stopCaptureSession(): Promise<StopCaptureResult> {
  // Capture-and-null synchrone : un second appel concurrent court-circuite.
  const state = current;
  current = null;
  if (!state) return { ok: false, error: 'Aucune capture active.' };

  // 1. Stoppe l'arrivée de nouvelles trames + le timer, puis flush final complet.
  state.unsubData();
  if (state.timer) clearInterval(state.timer);
  await drain(state);

  // 2. Arrête la détection de tours, relève compteurs + tours détaillés.
  stopLapDetection();
  const recordedLaps = getRecordedLaps();
  const store = useSessionStore.getState();
  const lapCount = store.lapCount;
  const bestLapSeconds = store.bestLapMs != null ? store.bestLapMs / 1000 : null;
  store.endSession();

  // 3. Persiste les tours détaillés (régularité + tour-par-tour du bilan).
  await persistLaps(state, recordedLaps);

  // 4. Ferme la capture .ubx locale (filet de sécurité).
  let ubxUri: string | null = null;
  try {
    ubxUri = await stopCapture();
  } catch {
    ubxUri = null;
  }

  // 5. Marque la session 'completed' avec les agrégats.
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
  if (state.dropped > 0) {
    console.warn(`[OXV][capture] ${state.dropped} trame(s) perdue(s) à l'écriture (filet .ubx).`);
  }

  const { sessionId, userId, total, dropped } = state;

  // 6. Upload du .ubx brut en arrière-plan (best-effort, non bloquant).
  if (ubxUri) {
    uploadTelemetryFile({ fileUri: ubxUri, userId, telemetrySessionId: sessionId }).catch((e) =>
      console.warn('[OXV][capture] upload .ubx KO :', e instanceof Error ? e.message : e)
    );
  }

  return { ok: true, sessionId, ubxUri, totalFrames: total, droppedFrames: dropped };
}

/** Abandonne la capture en cours : marque 'aborted', sans router vers le bilan. */
export async function abortCaptureSession(): Promise<void> {
  const state = current;
  current = null;
  if (!state) return;
  state.unsubData();
  if (state.timer) clearInterval(state.timer);
  // Attend un flush éventuellement en vol pour ne pas écrire après l'abandon.
  if (state.flushPromise) {
    try {
      await state.flushPromise;
    } catch {
      /* ignore */
    }
  }
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
}
