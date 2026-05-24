/**
 * Store de la state machine du pilote OXV Coach.
 *
 * Source de vérité de `state: PilotState` (S1..S10). Recalcule l'état
 * via `determineState()` à chaque changement de contexte (sessions,
 * position, recording actif). Les conditions techniques (réseau,
 * bluetooth, etc.) ne changent pas l'état principal — elles modulent
 * juste les overlays UI (cf. [[useUIStore]]).
 *
 * Voir docs/sitemap/04_state_machine.md pour la spec.
 */

import { create } from 'zustand';

import {
  AppContext,
  Conditions,
  DEFAULT_CONDITIONS,
  PilotState,
  PositionFix,
  RecordingState,
  ScreenId,
  SessionRef,
  determineState,
  isScreenValid,
} from '@/types/state';

interface AppStateStore {
  // Entrées
  hasAccount: boolean;
  onboardingComplete: boolean;
  upcomingSessions: SessionRef[];
  pastSessions: SessionRef[];
  activeRecording: RecordingState | null;
  position: PositionFix | null;
  conditions: Conditions;

  // Dérivé (recalculé via recompute())
  state: PilotState;

  // Actions
  setUser: (hasAccount: boolean, onboardingComplete: boolean) => void;
  setSessions: (upcoming: SessionRef[], past: SessionRef[]) => void;
  setActiveRecording: (recording: RecordingState | null) => void;
  setPosition: (position: PositionFix | null) => void;
  setCondition: <K extends keyof Conditions>(key: K, value: Conditions[K]) => void;
  recompute: () => void;
  reset: () => void;

  // Sélecteur d'écran valide
  canShowScreen: (screen: ScreenId) => boolean;
}

const initialState = {
  hasAccount: false,
  onboardingComplete: false,
  upcomingSessions: [] as SessionRef[],
  pastSessions: [] as SessionRef[],
  activeRecording: null as RecordingState | null,
  position: null as PositionFix | null,
  conditions: { ...DEFAULT_CONDITIONS },
  state: 'S1_decouverte' as PilotState,
};

export const useAppStateStore = create<AppStateStore>((set, get) => ({
  ...initialState,

  setUser: (hasAccount, onboardingComplete) => {
    set({ hasAccount, onboardingComplete });
    get().recompute();
  },

  setSessions: (upcomingSessions, pastSessions) => {
    set({ upcomingSessions, pastSessions });
    get().recompute();
  },

  setActiveRecording: (activeRecording) => {
    set({ activeRecording });
    get().recompute();
  },

  setPosition: (position) => {
    set({ position });
    get().recompute();
  },

  setCondition: (key, value) => {
    set((s) => ({ conditions: { ...s.conditions, [key]: value } }));
    // Volontaire : pas de recompute(). Les conditions techniques modulent
    // les overlays UI mais ne changent pas l'état machine principal.
  },

  recompute: () => {
    const s = get();
    const ctx: AppContext = {
      hasAccount: s.hasAccount,
      onboardingComplete: s.onboardingComplete,
      upcomingSessions: s.upcomingSessions,
      pastSessions: s.pastSessions,
      activeRecording: s.activeRecording,
      position: s.position,
      conditions: s.conditions,
      now: new Date(),
    };
    const next = determineState(ctx);
    if (next !== s.state) set({ state: next });
  },

  reset: () => set({ ...initialState }),

  canShowScreen: (screen) => isScreenValid(screen, get().state),
}));
