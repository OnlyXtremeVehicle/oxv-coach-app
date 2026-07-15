/**
 * Détection de tours en live sur le stream BLE RaceBox.
 *
 * Démarré à l'ouverture d'une session de roulage (manuel pour V1 depuis
 * l'écran de capture, automatique en sem. 5+ quand le flow paddock sera
 * câblé).
 *
 * Architecture :
 *   bluetoothService.onData (RaceBoxData)
 *     ↓ filter sur gps.fix == Fix3D
 *     ↓ processGpsPoint (V1 utils/lapDetection)
 *     ↓ si tour complet
 *         ↓ useSessionStore.registerLap(durationMs)
 *
 * Le premier passage de ligne après start = outlap, pas compté comme tour
 * valide (`previousLapAt` n'est set qu'après ce premier passage).
 */

import { bluetoothService } from './bluetoothService';
import { useSessionStore } from '@/store/useSessionStore';
import { GpsFix } from '@/types/telemetry';
import { nextMonotonic } from '@/utils/monotonicClock';
import {
  type LapDetectorState,
  createLapDetector,
  processGpsPoint,
  resetLapDetector,
} from '@/utils/lapDetection';

let state: LapDetectorState | null = null;
let unsubscribe: (() => void) | null = null;
/** Instant MURAL (Date.now) du dernier passage — sert à l'affichage des dates. */
let previousLapWallMs: number | null = null;
/** Instant MONOTONE du dernier passage — sert à MESURER la durée du tour. */
let previousLapMonoMs: number | null = null;
/** Dernière base monotone retenue (max-monotone sur l'horloge murale). */
let lastMonoMs = 0;
let previousLapLat: number | null = null;
let previousLapLon: number | null = null;
let lapNumber = 0;

/** Un tour complet détecté, prêt à être persisté dans la table `laps`. */
export interface RecordedLap {
  lapNumber: number;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
}

let recordedLaps: RecordedLap[] = [];

/** Tours détaillés enregistrés depuis le dernier startLapDetection (snapshot). */
export function getRecordedLaps(): RecordedLap[] {
  return [...recordedLaps];
}

export interface LapDetectionStartOptions {
  finishLineLat: number;
  finishLineLon: number;
  finishLineRadiusM?: number;
}

export function startLapDetection(opts: LapDetectionStartOptions): void {
  stopLapDetection();
  state = createLapDetector(opts.finishLineLat, opts.finishLineLon, opts.finishLineRadiusM ?? 30);
  previousLapWallMs = null;
  previousLapMonoMs = null;
  lastMonoMs = 0;
  previousLapLat = null;
  previousLapLon = null;
  lapNumber = 0;
  recordedLaps = [];

  unsubscribe = bluetoothService.onData((frame) => {
    if (!state) return;
    if (frame.gps.fix < GpsFix.Fix3D) return;

    // Deux horloges, deux usages distincts (Valencia §4.6) :
    //   - `wallNow` (horloge murale) : instant D'AFFICHAGE, horodate les dates de
    //     début/fin de tour (startedAtMs/endedAtMs → ISO). Le recul éventuel de
    //     cette horloge n'affecte que l'étiquette de date, pas la mesure.
    //   - `monoNow` (base MONOTONE) : instant de MESURE. Non décroissant (max avec
    //     le dernier point), il sert à la fois au cooldown de détection et au
    //     calcul de la durée — jamais faussé par un recul d'horloge (throttling
    //     arrière-plan / resynchro NTP). Même convention que l'`elapsed_ms` des
    //     trames dans captureSessionService.
    const wallNow = Date.now();
    lastMonoMs = nextMonotonic(lastMonoMs, wallNow);
    const monoNow = lastMonoMs;
    const completedLap = processGpsPoint(state, frame.gps.latitude, frame.gps.longitude, monoNow);

    if (!completedLap) {
      return;
    }

    if (previousLapMonoMs !== null && previousLapWallMs !== null) {
      // Durée = différence de deux instants MONOTONES → toujours ≥ 0.
      const lapDurationMs = monoNow - previousLapMonoMs;
      lapNumber += 1;
      useSessionStore.getState().registerLap(lapDurationMs);
      recordedLaps.push({
        lapNumber,
        // startedAt/endedAt = instants MURAUX (dates affichables).
        startedAtMs: previousLapWallMs,
        endedAtMs: wallNow,
        // durationMs = durée MESURÉE sur la base monotone.
        durationMs: lapDurationMs,
        startLat: previousLapLat,
        startLon: previousLapLon,
        endLat: frame.gps.latitude,
        endLon: frame.gps.longitude,
      });
    }
    // Le premier passage = fin d'outlap : on mémorise le point de départ du
    // premier tour chronométré, sans le compter.
    previousLapWallMs = wallNow;
    previousLapMonoMs = monoNow;
    previousLapLat = frame.gps.latitude;
    previousLapLon = frame.gps.longitude;
  });
}

export function stopLapDetection(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (state) resetLapDetector(state);
  state = null;
  previousLapWallMs = null;
  previousLapMonoMs = null;
  lastMonoMs = 0;
}

export interface LapDetectorStatus {
  active: boolean;
  rawCrossings: number;
}

export function getLapDetectorStatus(): LapDetectorStatus {
  return {
    active: state !== null,
    rawCrossings: state?.lapEndTimestamps.length ?? 0,
  };
}
