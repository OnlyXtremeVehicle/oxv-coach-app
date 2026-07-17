/**
 * PressableScale — le pressable standard OXV.
 *
 * Retour tactile visuel à l'appui : scale 0.97 + opacité 0.85, ease-out
 * court à l'enfoncement, relâche un peu plus lente. Pas de spring, pas de
 * rebond — juste le poids d'un bouton physique.
 *
 * Haptique optionnelle via `haptic` (branchée sur src/lib/haptics, donc
 * silencieuse en piste et sous Expo Go — Principe 3 respecté sans effort).
 *
 * API compatible Pressable : toutes les props passent (accessibilityRole,
 * hitSlop, disabled…). Seule restriction : `style` est un StyleProp<ViewStyle>
 * statique, pas une fonction de l'état pressed (l'état pressed est déjà
 * exprimé par l'animation).
 *
 * Reduce-motion : le scale (mouvement) est coupé ; l'opacité change
 * instantanément pour conserver un retour visuel à l'appui.
 *
 * useNativeDriver: true (transform + opacity) → 60 fps.
 */

import { useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { confirm, success, tap, warning } from '@/lib/haptics';

import { useReduceMotion } from './useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Retour haptique déclenché à l'enfoncement (voir src/lib/haptics). */
export type PressableScaleHaptic = 'tap' | 'confirm' | 'success' | 'warning';

const HAPTIC_BY_NAME: Record<PressableScaleHaptic, () => void> = {
  tap,
  confirm,
  success,
  warning,
};

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Style du conteneur (statique — l'état pressed est porté par l'animation). */
  style?: StyleProp<ViewStyle>;
  /** Échelle à l'enfoncement. Par défaut 0.97. */
  pressedScale?: number;
  /** Opacité à l'enfoncement. Par défaut 0.85. */
  pressedOpacity?: number;
  /** Retour haptique à l'enfoncement. Par défaut aucun. */
  haptic?: PressableScaleHaptic;
  /** Désactive l'animation (le Pressable reste fonctionnel). Par défaut false. */
  animationDisabled?: boolean;
}

const PRESS_IN_DURATION = 90;
const PRESS_OUT_DURATION = 160;

export function PressableScale({
  style,
  pressedScale = 0.97,
  pressedOpacity = 0.85,
  haptic,
  animationDisabled = false,
  onPressIn,
  onPressOut,
  children,
  ...pressableProps
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const off = animationDisabled;
  // 0 = relâché, 1 = enfoncé.
  const pressed = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (haptic) HAPTIC_BY_NAME[haptic]();
      if (!off) {
        if (reduceMotion) {
          // Pas de mouvement : retour visuel instantané (opacité seule).
          pressed.setValue(1);
        } else {
          Animated.timing(pressed, {
            toValue: 1,
            duration: PRESS_IN_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      }
      onPressIn?.(event);
    },
    [haptic, off, reduceMotion, pressed, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (!off) {
        if (reduceMotion) {
          pressed.setValue(0);
        } else {
          Animated.timing(pressed, {
            toValue: 0,
            duration: PRESS_OUT_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      }
      onPressOut?.(event);
    },
    [off, reduceMotion, pressed, onPressOut]
  );

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    opacity: pressed.interpolate({
      inputRange: [0, 1],
      outputRange: [1, pressedOpacity],
    }),
    // Sous reduce-motion, le scale reste à 1 : seul un mouvement serait gênant.
    transform: reduceMotion
      ? undefined
      : [
          {
            scale: pressed.interpolate({
              inputRange: [0, 1],
              outputRange: [1, pressedScale],
            }),
          },
        ],
  };

  return (
    <AnimatedPressable
      {...pressableProps}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, off ? undefined : animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
