/**
 * useReduceMotion V2 — version SYNCHRONE du kit (lot L0, correctif vérif).
 *
 * L'ancien hook v1 (`src/components/motion/useReduceMotion`) résout
 * AccessibilityInfo.isReduceMotionEnabled() de façon asynchrone : au premier
 * montage il répond `false` pendant quelques frames, donc toute l'entrée d'un
 * écran (porte, radar, cadran, Shimmer) JOUE avant de claquer à l'état final
 * — WCAG 2.3.3 non tenu au premier rendu.
 *
 * Ici : `useReducedMotion()` de Reanimated, lue côté natif de façon
 * synchrone — la bonne valeur dès la première frame. Le kit V2 n'importe
 * plus rien de `src/components/` (isolation en vue de la bascule L6).
 *
 * Note Reanimated 3.10 : la valeur est lue au montage du hook (pas de
 * re-render live sur changement de réglage en cours de session) — suffisant,
 * le réglage système ne bouge pas pendant l'usage et la v1 avait la même
 * limite pratique.
 */

import { useReducedMotion } from 'react-native-reanimated';

export function useReduceMotion(): boolean {
  return useReducedMotion();
}
