/**
 * Stagger V2 — les enfants entrent en cascade (`motion.stagger`, 45 ms).
 *
 * Version Reanimated du patron (n'importe PAS l'ancien Stagger de
 * src/components/motion) : chaque enfant reçoit un `entering` FadeInDown
 * décalé, exécuté sur l'UI thread.
 *
 * FlashList : ne pas envelopper la liste dans <Stagger> — utiliser
 * `staggerEntering(index)` directement en prop `entering` de l'item.
 * Le délai est plafonné (STAGGER_MAX_DELAY_MS) pour que le recyclage
 * et les longues listes ne traînent pas.
 *
 * Reduce-motion : rendu direct (et Reanimated 3 respecte de toute façon
 * le réglage système pour les animations d'entrée).
 */

import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { STAGGER_MAX_DELAY_MS, staggerDelayV2 } from './motionMath';
import { motion } from '../tokens';

/**
 * Animation d'entrée Reanimated pour l'enfant à l'index donné —
 * utilisable en prop `entering` (item de FlashList compris).
 */
export function staggerEntering(
  index: number,
  step: number = motion.stagger,
  initialDelay = 0,
  maxDelay: number = STAGGER_MAX_DELAY_MS
) {
  return FadeInDown.delay(staggerDelayV2(index, step, initialDelay, maxDelay)).duration(
    motion.door
  );
}

export interface StaggerProps {
  children: ReactNode;
  /** Délai entre deux enfants consécutifs en ms. Par défaut motion.stagger (45). */
  step?: number;
  /** Délai avant le premier enfant en ms. Par défaut 0. */
  initialDelay?: number;
  /** Plafond absolu du délai en ms. Par défaut STAGGER_MAX_DELAY_MS (450). */
  maxDelay?: number;
  /** Style du conteneur. */
  style?: StyleProp<ViewStyle>;
  /** Style du wrapper de chaque enfant. */
  itemStyle?: StyleProp<ViewStyle>;
}

export function Stagger({
  children,
  step = motion.stagger,
  initialDelay = 0,
  maxDelay = STAGGER_MAX_DELAY_MS,
  style,
  itemStyle,
}: StaggerProps) {
  const reduce = useReduceMotion();
  // toArray écarte null/undefined/booléens : la cascade ne saute pas
  // un temps sur un enfant conditionnel absent.
  const items = Children.toArray(children);

  return (
    <View style={style}>
      {items.map((child, index) => (
        <Animated.View
          key={typeof child === 'object' && 'key' in child && child.key != null ? child.key : index}
          style={itemStyle}
          entering={reduce ? undefined : staggerEntering(index, step, initialDelay, maxDelay)}
        >
          {child}
        </Animated.View>
      ))}
    </View>
  );
}
