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

import { bluetoothService, type ReconnectState } from '@/ble/bluetoothService';
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

/**
 * Repli de DERNIER recours si l'appelant ne fournit pas la ligne d'arrivée du
 * circuit. Ces coordonnées ne correspondent à aucun circuit réel : si on retombe
 * dessus, les tours ne seront PAS comptés. Le flux normal passe `input.finishLine`
 * (cf. `placement.tsx` + `captureFinishLineFor`).
 */
export const BELTOISE_FINISH = { lat: 45.6004, lon: -0.141, radiusM: 40 };

const FLUSH_EVERY_FRAMES = 50;
const FLUSH_INTERVAL_MS = 4_000;

/**
 * État de la capture vis-à-vis du lien BLE, distinct du statut Supabase de la
 * session. Permet à l'UI de capture de ne JAMAIS laisser croire qu'on enregistre
 * alors que le boîtier a décroché :
 *
 *   - `recording`   : lien stable, trames en arrivée.
 *   - `interrupted` : lien tombé, reconnexion auto en cours (capture en pause).
 *   - `lost`        : reconnexion épuisée — capture finalisée proprement.
 *   - `idle`        : aucune capture active.
 */
export type CaptureLinkStatus = 'idle' | 'recording' | 'interrupted' | 'lost';

type CaptureLinkListener = (status: CaptureLinkStatus) => void;

let linkStatus: CaptureLinkStatus = 'idle';
const linkListeners: CaptureLinkListener[] = [];

/**
 * S'abonne au statut de lien de la capture (recording/interrupted/lost/idle).
 * Émet l'état courant à l'abonnement. Rendu disponible pour l'écran de capture.
 */
export function onCaptureLinkStatus(listener: CaptureLinkListener): () => void {
  linkListeners.push(listener);
  listener(linkStatus);
  return () => {
    const i = linkListeners.indexOf(listener);
    if (i >= 0) linkListeners.splice(i, 1);
  };
}

export function getCaptureLinkStatus(): CaptureLinkStatus {
  return linkStatus;
}

function setLinkStatus(next: CaptureLinkStatus): void {
  if (linkStatus === next) return;
  linkStatus = next;
  for (const l of linkListeners) l(next);
}

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
  /** Désabonnement du suivi de reconnexion BLE (interruption/lost). */
  unsubReconnect: () => void;
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
      circuit_name: input.circuitName ?? 'Circuit',
      vehicle_id: input.vehicleId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Création de session impossible.' };
  }

  const sessionId = (data as { id: string }).id;
  const startMs = Date.now();
  const finish = input.finishLine ?? BELTOISE_FINISH;
  if (!input.finishLine) {
    console.warn(
      "[OXV] startCaptureSession sans ligne d'arrivée du circuit — repli par défaut ; " +
        'les tours risquent de ne pas être détectés. Passer circuit.finishLine.'
    );
  }

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
    unsubReconnect: () => undefined,
    timer: null,
    flushing: false,
    flushPromise: null,
  };
  current = state;
  setLinkStatus('recording');

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

  // Suit la reconnexion BLE pour ne jamais compter contre un lien mort en
  // silence : on met la capture en pause pendant les tentatives, on reprend à
  // la reconnexion, et on finalise proprement si la liaison est perdue.
  state.unsubReconnect = bluetoothService.onReconnectChange((rc: ReconnectState) => {
    if (current !== state) return;
    handleReconnect(state, rc);
  });

  return { ok: true, sessionId };
}

/**
 * Réagit aux phases de reconnexion BLE pendant une capture active.
 *
 *   - `reconnecting` : lien tombé → capture « interrompue », compteurs live en
 *     pause (les trames ne tombent plus, on ne fige pas l'UI en « enregistre »).
 *   - `idle` revenant alors qu'on était interrompu → lien rétabli, on reprend.
 *   - `lost` : reconnexion épuisée → on finalise la capture proprement (flush +
 *     agrégats) sans rester sur un état figé.
 */
function handleReconnect(state: CaptureState, rc: ReconnectState): void {
  if (rc.phase === 'reconnecting') {
    if (linkStatus !== 'interrupted') {
      setLinkStatus('interrupted');
      useSessionStore.getState().pauseSession();
    }
  } else if (rc.phase === 'idle') {
    if (linkStatus === 'interrupted') {
      setLinkStatus('recording');
      useSessionStore.getState().resumeSession();
    }
  } else if (rc.phase === 'lost') {
    // Terminal : on stoppe la capture proprement (best-effort, non bloquant).
    setLinkStatus('lost');
    void finalizeOnLostLink();
  }
}

/**
 * Finalise la capture après une perte définitive de liaison : réutilise le
 * chemin d'arrêt normal (flush final, persistance tours, agrégats, status
 * 'completed', upload .ubx), puis garde le statut de lien sur `lost` pour que
 * l'UI affiche un terminal clair (et non un faux « en enregistrement »).
 */
async function finalizeOnLostLink(): Promise<void> {
  if (!current) return;
  try {
    await stopCaptureSession();
  } catch (e) {
    console.warn(
      '[OXV][capture] finalisation après liaison perdue KO :',
      e instanceof Error ? e.message : e
    );
  }
  // stopCaptureSession remet le statut à 'idle' ; on rétablit 'lost' pour l'UI.
  setLinkStatus('lost');
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
        const { error } = await supabase.from('telemetry_frames').insert(batch);
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
  const { error } = await supabase.from('laps').insert(rows);
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
  // Capture terminée : retour au statut de lien neutre (un arrêt sur liaison
  // perdue rétablira 'lost' après coup, cf. finalizeOnLostLink).
  setLinkStatus('idle');

  // 1. Stoppe l'arrivée de nouvelles trames + le timer + le suivi reconnexion,
  //    puis flush final complet.
  state.unsubData();
  state.unsubReconnect();
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
    })
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
  setLinkStatus('idle');
  state.unsubData();
  state.unsubReconnect();
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
    .update({ status: 'aborted', ended_at: new Date().toISOString() })
    .eq('id', state.sessionId)
    .eq('user_id', state.userId);
}
