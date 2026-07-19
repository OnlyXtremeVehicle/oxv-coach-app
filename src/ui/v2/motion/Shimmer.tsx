/**
 * Shimmer — squelette de chargement : forme `bg.card2` arrondie balayée
 * par une lumière froide en boucle. Remplace TOUT spinner dans (app2).
 *
 * La bande lumineuse est un dégradé transparent → border.strong →
 * transparent (froid, dans les tokens), translaté en boucle par Reanimated.
 * La largeur réelle est mesurée au layout (width peut être '100%').
 *
 * Reduce-motion : bloc statique, aucune boucle.
 * Masqué des lecteurs d'écran : un squelette n'est pas un contenu.
 */

import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { lerp } from './motionMath';
import { colors, motion, radius } from '../tokens';

export interface ShimmerProps {
  /** Hauteur de la forme (px). */
  height: number;
  /** Largeur de la forme. Par défaut '100%'. */
  width?: DimensionValue;
  /** Rayon des coins. Par défaut radius.cell. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Shimmer({
  height,
  width = '100%',
  radius: cornerRadius = radius.cell,
  style,
}: ShimmerProps) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    if (reduce || measuredWidth <= 0) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: motion.pulse, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [reduce, measuredWidth, progress]);

  const bandWidth = Math.max(64, measuredWidth * 0.35);

  const bandStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: lerp(-bandWidth, measuredWidth, progress.value) }],
    }),
    [bandWidth, measuredWidth]
  );

  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[
        { height, width, borderRadius: cornerRadius, backgroundColor: colors.bg.card2 },
        styles.clip,
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reduce && measuredWidth > 0 ? (
        <Animated.View style={[styles.band, { width: bandWidth }, bandStyle]}>
          <LinearGradient
            colors={['transparent', colors.border.strong, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.7,
  },
});
