/**
 * SpeedTrace — courbe vitesse vs progression du tour. Transposition gaming.
 *
 * Affiche la signature vitesse du pilote : trace OR à halo qui monte et
 * descend selon les zones de freinage et de relance. Optionnellement
 * superpose un 2e tour pour comparer (cream neutre, sans verdict).
 *
 * Cockpit factuel :
 *   - Axe X : progression normalisée 0..1 du tour
 *   - Axe Y : vitesse km/h, échelle auto
 *   - 7 lignes verticales aux apex pour situer les virages (sobres)
 *
 * Doctrine : pas de label sur les apex, juste des tirets. Le pilote sait
 * où sont les virages. La comparaison montre la divergence, pas un gagnant.
 */

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { cockpitPanel } from '@/components/insights/vizChrome';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing } = theme;
const GOLD = palette.gold;

export interface SpeedTracePoint {
  /** Progression dans le tour, 0..1. */
  progress: number;
  /** Vitesse km/h. */
  speedKmh: number;
}

export interface SpeedTraceProps {
  /** Trace principale (or). */
  points: SpeedTracePoint[];
  /** Trace comparée (cream neutre). Optionnelle. */
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

  const { vMin, vMax } = useMemo(() => {
    const all = [...points, ...(comparePoints ?? [])];
    if (all.length === 0) return { vMin: 0, vMax: 200 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of all) {
      if (p.speedKmh < lo) lo = p.speedKmh;
      if (p.speedKmh > hi) hi = p.speedKmh;
    }
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

  const apexLines = useMemo(() => {
    return BELTOISE_CORNERS.map((c) => {
      const seg = HAUTE_SAINTONGE_SEGMENTS.find((s2) => s2.order === c.index);
      return seg?.apexProgress ?? null;
    }).filter((p): p is number => p !== null);
  }, []);

  const yTicks = useMemo(() => {
    const range = vMax - vMin;
    if (range <= 0) return [vMin];
    const mid = Math.round((vMin + vMax) / 20) * 10;
    return [vMin, mid, vMax];
  }, [vMin, vMax]);

  return (
    <View style={s.panel}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Graduations Y */}
        {yTicks.map((v) => (
          <Line
            key={v}
            x1={PAD_LEFT}
            y1={yFor(v)}
            x2={W - PAD_RIGHT}
            y2={yFor(v)}
            stroke={palette.line}
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
            stroke={palette.line}
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        ))}

        {/* Trace comparée — cream neutre, sans verdict */}
        {comparePath ? (
          <Path
            d={comparePath}
            stroke={palette.creamMute}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Trace principale — OR à halo (large translucide + net) */}
        <Path
          d={mainPath}
          stroke={GOLD}
          strokeWidth={5}
          opacity={0.16}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={mainPath}
          stroke={GOLD}
          strokeWidth={1.8}
          opacity={0.95}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Repères Y */}
        {yTicks.map((v) => (
          <Circle key={`${v}-c`} cx={PAD_LEFT - 4} cy={yFor(v)} r={1} fill={palette.creamMute} />
        ))}
      </Svg>

      {/* Légende vMin / vMid / vMax */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.xs,
          paddingHorizontal: spacing.xs,
        }}
      >
        {yTicks.map((v) => (
          <Text key={v} style={s.tick}>
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
          <LegendDot color={GOLD} label={label ?? 'Cette session'} />
          <LegendDot color={palette.creamMute} label={compareLabel ?? 'Session comparée'} />
        </View>
      ) : null}
    </View>
  );
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
  tick: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  legendLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
};
