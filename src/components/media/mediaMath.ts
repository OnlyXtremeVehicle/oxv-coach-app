/**
 * mediaMath — logique pure du système d'images V2.
 *
 * Extraite des composants Photo/HeroPhoto pour que jest (ts pur, node) puisse
 * la vérifier sans rendu de composant.
 */

/** Durée du fondu d'apparition des photos (ms). */
export const PHOTO_FADE_MS = 220;

/** Facteur de parallaxe du HeroPhoto : translateY = (scrollY − parallaxOffset) × 0.3. */
export const PARALLAX_FACTOR = 0.3;

/**
 * Débord vertical (px) de la couche photo du HeroPhoto quand la parallaxe
 * est active : la photo dépasse du cadre de cette valeur en haut ET en bas,
 * et la translation est bornée à ±PARALLAX_BLEED — la course de parallaxe
 * ne découvre donc jamais le fond.
 */
export const PARALLAX_BLEED = 40;

/** Part de la hauteur du hero couverte par le scrim bas (lisibilité du texte). */
export const SCRIM_HEIGHT_RATIO = 0.45;

/**
 * Translation verticale de la photo hero en fonction du scroll.
 * `parallaxOffset` est l'offset Y du hero DANS le contenu du scroll :
 * un hero en tête de scroll garde le défaut 0 ; un hero placé plus bas
 * passe son offset pour que la parallaxe soit neutre quand il arrive
 * à l'écran. Course bornée à ±PARALLAX_BLEED (le débord de la couche photo).
 * Worklet : appelée depuis useAnimatedStyle (thread UI Reanimated).
 */
export function parallaxTranslateY(scrollY: number, parallaxOffset = 0): number {
  'worklet';
  const raw = (scrollY - parallaxOffset) * PARALLAX_FACTOR;
  return Math.min(PARALLAX_BLEED, Math.max(-PARALLAX_BLEED, raw));
}

/** Hauteur du scrim pour une hauteur de hero donnée. */
export function scrimHeight(heroHeight: number): number {
  return Math.round(heroHeight * SCRIM_HEIGHT_RATIO);
}

/**
 * Variante alpha 0 d'une couleur `rgba(r,g,b,a)` — borne transparente du
 * dégradé de scrim, dérivée du token, sans couleur en dur.
 */
export function toTransparent(rgba: string): string {
  const match = rgba.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/);
  // Repli défensif : le mot-clé transparent, pas une couleur en dur.
  if (match === null) return 'transparent';
  return `rgba(${match[1]},${match[2]},${match[3]},0)`;
}

/** Couleurs du dégradé de scrim, du haut (transparent) vers le bas (scrim plein). */
export function scrimGradientColors(scrim: string): [string, string] {
  return [toTransparent(scrim), scrim];
}
