/**
 * captureStepLogic — logique PURE du contrat `useCaptureStep` (lot V2-L2,
 * PORTE REC). Module .ts strictement pur : aucune dépendance React, React
 * Native, Supabase ni store — testé sous ts-jest node
 * (__tests__/captureStepLogic.test.ts).
 *
 * RÈGLE CARDINALE : ce module NE MODIFIE PAS la state machine. Il se contente
 * de PROJETER l'état `PilotState` (S1..S10) courant sur l'étape du flux de
 * capture v2 et sa route. Les écrans v2 sont une PEAU sur les mêmes états que
 * la v1 ; ce mapping est la seule table qui relie l'un à l'autre.
 *
 * Deux familles d'états :
 *   - HORS JOUR J (S1 découverte, S2 initiation, S3 attente, S4 anticipation,
 *     S10 repos) → step 'hors-jour', route null : le HUB (rec/index) rend son
 *     propre contenu (voiture + cadran de compte à rebours + Préparation, ou
 *     RÉSERVER). Pour S4, « l'étape courante » EST le hub : la journée est à
 *     venir, le flux n'a pas commencé — c'est là que vit le cadran countdown.
 *   - JOUR J (le pilote est sur/vers le circuit, ou la séance vient de finir) →
 *     le hub REDIRIGE vers l'écran de l'étape courante :
 *       S5 approche   → arrivee    (« Vous y êtes »)
 *       S6 roulage    → roulage    (silence en piste)
 *       S7 paddock    → entre-runs (pause entre deux runs)
 *       S8 / S9       → fin        (fin de séance / décantation)
 */

import type { PilotState } from '@/types/state';

/** Les 8 étapes du flux de capture v2 (écrans 1/8 → 8/8). */
export type CaptureStep =
  | 'hors-jour'
  | 'preparation'
  | 'arrivee'
  | 'equipement'
  | 'placement'
  | 'roulage'
  | 'entre-runs'
  | 'fin';

export interface CaptureStepResult {
  /** Étape du flux déduite de l'état pilote. */
  step: CaptureStep;
  /**
   * Route expo-router vers laquelle le HUB doit rediriger, ou `null` quand le
   * hub reste sur lui-même (hors jour J).
   */
  route: string | null;
}

/**
 * Routes du flux de capture v2, sous /(app2)/rec/<segment>. Les segments
 * immersifs (arrivee, equipement, placement, roulage, fin) sont ceux de
 * `centralButtonLogic.V2_HIDDEN_SEGMENTS` — la TabBar s'y efface. `preparation`
 * et `entre-runs` restent hors de cette liste (barre visible), conformément au
 * contrat de coquille du lot L0.
 */
export const REC_ROUTES = {
  hub: '/(app2)/rec',
  preparation: '/(app2)/rec/preparation',
  arrivee: '/(app2)/rec/arrivee',
  equipement: '/(app2)/rec/equipement',
  placement: '/(app2)/rec/placement',
  roulage: '/(app2)/rec/roulage',
  entreRuns: '/(app2)/rec/entre-runs',
  fin: '/(app2)/rec/fin',
} as const;

/**
 * Projette l'état pilote sur l'étape du flux de capture. Fonction totale
 * (toutes les valeurs de `PilotState` couvertes) : un état hors jour J ne
 * redirige jamais (route null) ; un état de jour J porte la route immersive.
 */
export function captureStep(state: PilotState): CaptureStepResult {
  switch (state) {
    case 'S5_approche':
      return { step: 'arrivee', route: REC_ROUTES.arrivee };
    case 'S6_roulage':
      return { step: 'roulage', route: REC_ROUTES.roulage };
    case 'S7_paddock':
      return { step: 'entre-runs', route: REC_ROUTES.entreRuns };
    case 'S8_atterrissage':
    case 'S9_decantation':
      return { step: 'fin', route: REC_ROUTES.fin };
    case 'S1_decouverte':
    case 'S2_initiation':
    case 'S3_attente':
    case 'S4_anticipation':
    case 'S10_repos':
      return { step: 'hors-jour', route: null };
  }
}
