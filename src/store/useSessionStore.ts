/**
 * Store de la session de roulage active.
 *
 * Garde en mémoire la session courante (id Supabase, métadonnées),
 * les compteurs live (lap_count, best_lap_ms, durée), et les marqueurs
 * Flic 2 pressés pendant la session.
 *
 * La vraie persistance Supabase et la sync offline sont câblées en
 * semaines 3-4 (WatermelonDB + sessionsService).
 */

import { create } from 'zustand';

import { LapMarker } from '@/types/domain';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'completed' | 'aborted';

export interface ActiveSessionMeta {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  circuitId: string | null;
  vehicleId: string | null;
}

interface SessionStore {
  status: RecordingStatus;
  meta: ActiveSessionMeta | null;
  lapCount: number;
  bestLapMs: number | null;
  /** Marqueurs Flic 2 pressés pendant la session, triés par timestamp. */
  markers: LapMarker[];

  startSession: (meta: ActiveSessionMeta) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  abortSession: () => void;
  registerLap: (lapMs: number) => void;
  addMarker: (marker: LapMarker) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as RecordingStatus,
  meta: null as ActiveSessionMeta | null,
  lapCount: 0,
  bestLapMs: null as number | null,
  markers: [] as LapMarker[],
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  ...initialState,

  startSession: (meta) =>
    set({
      status: 'recording',
      meta,
      lapCount: 0,
      bestLapMs: null,
      markers: [],
    }),

  pauseSession: () => {
    if (get().status === 'recording') set({ status: 'paused' });
  },

  resumeSession: () => {
    if (get().status === 'paused') set({ status: 'recording' });
  },

  endSession: () =>
    set((s) => ({
      status: 'completed',
      meta: s.meta ? { ...s.meta, endedAt: new Date() } : null,
    })),

  abortSession: () =>
    set((s) => ({
      status: 'aborted',
      meta: s.meta ? { ...s.meta, endedAt: new Date() } : null,
    })),

  registerLap: (lapMs) =>
    set((s) => ({
      lapCount: s.lapCount + 1,
      bestLapMs: s.bestLapMs === null || lapMs < s.bestLapMs ? lapMs : s.bestLapMs,
    })),

  addMarker: (marker) =>
    set((s) => ({
      markers: [...s.markers, marker].sort((a, b) => a.at - b.at),
    })),

  reset: () => set({ ...initialState }),
}));
