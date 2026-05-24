/**
 * Algorithme de détection des tours OXV
 *
 * Principe :
 * 1. L'utilisateur calibre une ligne d'arrivée (point GPS + rayon)
 * 2. À chaque frame, on calcule la distance entre la position et ce point
 * 3. Si la distance entre dans le rayon (typ. 30m) → entrée zone
 * 4. Si on sort de la zone → fin de tour si on était dans la zone
 * 5. Cooldown 10 secondes minimum entre 2 tours (anti-faux positifs)
 *
 * Pour V1 :
 * - Pas de vérification de direction (V2)
 * - Pas de détection des secteurs (V2)
 * - Premier "tour" = outlap (mise en route)
 */

import { haversineDistance } from './geo';

export interface LapDetectorState {
  // Configuration
  finishLineLat: number;
  finishLineLon: number;
  finishLineRadius: number; // mètres

  // État interne
  isInsideZone: boolean; // actuellement dans la zone d'arrivée
  enteredZoneAt: number | null; // timestamp ms d'entrée dans la zone
  lastLapEndAt: number | null; // timestamp ms de fin du dernier tour

  // Tours détectés (timestamps de fin de tour)
  lapEndTimestamps: number[];
}

const COOLDOWN_MS = 10000; // 10 sec minimum entre 2 tours

export function createLapDetector(
  finishLineLat: number,
  finishLineLon: number,
  finishLineRadius: number = 30
): LapDetectorState {
  return {
    finishLineLat,
    finishLineLon,
    finishLineRadius,
    isInsideZone: false,
    enteredZoneAt: null,
    lastLapEndAt: null,
    lapEndTimestamps: [],
  };
}

/**
 * Traite une nouvelle position GPS
 * @returns true si un tour vient d'être complété
 */
export function processGpsPoint(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number
): boolean {
  if (!lat || !lon) return false;

  // Distance à la ligne d'arrivée
  const distance = haversineDistance(lat, lon, state.finishLineLat, state.finishLineLon);

  const isCurrentlyInside = distance < state.finishLineRadius;

  // Transition : entrée dans la zone
  if (isCurrentlyInside && !state.isInsideZone) {
    state.isInsideZone = true;
    state.enteredZoneAt = timestamp;

    // Vérifier le cooldown
    if (state.lastLapEndAt !== null) {
      const sinceLastLap = timestamp - state.lastLapEndAt;
      if (sinceLastLap < COOLDOWN_MS) {
        // Trop tôt, on ignore
        return false;
      }
    }

    // C'est un nouveau passage → fin du tour précédent (si tour en cours)
    state.lastLapEndAt = timestamp;
    state.lapEndTimestamps.push(timestamp);
    return true;
  }

  // Transition : sortie de la zone
  if (!isCurrentlyInside && state.isInsideZone) {
    state.isInsideZone = false;
    state.enteredZoneAt = null;
  }

  return false;
}

/**
 * Réinitialise le détecteur (à la fin d'une session)
 */
export function resetLapDetector(state: LapDetectorState): void {
  state.isInsideZone = false;
  state.enteredZoneAt = null;
  state.lastLapEndAt = null;
  state.lapEndTimestamps = [];
}

/**
 * Format un temps au tour en mm:ss.SSS
 */
export function formatLapTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const min = Math.floor(totalMs / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${min}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Format un delta de temps : +5.234s ou -1.123s
 */
export function formatLapDelta(seconds: number): string {
  const abs = Math.abs(seconds);
  const sign = seconds >= 0 ? '+' : '-';
  return `${sign}${abs.toFixed(3)}s`;
}
