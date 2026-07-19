/**
 * TraceCircuit — rendu Skia du tracé circuit (lot L0, livrable 7).
 *
 * Trait de fond `border.card` 5 px + `GlowStroke` (lumière DU trait) dont la
 * progression se dessine au premier viewport (motion.pulse, 1,2 s) — ou est
 * pilotée de l'extérieur via `progress`. Puces d'événements (`markers`) qui
 * « claquent » en spring séquencé (DOT_STAGGER_MS) après le tracé.
 *
 * `annotationBand` : bande sous le tracé au bord OR Heritage 2 px — réservée
 * à l'annotation coach (l'or ne sert jamais de chrome générique).
 *
 * Centerline lat/lon (base `circuits.centerline_latlon`) ou déjà métrique —
 * projection via vizMath (réutilise projectToMeters du circuitGenerator).
 * Centerline inexploitable → rien n'est tracé (données réelles, pas de
 * silhouette inventée). Module natif Skia : pas d'Expo Go.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { LatLon } from '@/circuit/circuitGenerator';

import { GlowStroke } from './motion/GlowStroke';
import { useReduceMotion } from './motion/useReduceMotion';
import { SpringDot } from './SpringDot';
import { colors, motion, radius, space } from './tokens';
import { useFirstViewport } from './useFirstViewport';
import { DOT_STAGGER_MS, centerlineToTrace, pointAtRatio, type XY } from './vizMath';

export interface TraceMarker {
  /** Position le long du tracé, 0..1 (abscisse curviligne). */
  t: number;
  /** Couleur de la puce (donnée). Défaut text.hi ; or Heritage si annotation coach. */
  color?: string;
}

export interface TraceCircuitProps {
  /** Centerline du circuit : lat/lon (base) ou points métriques {x, y}. */
  centerline: readonly LatLon[] | readonly XY[];
  /** Hauteur du tracé (px). Défaut 180. La largeur suit le conteneur. */
  height?: number;
  /** Tracé bouclé (circuit fermé). Défaut vrai. */
  closed?: boolean;
  /** Progression 0..1 pilotée de l'extérieur ; sinon auto au premier viewport. */
  progress?: number | SharedValue<number>;
  /** Puces d'événements le long du tracé. */
  markers?: readonly TraceMarker[];
  /** Couleur du trait de progression. Défaut accent. */
  color?: string;
  /** Lumière du trait. Défaut accentGlow. */
  glowColor?: string;
  /** Attendre le premier viewport avant d'animer. Défaut vrai. */
  animateOnViewport?: boolean;
  /** Bande annotation coach sous le tracé (bord or Heritage 2 px). */
  annotationBand?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const TRACE_PADDING = 14;
const BASE_STROKE = 5;
const GLOW_STROKE = 3;
const MARKER_R = 5;

export function TraceCircuit({
  centerline,
  height = 180,
  closed = true,
  progress,
  markers = [],
  color = colors.accent,
  glowColor = colors.accentGlow,
  animateOnViewport = true,
  annotationBand,
  style,
}: TraceCircuitProps) {
  const reduce = useReduceMotion();
  const { ref, visible } = useFirstViewport(animateOnViewport && !reduce);
  const [width, setWidth] = useState(0);

  const trace = useMemo(
    () =>
      width > 0
        ? centerlineToTrace(centerline, width, height, TRACE_PADDING, closed)
        : { path: '', points: [] as XY[] },
    [centerline, width, height, closed]
  );

  const controlled = progress !== undefined;
  const internal = useSharedValue(0);
  const played = useRef(false);

  useEffect(() => {
    if (controlled || played.current || trace.path === '') return;
    if (reduce) {
      played.current = true;
      internal.value = 1;
      return;
    }
    if (!visible) return;
    played.current = true;
    internal.value = withTiming(1, { duration: motion.pulse, easing: Easing.out(Easing.cubic) });
  }, [controlled, reduce, visible, trace.path, internal]);

  // Les puces claquent après le tracé auto ; tout de suite si piloté dehors.
  const markerBaseDelay = controlled || reduce ? 0 : motion.pulse;

  // Le canvas Skia est muet pour les lecteurs d'écran : on le décrit ici.
  // Le label vit sur le Canvas (pas le conteneur) pour ne pas aplatir
  // l'annotationBand ; les puces restent purement visuelles.
  const a11yLabel = `Tracé du circuit${
    markers.length > 0 ? `, ${markers.length} ${markers.length > 1 ? 'repères' : 'repère'}` : ''
  }`;

  return (
    <Animated.View
      ref={ref}
      style={style}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && trace.path !== '' ? (
        <Canvas style={{ width, height }} accessible accessibilityLabel={a11yLabel}>
          <Path
            path={trace.path}
            style="stroke"
            strokeWidth={BASE_STROKE}
            strokeCap="round"
            strokeJoin="round"
            color={colors.border.card}
          />
          <GlowStroke
            path={trace.path}
            color={color}
            glowColor={glowColor}
            strokeWidth={GLOW_STROKE}
            progress={controlled ? progress : internal}
          />
          {markers.map((marker, index) => {
            const at = pointAtRatio(trace.points, marker.t, closed);
            if (at === null) return null;
            return (
              <SpringDot
                key={`marker-${index}`}
                x={at.x}
                y={at.y}
                r={MARKER_R}
                color={marker.color ?? colors.text.hi}
                delay={markerBaseDelay + index * DOT_STAGGER_MS}
                play={visible}
                still={reduce}
              />
            );
          })}
        </Canvas>
      ) : null}

      {annotationBand ? <View style={styles.annotation}>{annotationBand}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Bord or Heritage 2 px — RÉSERVÉ à l'annotation coach (jamais décoratif).
  annotation: {
    marginTop: space.md,
    borderWidth: 2,
    borderColor: colors.heritage.gold,
    borderRadius: radius.cell,
    padding: space.md,
  },
});
