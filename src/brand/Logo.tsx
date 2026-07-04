/**
 * Marque OXV (M8, décision fondateur 2026-07-04).
 *
 * Par défaut : LOGOTYPE lettres blanches (asset officiel du site, X et V
 * partiellement fusionnés) — l'identité affichée dans l'AppBar et les écrans.
 * Variante `insignia` : l'insigne bouclier-casque rouge PLEIN (fond sombre,
 * charte : plein sur sombre, contour sur clair) — usage compact.
 *
 * `size` = HAUTEUR en points ; le logotype garde son ratio (≈ 3,28:1).
 * Sources : site oxvehicle.fr /brand (SVG) → assets/wordmark-white.png,
 * assets/insignia-fill.png (l'ancien contour reste en assets/insignia.png).
 */

import { Image, type ImageStyle } from 'react-native';

const WORDMARK = require('../../assets/wordmark-white.png');
const INSIGNIA_FILL = require('../../assets/insignia-fill.png');

/** 2336 × 712 — ratio du logotype rasterisé. */
const WORDMARK_RATIO = 2336 / 712;

type Props = { size?: number; variant?: 'wordmark' | 'insignia' };

export function Logo({ size = 26, variant = 'wordmark' }: Props) {
  if (variant === 'insignia') {
    return (
      <Image
        source={INSIGNIA_FILL}
        style={{ width: size, height: size, resizeMode: 'contain' } as ImageStyle}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <Image
      source={WORDMARK}
      style={
        {
          width: Math.round(size * WORDMARK_RATIO),
          height: size,
          resizeMode: 'contain',
        } as ImageStyle
      }
      accessibilityIgnoresInvertColors
    />
  );
}
