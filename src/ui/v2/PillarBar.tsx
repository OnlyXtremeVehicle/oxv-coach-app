/**
 * PillarBar — barre de pilier (lot L0, livrable 7). Remplissage animé au
 * PREMIER viewport (useFirstViewport : measure sur UI thread), valeur mono
 * à droite.
 *
 * Règle données réelles : valeur absente → « — » en text.dim et barre vide.
 * JAMAIS de valeur inventée, jamais un zéro par défaut.
 *
 * La couleur du remplissage est une DONNÉE (les écrans passent la couleur
 * QDI de la branche) — défaut neutre text.hi. Reduce-motion : barre pleine
 * immédiatement, sans mouvement.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './motion/useReduceMotion';
import { colors, motion, radius, space, type as typo } from './tokens';
import { useFirstViewport } from './useFirstViewport';
import { formatPillarValue, pillarRatio } from './vizMath';

export interface PillarBarProps {
  label: string;
  /** Valeur réelle, ou null/undefined si non mesurée (→ « — », barre vide). */
  value: number | null | undefined;
  /** Échelle (valeur pleine). Défaut 100. */
  max?: number;
  /** Unité affichée après la valeur (ex. '%'). */
  unit?: string;
  /** Couleur du remplissage (donnée — ex. couleur QDI). Défaut text.hi. */
  color?: string;
  /** Attendre le premier viewport avant d'animer. Défaut vrai. */
  animateOnViewport?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PillarBar({
  label,
  value,
  max = 100,
  unit,
  color = colors.text.hi,
  animateOnViewport = true,
  style,
}: PillarBarProps) {
  const reduce = useReduceMotion();
  const { ref, visible } = useFirstViewport(animateOnViewport && !reduce);

  const progress = useSharedValue(0);
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    if (reduce) {
      played.current = true;
      progress.value = 1;
      return;
    }
    if (!visible) return;
    played.current = true;
    progress.value = withTiming(1, { duration: motion.radar, easing: Easing.out(Easing.cubic) });
  }, [reduce, visible, progress]);

  const ratio = pillarRatio(value, max);
  const display = formatPillarValue(value, unit);
  const absent = display === '—';

  const fillStyle = useAnimatedStyle(
    () => ({ width: `${ratio * 100 * progress.value}%` }),
    [ratio]
  );

  return (
    <Animated.View
      ref={ref}
      style={style}
      accessible
      accessibilityLabel={absent ? `${label} : non mesuré` : `${label} : ${display}`}
    >
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.value, absent && styles.valueAbsent]}>{display}</Text>
      </View>
      <View style={styles.track}>
        {ratio > 0 ? (
          <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
    gap: space.md,
  },
  label: {
    flexShrink: 1,
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },
  value: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.hi,
  },
  // text.low (pas dim) : le « — » doit rester lisible (contraste AA),
  // simplement en retrait de la valeur mesurée.
  valueAbsent: {
    color: colors.text.low,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.card2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
