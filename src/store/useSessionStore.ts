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
import type { TrouLiaison } from '@/features/rec/interruptionLogic';

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
  /**
   * Trous de liaison relevés pendant ce run — lot 21e.
   *
   * La capture les CALCULAIT déjà et les jetait dans la console. Les retenir ici
   * est le strict nécessaire pour que le retour au stand puisse en dire quelque
   * chose : la restitution attendue par le plan — durée, et part du tour de
   * référence — n'avait aucune source de données.
   *
   * SILENCE EN PISTE : rien de ceci ne s'affiche pendant le roulage. C'est un
   * relevé, pas un signal.
   */
  linkGaps: TrouLiaison[];

  startSession: (meta: ActiveSessionMeta) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  abortSession: () => void;
  registerLap: (lapMs: number) => void;
  addMarker: (marker: LapMarker) => void;
  /** Enregistre un trou de liaison à la reprise. Appelé par la capture. */
  addLinkGap: (gap: TrouLiaison) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as RecordingStatus,
  meta: null as ActiveSessionMeta | null,
  lapCount: 0,
  bestLapMs: null as number | null,
  markers: [] as LapMarker[],
  linkGaps: [] as TrouLiaison[],
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

  addLinkGap: (gap) =>
    set((s) => ({
      // Un trou de durée nulle ou négative n'est pas un trou : le retenir
      // gonflerait un compte que le pilote lira.
      linkGaps: Number.isFinite(gap.dureeMs) && gap.dureeMs > 0 ? [...s.linkGaps, gap] : s.linkGaps,
    })),

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
