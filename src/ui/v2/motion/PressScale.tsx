/**
 * PressScale — le wrapper Pressable universel de (app2) : scale 0.97 à
 * l'appui (timing court), retour en spring, haptic('tap') au press.
 *
 * Répartition des styles (contrat d'API du kit V2) :
 *   - `containerStyle` va sur le Pressable EXTERNE — le LAYOUT uniquement
 *     (flex, width, margin, alignSelf…) ;
 *   - `style` va sur l'Animated.View INTERNE — le VISUEL (fond, bordure,
 *     padding, ombre…) : la carte entière se contracte, ombres comprises.
 *
 * `accessibilityState` du consommateur est fusionné avec le disabled
 * courant ({ disabled, ...accessibilityState }). Reduce-motion : pas de
 * scale, le haptic reste (retour utile, pas décoratif).
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  type AccessibilityState,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { haptic } from '../haptics';
import { motion } from '../tokens';

const PRESSED_SCALE = 0.97;
const PRESS_IN_MS = 90;

export interface PressScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Style VISUEL, posé sur la vue animée interne (fond, bordure, ombre…). */
  style?: StyleProp<ViewStyle>;
  /** Style de LAYOUT, posé sur le Pressable externe (flex, width, margin…). */
  containerStyle?: StyleProp<ViewStyle>;
  hitSlop?: PressableProps['hitSlop'];
  accessibilityLabel?: string;
  /** Par défaut 'button'. */
  accessibilityRole?: PressableProps['accessibilityRole'];
  /** Fusionné avec le disabled courant : { disabled, ...accessibilityState }. */
  accessibilityState?: AccessibilityState;
  /** haptic('tap') au press. Par défaut true. */
  hapticOnPress?: boolean;
}

export function PressScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  containerStyle,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hapticOnPress = true,
}: PressScaleProps) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!reduce) {
      scale.value = withTiming(PRESSED_SCALE, {
        duration: PRESS_IN_MS,
        easing: Easing.out(Easing.quad),
      });
    }
  };

  const handlePressOut = () => {
    if (!reduce) {
      scale.value = withSpring(1, motion.spring);
    }
  };

  const handlePress = () => {
    if (hapticOnPress) haptic('tap');
    if (onPress) onPress();
  };

  return (
    <Pressable
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={containerStyle}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
    >
      <Animated.View style={[style, scaleStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
