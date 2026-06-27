/**
 * TrackStage — instrument/tracé central de la refonte gaming.
 *
 * Couche gaming par-dessus l'infrastructure CircuitMap existante : elle NE
 * redessine pas la géométrie (réutilise projection + getScenePoints + les
 * layers), elle ajoute le langage cockpit (fond à halo, grille HUD, tracé à
 * halo lumineux) et quatre modes de lecture.
 *
 * Doctrine : c'est un MIROIR. Il montre le roulage, il ne dirige pas. Aucun
 * verbe d'ordre, aucune comparaison aux autres pilotes, aucun score. Le rouge
 * de marque n'est JAMAIS utilisé ici (réservé marque + bande coach) ; la carte
 * de chaleur va du froid au chaud SANS rouge.
 *
 * Quatre modes :
 *   - 'beam'    Faisceau : plusieurs tours superposés (signature / régularité).
 *               <TrackStage mode="beam" laps={[lap1, lap2, ...]} />
 *   - 'replay'  Rejeu : un point glissant le long d'une trajectoire.
 *               <TrackStage mode="replay" trajectory={pts} autoplay />
 *               (ou contrôlé : progress={0..1})
 *   - 'ab'      Comparaison A/B : deux trajectoires (A or, B neutre).
 *               <TrackStage mode="ab" trajectoryA={a} trajectoryB={b} />
 *   - 'heatmap' Carte de chaleur : tracé coloré par intensité (froid→chaud).
 *               <TrackStage mode="heatmap" heatPoints={[{lat,lon,intensity}]} />
 *
 * Communs : zoom virage (cornerApex), virage sélectionné (selectedCornerIndex),
 * barre de statut HUD (statusLabel), un seul fait sous le tracé (caption).
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Circle, Defs, Line, Path, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';

import { fonts, fontSize, motion, palette, radius, spacing } from '@/theme/v2';

import { CircuitMap } from './CircuitMap';
import { CornersLayer } from './layers/CornersLayer';
import { TrajectoryLayer, type TrajectoryPoint } from './layers/TrajectoryLayer';
import { getCircuitViewBox, getCornerViewBox, getScenePoints, projectToScene } from './projection';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type TrackStageMode = 'beam' | 'replay' | 'ab' | 'heatmap';

export interface TrackStageHeatPoint {
  lat: number;
  lon: number;
  /** Intensité 0..1 (ou toute échelle ; normalisée en interne). */
  intensity?: number | null;
}

export interface TrackStageProps {
  mode: TrackStageMode;
  /** Hauteur du cadre en pixels. */
  height?: number;

  /** mode 'beam' : un tableau de points par tour. */
  laps?: TrajectoryPoint[][];

  /** mode 'replay' : la trajectoire à rejouer. */
  trajectory?: TrajectoryPoint[];
  /** mode 'replay' contrôlé : position du curseur 0..1. */
  progress?: number;
  /** mode 'replay' : lecture automatique en boucle. */
  autoplay?: boolean;
  /** Durée d'un tour de rejeu (ms). Défaut 6000. */
  replayDurationMs?: number;

  /** mode 'ab' : trajectoire A (mise en avant, or). */
  trajectoryA?: TrajectoryPoint[];
  /** mode 'ab' : trajectoire B (référence, neutre). */
  trajectoryB?: TrajectoryPoint[];

  /** mode 'heatmap' : points + intensité. */
  heatPoints?: TrackStageHeatPoint[];

  /** Zoom sur un virage (apex GPS). Bascule le viewBox. */
  cornerApex?: { lat: number; lon: number } | null;
  /** Rayon du zoom virage en mètres. Défaut 80. */
  cornerRadiusM?: number;
  /** Index de virage (1..14) à surligner. */
  selectedCornerIndex?: number | null;

  /** Libellé de la barre HUD (mono, majuscules). Null = pas de barre. */
  statusLabel?: string | null;
  /** Fait unique sous le tracé. Null = rien. */
  caption?: { label: string; value: string } | null;

  /** Couleur du tracé officiel. Défaut or (donnée). */
  spineColor?: string;
  /** Fond du cadre. Défaut night. */
  background?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** d-path du tracé officiel, à partir des points de scène (réutilise la géométrie). */
function useTrackPath(): string {
  return useMemo(() => {
    const pts = getScenePoints();
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  }, []);
}

/** Réduit un tableau à `max` éléments (pour l'interpolation du curseur de rejeu). */
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

// ----------------------------------------------------------------------------
// Cockpit chrome (dans le <Svg>, en mètres = userSpace)
// ----------------------------------------------------------------------------

const CockpitBackdrop = memo(function CockpitBackdrop({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const span = Math.max(w, h);
  const stepX = w / 10;
  const stepY = h / 8;
  const vlines: number[] = [];
  for (let gx = x + stepX; gx < x + w; gx += stepX) vlines.push(gx);
  const hlines: number[] = [];
  for (let gy = y + stepY; gy < y + h; gy += stepY) hlines.push(gy);
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  const lineW = span * 0.0012;

  return (
    <>
      <Defs>
        <RadialGradient id="oxvHalo" cx={cx} cy={cy} r={span * 0.7} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={palette.gold} stopOpacity={0.1} />
          <Stop offset="0.5" stopColor={palette.gold} stopOpacity={0.028} />
          <Stop offset="1" stopColor={palette.gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={x} y={y} width={w} height={h} fill="url(#oxvHalo)" />
      {vlines.map((gx, i) => (
        <Line
          key={`v${i}`}
          x1={gx}
          y1={y}
          x2={gx}
          y2={y + h}
          stroke={palette.line}
          strokeWidth={lineW}
          opacity={0.55}
        />
      ))}
      {hlines.map((gy, i) => (
        <Line
          key={`h${i}`}
          x1={x}
          y1={gy}
          x2={x + w}
          y2={gy}
          stroke={palette.line}
          strokeWidth={lineW}
          opacity={0.55}
        />
      ))}
    </>
  );
});

/** Tracé officiel à halo lumineux (3 passes : halo large, halo moyen, cœur). */
function GlowSpine({
  d,
  color,
  u,
  dim = false,
}: {
  d: string;
  color: string;
  u: number;
  dim?: boolean;
}) {
  const k = dim ? 0.4 : 1;
  return (
    <>
      <Path
        d={d}
        stroke={color}
        strokeWidth={u * 0.03}
        opacity={0.05 * k}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={d}
        stroke={color}
        strokeWidth={u * 0.014}
        opacity={0.12 * k}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={d}
        stroke={color}
        strokeWidth={u * 0.006}
        opacity={0.9 * k}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Carte de chaleur SANS rouge : froid (faint) → tiède (heritageGold) → chaud (or). */
function HeatTrack({ points, u }: { points: TrackStageHeatPoint[]; u: number }) {
  if (points.length < 2) return null;
  const vals = points
    .map((p) => p.intensity)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const max = vals.length > 0 ? Math.max(...vals) : 1;
  return (
    <>
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const a = projectToScene(p);
        const b = projectToScene(next);
        const r = max > 0 ? ((p.intensity ?? 0) + (next.intensity ?? 0)) / 2 / max : 0;
        const c = r < 0.34 ? palette.faint : r < 0.67 ? palette.heritageGold : palette.gold;
        return (
          <Polyline
            key={i}
            points={`${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`}
            stroke={c}
            strokeWidth={u * 0.008}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

/** Curseur de rejeu glissant le long de la trajectoire. */
function ReplayMarker({
  trajectory,
  progress,
  autoplay,
  durationMs,
  u,
}: {
  trajectory: TrajectoryPoint[];
  progress?: number;
  autoplay?: boolean;
  durationMs: number;
  u: number;
}) {
  const scene = useMemo(
    () => downsample(trajectory, 150).map((p) => projectToScene(p)),
    [trajectory]
  );
  const t = useRef(new Animated.Value(progress ?? 0)).current;

  useEffect(() => {
    if (autoplay) {
      const anim = Animated.loop(
        Animated.timing(t, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      anim.start();
      return () => anim.stop();
    }
    if (progress != null) {
      Animated.timing(t, {
        toValue: progress,
        duration: motion.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
    return undefined;
  }, [autoplay, progress, durationMs, t]);

  if (scene.length < 2) return null;
  const n = scene.length;
  const inputRange = scene.map((_, i) => i / (n - 1));
  const cx = t.interpolate({ inputRange, outputRange: scene.map((p) => p.x) });
  const cy = t.interpolate({ inputRange, outputRange: scene.map((p) => p.y) });

  return (
    <>
      <AnimatedCircle cx={cx} cy={cy} r={u * 0.022} fill={palette.gold} opacity={0.18} />
      <AnimatedCircle cx={cx} cy={cy} r={u * 0.009} fill={palette.gold} />
    </>
  );
}

// ----------------------------------------------------------------------------
// Barre HUD + légende (hors <Svg>, en pixels)
// ----------------------------------------------------------------------------

function StatusBar({ label }: { label: string }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <View style={styles.statusBar} pointerEvents="none">
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function Caption({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.caption}>
      <Text style={styles.captionLabel}>{label}</Text>
      <Text style={styles.captionValue}>{value}</Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Composant
// ----------------------------------------------------------------------------

export function TrackStage({
  mode,
  height = 320,
  laps,
  trajectory,
  progress,
  autoplay,
  replayDurationMs = 6000,
  trajectoryA,
  trajectoryB,
  heatPoints,
  cornerApex,
  cornerRadiusM = 80,
  selectedCornerIndex = null,
  statusLabel = null,
  caption = null,
  spineColor = palette.gold,
  background = palette.night,
}: TrackStageProps) {
  const vbStr = cornerApex ? getCornerViewBox(cornerApex, cornerRadiusM) : getCircuitViewBox();
  const [vx, vy, vw, vh] = vbStr.split(' ').map(Number);
  const u = Math.max(vw, vh); // empan du viewBox en mètres → échelle des traits
  const trackD = useTrackPath();

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <CircuitMap
          height={height}
          background={background}
          borderRadius={radius.xl}
          viewBox={vbStr}
        >
          <CockpitBackdrop x={vx} y={vy} w={vw} h={vh} />

          <GlowSpine d={trackD} color={spineColor} u={u} dim={mode === 'heatmap'} />

          {mode === 'heatmap' && heatPoints ? <HeatTrack points={heatPoints} u={u} /> : null}

          {mode === 'beam' && laps
            ? laps.map((lap, i) => (
                <TrajectoryLayer
                  key={i}
                  points={lap}
                  color="rgba(255,183,3,0.16)"
                  strokeWidth={u * 0.005}
                />
              ))
            : null}

          {mode === 'ab' ? (
            <>
              {trajectoryB ? (
                <TrajectoryLayer
                  points={trajectoryB}
                  color={palette.creamMute}
                  strokeWidth={u * 0.006}
                />
              ) : null}
              {trajectoryA ? (
                <TrajectoryLayer
                  points={trajectoryA}
                  color={palette.gold}
                  strokeWidth={u * 0.006}
                />
              ) : null}
            </>
          ) : null}

          {mode === 'replay' && trajectory ? (
            <>
              <TrajectoryLayer
                points={trajectory}
                color="rgba(255,183,3,0.35)"
                strokeWidth={u * 0.005}
              />
              <ReplayMarker
                trajectory={trajectory}
                progress={progress}
                autoplay={autoplay}
                durationMs={replayDurationMs}
                u={u}
              />
            </>
          ) : null}

          {selectedCornerIndex != null ? (
            <CornersLayer colorMode="pace" selectedIndex={selectedCornerIndex} />
          ) : null}
        </CircuitMap>

        {statusLabel ? <StatusBar label={statusLabel} /> : null}
      </View>

      {caption ? <Caption label={caption.label} value={caption.value} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  frame: { position: 'relative' },
  statusBar: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,11,13,0.72)',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.gold, marginRight: 7 },
  statusLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: palette.creamSoft,
    textTransform: 'uppercase',
  },
  caption: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
  captionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    color: palette.faint,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  captionValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: palette.cream,
    letterSpacing: -0.5,
  },
});
