/**
 * CornersLayer — 7 disques numérotés sur les apex.
 *
 * Équivalent web de src/components/CircuitMap/layers/CornersLayer.tsx.
 * Différence : utilise <circle> et <text> SVG natifs au lieu de
 * react-native-svg.
 */

'use client';

import { BELTOISE_CORNERS, type CornerTopology, type MarginZone } from '@/data/circuitTopology';
import { colors } from '@/data/tokens';

import { projectToScene } from '../projection';

export type CornerColorMode = 'pace' | 'zone' | 'neutral';

export interface CornersLayerProps {
  /** Index du virage sélectionné (1..7), ou null. */
  selectedIndex?: number | null;
  /** Mode de colorisation. */
  colorMode?: CornerColorMode;
  /** Marges par index, utilisé si colorMode === 'zone'. */
  zoneByIndex?: Record<number, MarginZone>;
  /** Affiche le numéro dans chaque disque. */
  showLabels?: boolean;
  /** Rayon des disques (non sélectionnés). */
  radius?: number;
}

export function CornersLayer({
  selectedIndex = null,
  colorMode = 'neutral',
  zoneByIndex,
  showLabels = true,
  radius = 16,
}: CornersLayerProps) {
  return (
    <>
      {BELTOISE_CORNERS.map((corner) => {
        const point = projectToScene({ lat: corner.apexLat, lon: corner.apexLon });
        const isSelected = selectedIndex === corner.index;
        const fill = fillForCorner(corner, colorMode, zoneByIndex);
        const r = isSelected ? radius + 6 : radius;

        return (
          <g key={corner.index}>
            <circle
              cx={point.x}
              cy={point.y}
              r={r}
              fill={fill}
              stroke={isSelected ? '#FFFFFF' : colors.background.primary}
              strokeWidth={isSelected ? 3 : 2}
            />
            {showLabels ? (
              <text
                x={point.x}
                y={point.y + r / 3}
                fontSize={r}
                textAnchor="middle"
                fill={isSelected ? '#FFFFFF' : colors.background.primary}
                fontWeight="bold"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {corner.index}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function fillForCorner(
  corner: CornerTopology,
  mode: CornerColorMode,
  zoneByIndex: Record<number, MarginZone> | undefined
): string {
  if (mode === 'neutral') {
    return colors.text.tertiary;
  }
  if (mode === 'zone') {
    const zone = zoneByIndex?.[corner.index];
    if (!zone) return colors.text.tertiary;
    return colorForZone(zone);
  }
  switch (corner.pace) {
    case 'slow':
      return colors.margin.red;
    case 'medium':
      return colors.margin.yellow;
    case 'fast':
      return colors.margin.green;
  }
}

function colorForZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return colors.margin.green;
    case 'yellow':
      return colors.margin.yellow;
    case 'red':
      return colors.margin.red;
  }
}
