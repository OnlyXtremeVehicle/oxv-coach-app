/**
 * RadarQdi — le radar 5 axes QDI, rendu Skia (lot L0, livrable 7).
 *
 * Entrée théâtrale : le polygone se TRACE progressivement (motion.radar,
 * 600 ms) puis les sommets « claquent » un à un (scale spring, séquencés
 * DOT_STAGGER_MS) avec un unique haptic('doorSnap'). `animateOnViewport`
 * (défaut) attend le premier viewport avant de jouer.
 *
 * Doctrine couleur : les couleurs QDI vivent sur les POINTS (données)
 * uniquement — grille et axes en tokens border, polygone en text.hi.
 * Une branche absente/nulle est MASQUÉE (ni axe, ni point, ni label) —
 * règle données réelles, jamais tirée à zéro.
 *
 * Tailles : 's' (carte compacte, sans labels) · 'l' (plein écran, labels).
 * Reduce-motion : état final immédiat, aucun mouvement, aucun haptic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import Animated, { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from './haptics';
import { useReduceMotion } from './motion/useReduceMotion';
import { SpringDot } from './SpringDot';
import { colors, motion, type as typo } from './tokens';
import { useFirstViewport } from './useFirstViewport';
import {
  DOT_STAGGER_MS,
  QDI_BRANCH_LABELS,
  radarLayout,
  radarRingPath,
  radarVertex,
  type QdiBranch,
} from './vizMath';

export interface RadarQdiProps {
  /** Valeurs 0..100 par branche. Branche absente → masquée. */
  values: Partial<Record<QdiBranch, number>>;
  /** 's' compact (140 px, sans labels) · 'l' plein (280 px, labels). Défaut 'l'. */
  size?: 's' | 'l';
  /** Attendre le premier viewport avant d'animer. Défaut vrai. */
  animateOnViewport?: boolean;
  /** Labels de sommets (taille 'l'), fusionnés aux libellés français par défaut. */
  labels?: Partial<Record<QdiBranch, string>>;
  style?: StyleProp<ViewStyle>;
}

const CANVAS_PX = { s: 140, l: 280 } as const;
const DOT_R = { s: 3.5, l: 5 } as const;
const STROKE_W = { s: 1.5, l: 2 } as const;
/** Marge autour du canvas en 'l' pour loger les labels de sommets. */
const LABEL_MARGIN = 28;
const LABEL_WIDTH = 96;
const GRID_RINGS = [0.25, 0.5, 0.75, 1] as const;

export function RadarQdi({
  values,
  size = 'l',
  animateOnViewport = true,
  labels,
  style,
}: RadarQdiProps) {
  const reduce = useReduceMotion();
  const { ref, visible } = useFirstViewport(animateOnViewport && !reduce);

  const px = CANVAS_PX[size];
  const dotR = DOT_R[size];
  const layout = useMemo(() => radarLayout(values, px, dotR + 4), [values, px, dotR]);

  const progress = useSharedValue(0);
  const [snap, setSnap] = useState(false);
  const played = useRef(false);

  const onDrawn = useCallback(() => {
    setSnap(true);
    haptic('doorSnap');
  }, []);

  useEffect(() => {
    if (played.current) return;
    if (reduce) {
      // État final immédiat, sans claquement ni haptic.
      played.current = true;
      progress.value = 1;
      setSnap(true);
      return;
    }
    if (!visible || layout.measuredCount === 0) return;
    played.current = true;
    progress.value = withTiming(
      1,
      { duration: motion.radar, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onDrawn)();
      }
    );
  }, [reduce, visible, layout.measuredCount, onDrawn, progress]);

  const showLabels = size === 'l';
  const margin = showLabels ? LABEL_MARGIN : 0;
  const box = px + margin * 2;

  /**
   * LE SIGLE NE SE PRONONCE PAS.
   *
   * « QDI » n'apparaît NULLE PART visuellement dans l'espace pilote — c'est une
   * décision de vocabulaire du jalon 5. Il restait pourtant dans cette étiquette,
   * donc dans l'oreille de qui utilise VoiceOver : le seul pilote à qui
   * l'application parlait en sigles était celui qui ne voyait pas l'écran.
   *
   * Le nom rendu est celui que l'écran porte : votre signature.
   */
  const accessibilityLabel = useMemo(() => {
    if (layout.measuredCount === 0) return 'Votre signature — aucun axe mesuré';
    const parts = layout.points.map(
      (p) => `${labels?.[p.branch] ?? QDI_BRANCH_LABELS[p.branch]} ${Math.round(p.value)}`
    );
    const suffix = layout.measuredCount < 5 ? ` — ${layout.measuredCount} axes mesurés sur 5` : '';
    return `Votre signature — ${parts.join(', ')}${suffix}`;
  }, [layout, labels]);

  return (
    <Animated.View
      ref={ref}
      style={[{ width: box, height: box }, style]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Canvas style={{ position: 'absolute', left: margin, top: margin, width: px, height: px }}>
        {/* Grille : pentagone structurel (jamais une couleur QDI). */}
        {GRID_RINGS.map((f) => (
          <Path
            key={`ring-${f}`}
            path={radarRingPath(layout.cx, layout.cy, layout.r, f)}
            style="stroke"
            strokeWidth={1}
            color={f === 1 ? colors.border.card : colors.border.hairline}
          />
        ))}

        {/* Axes des branches mesurées uniquement. */}
        {layout.axes.map((a) => (
          <Path
            key={`axe-${a.branch}`}
            path={`M ${layout.cx} ${layout.cy} L ${a.tip.x} ${a.tip.y}`}
            style="stroke"
            strokeWidth={1}
            color={colors.border.card}
          />
        ))}

        {/* Polygone séance — tracé progressif (la couleur vit sur les sommets). */}
        {layout.polygonPath !== '' ? (
          <Path
            path={layout.polygonPath}
            style="stroke"
            strokeWidth={STROKE_W[size]}
            strokeJoin="round"
            strokeCap="round"
            color={colors.text.hi}
            start={0}
            end={progress}
          />
        ) : null}

        {/* Sommets : couleur QDI de la branche, claquement séquencé. */}
        {layout.points.map((p, i) => (
          <SpringDot
            key={`dot-${p.branch}`}
            x={p.point.x}
            y={p.point.y}
            r={dotR}
            color={colors.qdi[p.branch]}
            delay={i * DOT_STAGGER_MS}
            play={snap}
            still={reduce}
          />
        ))}
      </Canvas>

      {/* Labels de sommets (taille 'l'), branches mesurées uniquement. */}
      {showLabels
        ? layout.axes.map((a) => {
            const pos = radarVertex(layout.cx, layout.cy, layout.r + 14, a.index, 1);
            return (
              <Text
                key={`label-${a.branch}`}
                style={[
                  styles.label,
                  { left: margin + pos.x - LABEL_WIDTH / 2, top: margin + pos.y - 8 },
                ]}
                numberOfLines={1}
              >
                {labels?.[a.branch] ?? QDI_BRANCH_LABELS[a.branch]}
              </Text>
            );
          })
        : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    width: LABEL_WIDTH,
    textAlign: 'center',
    fontFamily: typo.bodyMedium,
    fontSize: 11,
    color: colors.text.mid,
  },
});
