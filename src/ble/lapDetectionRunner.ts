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
import {
  type LapDetectorState,
  createLapDetector,
  processGpsPoint,
  resetLapDetector,
} from '@/utils/lapDetection';

let state: LapDetectorState | null = null;
let unsubscribe: (() => void) | null = null;
let previousLapAt: number | null = null;
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
  previousLapAt = null;
  previousLapLat = null;
  previousLapLon = null;
  lapNumber = 0;
  recordedLaps = [];

  unsubscribe = bluetoothService.onData((frame) => {
    if (!state) return;
    if (frame.gps.fix < GpsFix.Fix3D) return;

    // Timestamp en epoch ms : monotonique au mieux pour mesurer les
    // durées intra-session (iTOW GPS serait + précis mais plus complexe
    // pour les chronos affichés ; à faire en sem. 5 si nécessaire).
    const now = Date.now();
    const completedLap = processGpsPoint(state, frame.gps.latitude, frame.gps.longitude, now);

    if (!completedLap) {
      return;
    }

    if (previousLapAt !== null) {
      const lapDurationMs = now - previousLapAt;
      lapNumber += 1;
      useSessionStore.getState().registerLap(lapDurationMs);
      recordedLaps.push({
        lapNumber,
        startedAtMs: previousLapAt,
        endedAtMs: now,
        durationMs: lapDurationMs,
        startLat: previousLapLat,
        startLon: previousLapLon,
        endLat: frame.gps.latitude,
        endLon: frame.gps.longitude,
      });
    }
    // Le premier passage = fin d'outlap : on mémorise le point de départ du
    // premier tour chronométré, sans le compter.
    previousLapAt = now;
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
  previousLapAt = null;
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
