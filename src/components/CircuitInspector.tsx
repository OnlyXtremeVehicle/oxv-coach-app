/**
 * Composant SVG d'inspection du circuit Beltoise.
 *
 * Différent de `TrackVizMap` (qui affiche la trajectoire d'UNE session sur
 * le tracé) : ici on inspecte la **topologie** statique du circuit telle
 * qu'on l'a en base, sans dépendre d'une session.
 *
 * Affiche :
 *   - La polyline interpolée (issue de HAUTE_SAINTONGE_TRACK, ~42 points)
 *   - Les 14 apex marqués par des disques numérotés
 *   - Colorisation des virages selon le pace (slow/medium/fast) OU selon
 *     une heatmap fournie (`zoneByIndex`) — pour montrer la marge moyenne
 *     historique par virage
 *   - Le virage sélectionné est mis en évidence (cercle blanc + label)
 *
 * Utilisable côté admin (vue inspection) ou côté pilote (vue debug).
 */

import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { BELTOISE_CORNERS, type CornerTopology } from '@/lib/circuitTopology';
import { TrackProjection } from '@/trackviz/geometry';
import { HAUTE_SAINTONGE_TRACK } from '@/trackviz/hauteSaintonge';
import { type MarginZone } from '@/types/domain';
import { colors } from '@/theme/tokens';

const VIEWBOX_PADDING_PCT = 12;

export type ColorMode = 'pace' | 'zone';

export interface CircuitInspectorProps {
  /** Index du virage sélectionné (1..14), ou null. */
  selectedIndex?: number | null;
  /**
   * Mode de colorisation :
   *  - 'pace' : couleurs basées sur slow/medium/fast (toujours visible)
   *  - 'zone' : couleurs basées sur `zoneByIndex` (vert/jaune/rouge selon
   *             marge historique). Fallback transparent si pas de donnée.
   */
  colorMode?: ColorMode;
  /** Zones par segment_index (1..14), utilisée si `colorMode === 'zone'`. */
  zoneByIndex?: Record<number, MarginZone>;
  /** Hauteur du composant en pixels. Largeur = parent. */
  height?: number;
  /** Affiche le numéro de chaque virage à côté de la pastille. */
  showLabels?: boolean;
  /** Indicateur de la direction du tracé (flèche sur le départ). */
  showStartArrow?: boolean;
}

export const CircuitInspector = memo(function CircuitInspector(props: CircuitInspectorProps) {
  const {
    selectedIndex = null,
    colorMode = 'pace',
    zoneByIndex,
    height = 320,
    showLabels = true,
    showStartArrow = true,
  } = props;

  // Projection lat/lon → scène 2D (mètres centrés sur le tracé)
  const { trackPath, apexes, viewBox, startArrow } = useMemo(() => {
    const proj = new TrackProjection(HAUTE_SAINTONGE_TRACK);
    const scenePoints = HAUTE_SAINTONGE_TRACK.map((p) => proj.toScene(p));

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of scenePoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const w = maxX - minX;
    const h = maxY - minY;
    const padX = (w * VIEWBOX_PADDING_PCT) / 100;
    const padY = (h * VIEWBOX_PADDING_PCT) / 100;
    const vbX = minX - padX;
    const vbY = minY - padY;
    const vbW = w + 2 * padX;
    const vbH = h + 2 * padY;

    // Path SVG continu pour la polyline
    const path = scenePoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

    const projectedApexes = BELTOISE_CORNERS.map((corner) => ({
      corner,
      point: proj.toScene({ lat: corner.apexLat, lon: corner.apexLon }),
    }));

    // Flèche de départ : du premier au deuxième point du tracé
    const arrow = scenePoints.length >= 2 ? { from: scenePoints[0], to: scenePoints[1] } : null;

    return {
      trackPath: path,
      apexes: projectedApexes,
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
      startArrow: arrow,
    };
  }, []);

  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: colors.background.secondary,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <Svg width="100%" height="100%" viewBox={viewBox}>
        {/* Polyline du tracé en trait épais */}
        <Path
          d={trackPath}
          stroke={colors.text.secondary}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.4}
        />

        {/* Indicateur de direction au départ */}
        {showStartArrow && startArrow ? (
          <Line
            x1={startArrow.from.x}
            y1={startArrow.from.y}
            x2={startArrow.to.x}
            y2={startArrow.to.y}
            stroke={colors.accent.red}
            strokeWidth={8}
            strokeLinecap="round"
          />
        ) : null}

        {/* Pastilles des 14 apex */}
        {apexes.map(({ corner, point }) => {
          const isSelected = selectedIndex === corner.index;
          const fill = fillForCorner(corner, colorMode, zoneByIndex);
          const radius = isSelected ? 22 : 16;
          return (
            <CornerMark
              key={corner.index}
              x={point.x}
              y={point.y}
              radius={radius}
              fill={fill}
              isSelected={isSelected}
              label={String(corner.index)}
              showLabel={showLabels}
            />
          );
        })}
      </Svg>
    </View>
  );
});

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
  mode: ColorMode,
  zoneByIndex: Record<number, MarginZone> | undefined
): string {
  if (mode === 'zone') {
    const zone = zoneByIndex?.[corner.index];
    if (!zone) return colors.text.tertiary; // pas de donnée historique
    return colorForZone(zone);
  }
  // Mode pace : slow=rouge atténué, medium=jaune atténué, fast=vert atténué
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
