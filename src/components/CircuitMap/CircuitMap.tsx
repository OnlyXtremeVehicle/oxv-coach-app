/**
 * Composant base — orchestre le rendu SVG du circuit Beltoise avec
 * des layers composables (tracé, virages, trajectoire pilote, etc.).
 *
 * Utilisable directement avec n'importe quelle combinaison de layers,
 * ou via les presets (PilotPreset, CoachPreset, PublicPreset) qui
 * pré-configurent les compositions usuelles.
 *
 * Fournit l'unique <Svg> racine et son viewBox cohérent. Les layers
 * sont des fragments SVG injectés en children.
 */

import { type ReactNode, memo } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';

import { theme } from '@/theme/v2';

import { getCircuitViewBox } from './projection';

export interface CircuitMapProps {
  /** Layers SVG composés (TrackLayer, CornersLayer, etc.). */
  children: ReactNode;
  /** Hauteur du composant en pixels. Largeur = parent. */
  height?: number;
  /** Couleur de fond du conteneur. Par défaut background.secondary. */
  background?: string;
  /** Border radius du conteneur. Par défaut 12. */
  borderRadius?: number;
  /**
   * Override du viewBox SVG. Par défaut on prend le viewBox du circuit
   * entier (getCircuitViewBox), mais on peut zoomer sur un virage en
   * passant getCornerViewBox(cornerIndex).
   */
  viewBox?: string;
}

export const CircuitMap = memo(function CircuitMap({
  children,
  height = 320,
  background = theme.palette.card2,
  borderRadius = 12,
  viewBox: viewBoxOverride,
}: CircuitMapProps) {
  const viewBox = viewBoxOverride ?? getCircuitViewBox();
  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: background,
        borderRadius,
        overflow: 'hidden',
      }}
    >
      <Svg width="100%" height="100%" viewBox={viewBox}>
        {children}
      </Svg>
    </View>
  );
});
