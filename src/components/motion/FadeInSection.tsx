/**
 * FadeInSection — wrapper qui fait apparaître ses enfants en fondu vers le haut.
 *
 * Sobre : opacity 0 → 1 + translateY 8 → 0 sur 400 ms ease-out, avec
 * un `delay` configurable pour orchestrer une cascade (ex: 3 actes du
 * debrief qui apparaissent en séquence à 200 ms d'écart).
 *
 * Utilise useNativeDriver (transform + opacity) → 60 fps garanti même
 * sur iPhone alpha bas de gamme.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

export interface FadeInSectionProps {
  children: ReactNode;
  /** Délai avant le début de l'animation en ms. Par défaut 0. */
  delay?: number;
  /** Durée de l'animation en ms. Par défaut 400. */
  duration?: number;
  /** Amplitude de la translation verticale en pixels. Par défaut 8. */
  translateY?: number;
  /** Désactive l'animation (rendu direct). Par défaut false. */
  disabled?: boolean;
  /** Style additionnel appliqué au conteneur Animated.View. */
  style?: ViewStyle | ViewStyle[];
}

export function FadeInSection({
  children,
  delay = 0,
  duration = 400,
  translateY = 8,
  disabled = false,
  style,
}: FadeInSectionProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion;
  const progress = useRef(new Animated.Value(off ? 1 : 0)).current;

  useEffect(() => {
    if (off) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, duration, off, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [translateY, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
