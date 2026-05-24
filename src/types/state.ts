/**
 * Machine à états du pilote OXV Coach.
 *
 * 10 états (S1 → S10) qui pilotent quels écrans sont valides à tout
 * moment. Voir docs/sitemap/04_state_machine.md pour la spec complète.
 *
 * Le pilote est à tout instant dans UN état. Une fonction pure
 * `determineState(ctx)` calcule l'état courant à partir d'un contexte
 * (user, session active, conditions techniques). On ne mute jamais
 * l'état directement ; on recalcule à chaque changement de contexte.
 */

// ============================================================
// LES 10 ÉTATS DU PILOTE
// ============================================================

export type PilotState =
  | 'S1_decouverte'
  | 'S2_initiation'
  | 'S3_attente'
  | 'S4_anticipation'
  | 'S5_approche'
  | 'S6_roulage'
  | 'S7_paddock'
  | 'S8_atterrissage'
  | 'S9_decantation'
  | 'S10_repos';

export const ALL_PILOT_STATES: readonly PilotState[] = [
  'S1_decouverte',
  'S2_initiation',
  'S3_attente',
  'S4_anticipation',
  'S5_approche',
  'S6_roulage',
  'S7_paddock',
  'S8_atterrissage',
  'S9_decantation',
  'S10_repos',
] as const;

// ============================================================
// CONDITIONS TECHNIQUES MODULATRICES
// ============================================================

export type NetworkCondition = 'online' | 'offline';
export type BluetoothCondition = 'stable' | 'reconnecting' | 'lost' | 'unused';
export type GeolocationCondition = 'granted' | 'denied' | 'unavailable';
export type AppVersionCondition = 'current' | 'updateAvailable';
export type EquipmentCondition = 'assigned' | 'unassigned';
export type PactCondition = 'accepted' | 'expired' | 'unsigned';

export interface Conditions {
  network: NetworkCondition;
  bluetooth: BluetoothCondition;
  geolocation: GeolocationCondition;
  appVersion: AppVersionCondition;
  equipment: EquipmentCondition;
  pact: PactCondition;
}

export const DEFAULT_CONDITIONS: Conditions = {
  network: 'online',
  bluetooth: 'unused',
  geolocation: 'granted',
  appVersion: 'current',
  equipment: 'unassigned',
  pact: 'accepted',
};

// ============================================================
// CONTEXTE DE DÉTERMINATION D'ÉTAT
// ============================================================

export interface AppContext {
  hasAccount: boolean;
  onboardingComplete: boolean;
  /** Sessions OXV (track day) à venir, triées par date croissante. */
  upcomingSessions: SessionRef[];
  /** Sessions passées récentes, triées par date décroissante. */
  pastSessions: SessionRef[];
  /** Session de roulage actuellement enregistrée (BLE actif). */
  activeRecording: RecordingState | null;
  /** Position GPS courante (si geolocation accordée). */
  position: PositionFix | null;
  /** Conditions techniques courantes. */
  conditions: Conditions;
  /** Maintenant — passé en paramètre pour faciliter les tests. */
  now: Date;
}

export interface SessionRef {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  circuitId: string;
}

export interface RecordingState {
  sessionId: string;
  startedAt: Date;
  status: 'recording' | 'paused' | 'completed';
  /** Vitesse moyenne récente, en km/h. Utilisée pour différencier roulage vs paddock. */
  recentAverageSpeedKmh: number;
}

export interface PositionFix {
  lat: number;
  lon: number;
  /** Distance au circuit cible, en km. Calculée par le store en amont. */
  distanceToCircuitKm: number;
  /** Si true, le téléphone bouge (vitesse > seuil). */
  moving: boolean;
  /** Si true, le cap se rapproche du circuit (heading vers la cible). */
  headingToCircuit: boolean;
  /** Timestamp de la fix. */
  measuredAt: Date;
}

// ============================================================
// VALIDATION D'ÉCRAN PAR ÉTAT
// ============================================================

/**
 * Identifiant d'écran cohérent avec docs/screens/00_OVERVIEW_26_ECRANS.md.
 * Les numéros sont 01..27. Le 21 est variante de 20.
 */
export type ScreenId =
  | '01_accueil_philosophique'
  | '02_doctrine'
  | '03_methode'
  | '04_niveau_pilote'
  | '05_cgu_rgpd'
  | '06_pacte'
  | '07_vous_y_etes'
  | '08_detection_equipement'
  | '09_placement'
  | '10_vous_avez_pilote'
  | '11_donnees_securite'
  | '12_bilan_pret'
  | '13_bilan'
  | '14_carte'
  | '15_zoom_virage'
  | '16_prochaine_fois'
  | '17_progression'
  | '18_comparateur'
  | '19_debrief_j_plus_1'
  | '20_accueil'
  | '21_accueil_en_route'
  | '22_paddock_entre_runs'
  | '23_notifications'
  | '24_settings'
  | '25_ble_error'
  | '26_offline_mode'
  | '27_update_disponible';

/**
 * Écrans accessibles dans chaque état. Source : sitemap/04_state_machine
 * + sitemap/01_architecture_statique. Les "All" (notifications, settings,
 * offline, update) sont valides partout sauf en roulage et en initiation.
 */
const SYSTEM_SCREENS: ScreenId[] = [
  '23_notifications',
  '24_settings',
  '26_offline_mode',
  '27_update_disponible',
];

export const VALID_SCREENS_BY_STATE: Readonly<Record<PilotState, readonly ScreenId[]>> = {
  S1_decouverte: [],
  S2_initiation: [
    '01_accueil_philosophique',
    '02_doctrine',
    '03_methode',
    '04_niveau_pilote',
    '05_cgu_rgpd',
    '06_pacte',
  ],
  S3_attente: ['20_accueil', ...SYSTEM_SCREENS],
  S4_anticipation: ['20_accueil', ...SYSTEM_SCREENS],
  S5_approche: ['21_accueil_en_route', '26_offline_mode'],
  S6_roulage: [],
  S7_paddock: [
    '07_vous_y_etes',
    '08_detection_equipement',
    '09_placement',
    '22_paddock_entre_runs',
    '25_ble_error',
  ],
  S8_atterrissage: [
    '10_vous_avez_pilote',
    '11_donnees_securite',
    '12_bilan_pret',
    '13_bilan',
    '14_carte',
    '15_zoom_virage',
    '16_prochaine_fois',
    ...SYSTEM_SCREENS,
  ],
  S9_decantation: [
    '19_debrief_j_plus_1',
    '13_bilan',
    '14_carte',
    '15_zoom_virage',
    '16_prochaine_fois',
    '17_progression',
    ...SYSTEM_SCREENS,
  ],
  S10_repos: [
    '20_accueil',
    '13_bilan',
    '14_carte',
    '15_zoom_virage',
    '17_progression',
    '18_comparateur',
    ...SYSTEM_SCREENS,
  ],
};

export function isScreenValid(screenId: ScreenId, state: PilotState): boolean {
  return VALID_SCREENS_BY_STATE[state].includes(screenId);
}

// ============================================================
// DÉTERMINATION D'ÉTAT (fonction pure)
// ============================================================

/**
 * Seuils techniques de la state machine. Centralisés pour faciliter
 * la calibration sans toucher à la logique.
 */
export const STATE_THRESHOLDS = {
  /** Distance au circuit pour considérer le pilote "arrivé". */
  atCircuitRadiusKm: 1.0,
  /** Au-dessus de cette vitesse moyenne, on est en roulage. */
  drivingMinSpeedKmh: 60,
  /** Délai max pour rester en S8 après la fin de session (ms). */
  postSessionWindowMs: 2 * 60 * 60 * 1000, // 2h
  /** Délai max pour rester en S9 après J+1. */
  decantationWindowMs: 48 * 60 * 60 * 1000, // 48h
  /** Horizon d'anticipation (j-N déclenche S4). */
  anticipationHorizonDays: 14,
  /** Au-delà, on considère la session "trop proche" (J0). */
  approachWindowHours: 12,
} as const;

/**
 * Calcule l'état du pilote à partir du contexte courant.
 *
 * Ordre d'évaluation important : les conditions hard-blocking en premier
 * (pas de compte, onboarding en cours), puis les conditions de roulage
 * (qui ont priorité sur le hub), puis les conditions temporelles.
 *
 * Règle de sécurité par défaut : si le contexte est ambigu, retourner
 * S3 (attente). Jamais d'état indéterminé.
 */
export function determineState(ctx: AppContext): PilotState {
  if (!ctx.hasAccount) return 'S1_decouverte';
  if (!ctx.onboardingComplete) return 'S2_initiation';

  if (ctx.activeRecording) {
    const speed = ctx.activeRecording.recentAverageSpeedKmh;
    if (speed >= STATE_THRESHOLDS.drivingMinSpeedKmh) return 'S6_roulage';
    return 'S7_paddock';
  }

  const lastEnded = lastEndedAt(ctx.pastSessions);
  if (lastEnded) {
    const sinceMs = ctx.now.getTime() - lastEnded.getTime();
    if (sinceMs < STATE_THRESHOLDS.postSessionWindowMs) return 'S8_atterrissage';
    if (sinceMs < STATE_THRESHOLDS.decantationWindowMs) return 'S9_decantation';
  }

  if (
    ctx.position &&
    ctx.position.distanceToCircuitKm <= STATE_THRESHOLDS.atCircuitRadiusKm &&
    hasSessionToday(ctx)
  ) {
    return 'S7_paddock';
  }

  if (
    ctx.position?.moving &&
    ctx.position.headingToCircuit &&
    hasSessionWithinHours(ctx, STATE_THRESHOLDS.approachWindowHours)
  ) {
    return 'S5_approche';
  }

  const next = ctx.upcomingSessions[0];
  if (next) {
    const daysUntil = (next.startsAt.getTime() - ctx.now.getTime()) / (24 * 60 * 60 * 1000);
    if (daysUntil <= STATE_THRESHOLDS.anticipationHorizonDays && daysUntil >= 0) {
      return 'S4_anticipation';
    }
  }

  if (lastEnded) return 'S10_repos';

  return 'S3_attente';
}

function lastEndedAt(past: SessionRef[]): Date | null {
  for (const s of past) {
    if (s.endsAt) return s.endsAt;
  }
  return null;
}

function hasSessionToday(ctx: AppContext): boolean {
  const start = startOfDay(ctx.now);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return (
    ctx.upcomingSessions.some((s) => s.startsAt >= start && s.startsAt < end) ||
    ctx.pastSessions.some((s) => s.startsAt >= start && s.startsAt < end)
  );
}

function hasSessionWithinHours(ctx: AppContext, hours: number): boolean {
  const horizon = new Date(ctx.now.getTime() + hours * 60 * 60 * 1000);
  return ctx.upcomingSessions.some((s) => s.startsAt <= horizon);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
