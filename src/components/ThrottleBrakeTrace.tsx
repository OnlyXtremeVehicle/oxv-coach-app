/**
 * ThrottleBrakeTrace — courbe Throttle/Brake vs progression. Transposition gaming.
 *
 * Visualisation dérivée du g longitudinal (g_force_y RaceBox) :
 *   - g_long > 0  → accélération → throttle (vert vers le haut)
 *   - g_long < 0  → freinage → brake (BLEU vers le bas)
 *
 * Cockpit factuel : code-couleur par DIMENSION (accel vert / freinage bleu),
 * jamais de rouge de performance (rouge réservé marque + bande coach).
 * Barre centrale 0g, courbes au-dessus / en dessous, échelle Y auto.
 *
 * Doctrine : aucun jugement (« freinez plus tard »). On montre,
 * le pilote/coach interprètent.
 */

import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { cockpitPanel } from '@/components/insights/vizChrome';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, dataColors } = theme;
const ACCEL = palette.green;
const BRAKE = dataColors.brake;

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

  const xFor = useCallback((progress: number) => PAD_LEFT + progress * innerW, [innerW]);
  const yFor = useCallback(
    (g: number) => midY - (g / scaleMaxG) * (innerH / 2),
    [midY, scaleMaxG, innerH]
  );

  const accelPath = useMemo(
    () => buildSegmentedPath(points, 'accel', xFor, yFor),
    [points, xFor, yFor]
  );
  const brakePath = useMemo(
    () => buildSegmentedPath(points, 'brake', xFor, yFor),
    [points, xFor, yFor]
  );

  const apexLines = useMemo(
    () =>
      BELTOISE_CORNERS.map((c) => {
        const seg = HAUTE_SAINTONGE_SEGMENTS.find((s2) => s2.order === c.index);
        return seg?.apexProgress ?? null;
      }).filter((p): p is number => p !== null),
    []
  );

  return (
    <View style={s.panel}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Bandeaux fond accel (haut) et brake (bas) — discrets */}
        <Path
          d={`M ${PAD_LEFT} ${PAD_TOP} L ${W - PAD_RIGHT} ${PAD_TOP} L ${W - PAD_RIGHT} ${midY} L ${PAD_LEFT} ${midY} Z`}
          fill={ACCEL}
          opacity={0.05}
        />
        <Path
          d={`M ${PAD_LEFT} ${midY} L ${W - PAD_RIGHT} ${midY} L ${W - PAD_RIGHT} ${PAD_TOP + innerH} L ${PAD_LEFT} ${PAD_TOP + innerH} Z`}
          fill={BRAKE}
          opacity={0.05}
        />

        {/* Ligne médiane 0g */}
        <Line
          x1={PAD_LEFT}
          y1={midY}
          x2={W - PAD_RIGHT}
          y2={midY}
          stroke={palette.edge}
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
            stroke={palette.line}
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        ))}

        {/* Courbes accel (vert) + brake (bleu) */}
        {brakePath ? (
          <Path
            d={brakePath}
            stroke={BRAKE}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {accelPath ? (
          <Path
            d={accelPath}
            stroke={ACCEL}
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
        <LegendDot color={ACCEL} label="Accélération" />
        <LegendDot color={BRAKE} label="Freinage" />
      </View>
    </View>
  );
}

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
      <Text style={s.legendLabel}>{label}</Text>
    </View>
  );
}

const s = {
  panel: {
    ...cockpitPanel,
    padding: spacing.md,
  },
  legendLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
};
