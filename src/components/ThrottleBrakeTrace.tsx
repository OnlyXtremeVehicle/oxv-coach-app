/**
 * ThrottleBrakeTrace — courbe Throttle/Brake vs progression du tour.
 *
 * Visualisation dérivée du g longitudinal (g_force_y RaceBox) :
 *   - g_long > 0  → accélération → throttle (vert vers le haut)
 *   - g_long < 0  → freinage → brake (rouge vers le bas)
 *
 * Lecture sobre : barre centrale 0g, courbe verte au-dessus, rouge en
 * dessous, échelle Y auto. C'est une approximation (pas un capteur
 * pédale réel) mais suffisant pour visualiser les zones de freinage
 * et de relance d'un tour.
 *
 * Doctrine : aucun jugement (« freinez plus tard »). On montre,
 * le pilote/coach interprètent.
 */

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';
import { borderRadius, colors, fontSize, spacing } from '@/theme/tokens';

export interface ThrottleBrakePoint {
  /** Progression dans le tour, 0..1. */
  progress: number;
  /** g longitudinal (positif = accel, négatif = freinage). */
  gLong: number;
}

export interface ThrottleBrakeTraceProps {
  points: ThrottleBrakePoint[];
  /** Échelle max ± en g. Par défaut 1.5g (couvre 99 % des cas). */
  scaleMaxG?: number;
  /** Hauteur du graphique en pixels. Par défaut 180. */
  height?: number;
}

const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

export function ThrottleBrakeTrace({
  points,
  scaleMaxG = 1.5,
  height = 180,
}: ThrottleBrakeTraceProps) {
  const W = 340;
  const H = height;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const midY = PAD_TOP + innerH / 2;

  const xFor = (progress: number) => PAD_LEFT + progress * innerW;
  // g positif = vers le haut, g négatif = vers le bas (axe inversé SVG)
  const yFor = (g: number) => midY - (g / scaleMaxG) * (innerH / 2);

  // Sépare en segments accel (positif) et brake (négatif) pour colorer
  // différemment chaque zone. Si on traçait un seul path on perdrait
  // la distinction visuelle des transitions.
  const accelPath = useMemo(() => buildSegmentedPath(points, 'accel', xFor, yFor), [points]);
  const brakePath = useMemo(() => buildSegmentedPath(points, 'brake', xFor, yFor), [points]);

  const apexLines = useMemo(
    () =>
      BELTOISE_CORNERS.map((c) => {
        const seg = HAUTE_SAINTONGE_SEGMENTS.find((s) => s.order === c.index);
        return seg?.apexProgress ?? null;
      }).filter((p): p is number => p !== null),
    []
  );

  return (
    <View
      style={{
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        padding: spacing.md,
      }}
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Bandeaux fond accel (haut) et brake (bas) — discrets */}
        <Path
          d={`M ${PAD_LEFT} ${PAD_TOP} L ${W - PAD_RIGHT} ${PAD_TOP} L ${W - PAD_RIGHT} ${midY} L ${PAD_LEFT} ${midY} Z`}
          fill={colors.margin.green}
          opacity={0.05}
        />
        <Path
          d={`M ${PAD_LEFT} ${midY} L ${W - PAD_RIGHT} ${midY} L ${W - PAD_RIGHT} ${PAD_TOP + innerH} L ${PAD_LEFT} ${PAD_TOP + innerH} Z`}
          fill={colors.accent.red}
          opacity={0.05}
        />

        {/* Ligne médiane 0g */}
        <Line
          x1={PAD_LEFT}
          y1={midY}
          x2={W - PAD_RIGHT}
          y2={midY}
          stroke={colors.border.medium}
          strokeWidth={0.5}
        />

        {/* Lignes apex (sobres) */}
        {apexLines.map((p, i) => (
          <Line
            key={i}
            x1={xFor(p)}
            y1={PAD_TOP}
            x2={xFor(p)}
            y2={PAD_TOP + innerH}
            stroke={colors.border.subtle}
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        ))}

        {/* Courbes accel (vert) + brake (rouge) */}
        {brakePath ? (
          <Path
            d={brakePath}
            stroke={colors.accent.red}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {accelPath ? (
          <Path
            d={accelPath}
            stroke={colors.margin.green}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>

      {/* Légende sobre */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
          paddingHorizontal: spacing.xs,
        }}
      >
        <LegendDot color={colors.margin.green} label="Accélération" />
        <LegendDot color={colors.accent.red} label="Freinage" />
      </View>
    </View>
  );
}

/**
 * Trace une courbe en clippant aux zones où le point est du bon signe
 * (positif pour 'accel', négatif pour 'brake'). Les points de l'autre
 * signe deviennent des trous (split en sous-paths).
 */
function buildSegmentedPath(
  points: ThrottleBrakePoint[],
  kind: 'accel' | 'brake',
  xFor: (p: number) => number,
  yFor: (g: number) => number
): string {
  if (points.length === 0) return '';
  const test = (g: number) => (kind === 'accel' ? g > 0 : g < 0);

  const subPaths: string[] = [];
  let current: string[] = [];
  let inSegment = false;

  for (const p of points) {
    const ok = test(p.gLong);
    if (ok) {
      const cmd = inSegment ? 'L' : 'M';
      current.push(`${cmd} ${xFor(p.progress).toFixed(1)},${yFor(p.gLong).toFixed(1)}`);
      inSegment = true;
    } else if (inSegment) {
      // Close current sub-path à 0g pour transition propre
      current.push(`L ${xFor(p.progress).toFixed(1)},${yFor(0).toFixed(1)}`);
      subPaths.push(current.join(' '));
      current = [];
      inSegment = false;
    }
  }
  if (current.length > 0) subPaths.push(current.join(' '));
  return subPaths.join(' ');
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 12, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>{label}</Text>
    </View>
  );
}
