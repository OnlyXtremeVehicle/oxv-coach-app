/**
 * useCaptureStep — contrat PARTAGÉ du flux de capture v2 (lot V2-L2, PORTE REC).
 *
 * Lit `useAppStateStore` en LECTURE SEULE (sélecteur `state`) et renvoie
 * l'étape courante + sa route via la logique pure `captureStep`. N'écrit JAMAIS
 * dans le store : la state machine (S1..S10) reste intacte — les écrans v2 sont
 * une peau sur les mêmes états que la v1.
 *
 * Les autres écrans du lot (préparation, équipement, placement, entre-runs,
 * fin) peuvent l'importer pour connaître, sans dupliquer la table, l'étape que
 * l'état pilote implique.
 */

import { useAppStateStore } from '@/store/useAppStateStore';

import { captureStep, type CaptureStepResult } from './captureStepLogic';

export function useCaptureStep(): CaptureStepResult {
  const state = useAppStateStore((s) => s.state);
  return captureStep(state);
}
