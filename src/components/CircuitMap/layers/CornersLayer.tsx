/**
 * Layer Virages — disques numérotés sur les 7 apex avec colorisation
 * configurable (pace statique, zone marge, ou neutre).
 */

import { Circle, Text as SvgText } from 'react-native-svg';

import { BELTOISE_CORNERS, type CornerTopology } from '@/lib/circuitTopology';
import { type MarginZone } from '@/types/domain';
import { colors } from '@/theme/tokens';

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
  /** Rayon des disques (radius non sélectionné). 16 par défaut. */
  radius?: number;
}

export function CornersLayer({
  selectedIndex = null,
  colorMode = 'pace',
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
          <CornerMark
            key={corner.index}
            x={point.x}
            y={point.y}
            radius={r}
            fill={fill}
            isSelected={isSelected}
            label={String(corner.index)}
            showLabel={showLabels}
          />
        );
      })}
    </>
  );
}

function CornerMark(props: {
  x: number;
  y: number;
  radius: number;
  fill: string;
  isSelected: boolean;
  label: string;
  showLabel: boolean;
}) {
  const { x, y, radius, fill, isSelected, label, showLabel } = props;
  return (
    <>
      <Circle
        cx={x}
        cy={y}
        r={radius}
        fill={fill}
        stroke={isSelected ? '#FFFFFF' : colors.background.primary}
        strokeWidth={isSelected ? 3 : 2}
      />
      {showLabel ? (
        <SvgText
          x={x}
          y={y + radius / 3}
          fontSize={radius}
          textAnchor="middle"
          fill={isSelected ? '#FFFFFF' : colors.background.primary}
          fontWeight="bold"
        >
          {label}
        </SvgText>
      ) : null}
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
