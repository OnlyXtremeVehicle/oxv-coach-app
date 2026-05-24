/**
 * Store de télémétrie live BLE.
 *
 * Reçoit les dernières `RaceBoxData` parsées (depuis [[bluetoothService]]
 * via `onData`), maintient un échantillon "récent" pour les écrans qui
 * en ont besoin (en pratique : seulement l'écran de debug en V1, car
 * la doctrine "silence en piste" interdit l'affichage live).
 *
 * Garde aussi le taux de frames courant pour vérifier la santé BLE.
 */

import { create } from 'zustand';

import type { BleStatus, RaceBoxData } from '@/types/telemetry';

interface TelemetryStore {
  bleStatus: BleStatus;
  /** Dernière trame parsée reçue, ou null si rien encore. */
  lastFrame: RaceBoxData | null;
  /** Fréquence en Hz, mesurée par bluetoothService.getCurrentRate(). */
  rateHz: number;
  /** Compteur cumulé sur la session BLE courante. */
  totalFrames: number;
  /** Timestamp ms epoch de la dernière trame reçue. */
  lastFrameAt: number | null;

  setBleStatus: (status: BleStatus) => void;
  pushFrame: (frame: RaceBoxData) => void;
  setRateHz: (rateHz: number) => void;
  reset: () => void;
}

const initialState = {
  bleStatus: 'idle' as BleStatus,
  lastFrame: null as RaceBoxData | null,
  rateHz: 0,
  totalFrames: 0,
  lastFrameAt: null as number | null,
};

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  ...initialState,

  setBleStatus: (bleStatus) => set({ bleStatus }),

  pushFrame: (frame) =>
    set((s) => ({
      lastFrame: frame,
      totalFrames: s.totalFrames + 1,
      lastFrameAt: Date.now(),
    })),

  setRateHz: (rateHz) => set({ rateHz }),

  reset: () => set({ ...initialState }),
}));
