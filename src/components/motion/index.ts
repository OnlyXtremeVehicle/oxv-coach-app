/**
 * Motion — composants d'animation sobres OXV.
 *
 * Doctrine : pas de bounce, pas de spring, pas de chorégraphies criardes.
 * Juste des ease-out cubic pour donner du poids aux moments-clés sans
 * dramatiser. Voir docs/screens/01_DESIGN_TOKENS.md.
 *
 * Règles du kit :
 * - Tous les composants respectent reduce-motion (useReduceMotion) :
 *   quand c'est actif, l'état final est rendu immédiatement, sans mouvement.
 * - useNativeDriver: true partout où c'est possible (transform/opacity) ;
 *   exceptions documentées (texte de CountUpNumber, props SVG de DrawInPath).
 * - EXCEPTION INTANGIBLE — silence en piste (Principe 3) : les écrans du
 *   flux de capture (roulage, entre-runs, pilotage-fini, preservation,
 *   placement, equipement) restent CALMES. Ce kit n'y a pas sa place.
 */

export { CountUpNumber, type CountUpNumberProps } from './CountUpNumber';
export { FadeInSection, type FadeInSectionProps } from './FadeInSection';
export {
  PressableScale,
  type PressableScaleProps,
  type PressableScaleHaptic,
} from './PressableScale';
export { Stagger, type StaggerProps } from './Stagger';
export { DrawInPath, type DrawInPathProps } from './DrawInPath';
export { GrowBar, type GrowBarProps } from './GrowBar';
export { BreathingGlow, type BreathingGlowProps } from './BreathingGlow';
export { AnimatedPresence, type AnimatedPresenceProps } from './AnimatedPresence';
export { useReduceMotion } from './useReduceMotion';

// Logique pure (testée) — délais de cascade et préparation de tracés SVG.
export { staggerDelay, staggerDelays, type StaggerTimingOptions } from './staggerDelays';
export { polylineToPathD, polylineLength, type Point2D } from './pathMath';
