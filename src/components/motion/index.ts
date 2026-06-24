/**
 * Motion — composants d'animation sobres OXV.
 *
 * Doctrine : pas de bounce, pas de spring, pas de chorégraphies criardes.
 * Juste des ease-out cubic pour donner du poids aux moments-clés sans
 * dramatiser. Voir docs/screens/01_DESIGN_TOKENS.md.
 */

export { CountUpNumber, type CountUpNumberProps } from './CountUpNumber';
export { FadeInSection, type FadeInSectionProps } from './FadeInSection';
export { useReduceMotion } from './useReduceMotion';
