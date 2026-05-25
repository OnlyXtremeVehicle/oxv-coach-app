/**
 * SpeedTrace — courbe vitesse vs progression du tour.
 *
 * Affiche la signature vitesse du pilote : ligne sombre qui monte et
 * descend selon les zones de freinage et de relance. Optionnellement
 * superpose un 2e tour pour comparer (gris fin).
 *
 * Lecture sobre :
 *   - Axe X : progression normalisée 0..1 du tour (à terme : distance)
 *   - Axe Y : vitesse km/h, échelle auto
 *   - 7 lignes verticales aux apex pour situer les virages
 *
 * Doctrine : pas de label sur les apex (chiffre 1..7 = trop chargé),
 * juste des tirets sobres. Le pilote sait où sont les virages.
 */

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';
import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';

export interface SpeedTracePoint {
  /** Progression dans le tour, 0..1. */
  progress: number;
  /** Vitesse km/h. */
  speedKmh: number;
}

export interface SpeedTraceProps {
  /** Trace principale (couleur claire). */
  points: SpeedTracePoint[];
  /** Trace comparée (gris fin). Optionnelle. */
  comparePoints?: SpeedTracePoint[] | null;
  /** Label de la trace principale. */
  label?: string;
  /** Label de la trace comparée. */
  compareLabel?: string;
  /** Hauteur du graphique en pixels. Par défaut 200. */
  height?: number;
}

const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export function SpeedTrace({
  points,
  comparePoints,
  label,
  compareLabel,
  height = 200,
}: SpeedTraceProps) {
  const W = 340;
  const H = height;

  // Calcule le min/max vitesse pour calibrer Y
  const { vMin, vMax } = useMemo(() => {
    const all = [...points, ...(comparePoints ?? [])];
    if (all.length === 0) return { vMin: 0, vMax: 200 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of all) {
      if (p.speedKmh < lo) lo = p.speedKmh;
      if (p.speedKmh > hi) hi = p.speedKmh;
    }
    // Arrondi à 10 km/h pour échelle propre
    return {
      vMin: Math.max(0, Math.floor(lo / 10) * 10 - 10),
      vMax: Math.ceil(hi / 10) * 10 + 10,
    };
  }, [points, comparePoints]);

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const xFor = (progress: number) => PAD_LEFT + progress * innerW;
  const yFor = (speed: number) => PAD_TOP + innerH - ((speed - vMin) / (vMax - vMin)) * innerH;

  const buildPath = (data: SpeedTracePoint[]) =>
    data.length === 0
      ? ''
      : `M ${xFor(data[0].progress).toFixed(1)},${yFor(data[0].speedKmh).toFixed(1)} ` +
        data
          .slice(1)
          .map((p) => `L ${xFor(p.progress).toFixed(1)},${yFor(p.speedKmh).toFixed(1)}`)
          .join(' ');

  const mainPath = buildPath(points);
  const comparePath = comparePoints ? buildPath(comparePoints) : null;

  // Lignes verticales aux apex des 7 virages
  const apexLines = useMemo(() => {
    return BELTOISE_CORNERS.map((c) => {
      const seg = HAUTE_SAINTONGE_SEGMENTS.find((s) => s.order === c.index);
      return seg?.apexProgress ?? null;
    }).filter((p): p is number => p !== null);
  }, []);

  // Graduations Y (3 valeurs sobres)
  const yTicks = useMemo(() => {
    const range = vMax - vMin;
    if (range <= 0) return [vMin];
    const mid = Math.round((vMin + vMax) / 20) * 10;
    return [vMin, mid, vMax];
  }, [vMin, vMax]);

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
        {/* Graduations Y */}
        {yTicks.map((v) => (
          <Line
            key={v}
            x1={PAD_LEFT}
            y1={yFor(v)}
            x2={W - PAD_RIGHT}
            y2={yFor(v)}
            stroke={colors.border.subtle}
            strokeWidth={0.5}
          />
        ))}

        {/* Lignes verticales aux apex (sobres) */}
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

        {/* Trace comparée (gris fin, derrière) */}
        {comparePath ? (
          <Path
            d={comparePath}
            stroke={colors.text.tertiary}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Trace principale */}
        <Path
          d={mainPath}
          stroke={colors.text.primary}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Labels Y */}
        {yTicks.map((v) => (
          <Circle key={`${v}-c`} cx={PAD_LEFT - 4} cy={yFor(v)} r={1} fill={colors.text.tertiary} />
        ))}
      </Svg>

      {/* Légende vMin / vMid / vMax sous le graphique */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.xs,
          paddingHorizontal: spacing.xs,
        }}
      >
        {yTicks.map((v) => (
          <Text key={v} style={[typography.caption, { color: colors.text.tertiary }]}>
            {v} km/h
          </Text>
        ))}
      </View>

      {/* Légende des traces (si comparaison) */}
      {comparePath ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xl,
            marginTop: spacing.sm,
          }}
        >
          <LegendDot color={colors.text.primary} label={label ?? 'Tour A'} />
          <LegendDot color={colors.text.tertiary} label={compareLabel ?? 'Tour B'} />
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View
        style={{
          width: 12,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>{label}</Text>
    </View>
  );
}
