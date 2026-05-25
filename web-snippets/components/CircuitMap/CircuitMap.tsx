/**
 * CircuitMap — conteneur SVG racine pour la page /circuit du site web.
 *
 * Équivalent web de src/components/CircuitMap/CircuitMap.tsx.
 * Différence : utilise <div> + <svg> natifs du navigateur au lieu de
 * View + react-native-svg. Sinon API identique (props children + height).
 */

'use client';

import type { ReactNode } from 'react';

import { colors } from '@/data/tokens';

import { getCircuitViewBox } from './projection';

export interface CircuitMapProps {
  /** Layers SVG composés (TrackLayer, CornersLayer, etc.). */
  children: ReactNode;
  /** Hauteur du composant en pixels. Largeur = parent. */
  height?: number;
  /** Couleur de fond du conteneur. */
  background?: string;
  /** Border radius du conteneur. */
  borderRadius?: number;
  /** Aria label pour l'accessibilité. */
  ariaLabel?: string;
}

export function CircuitMap({
  children,
  height = 420,
  background = colors.background.secondary,
  borderRadius = 12,
  ariaLabel = 'Carte du circuit Beltoise — Haute Saintonge',
}: CircuitMapProps) {
  const viewBox = getCircuitViewBox();
  return (
    <div
      style={{
        width: '100%',
        height,
        backgroundColor: background,
        borderRadius,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
    </div>
  );
}
