/**
 * useDoorTransition — entrée d'écran V2 : la « porte ».
 *
 * Fondu + translation verticale 12 → 0 px sur `motion.door` (260 ms),
 * easing out. Renvoie un style animé Reanimated à poser sur le conteneur
 * racine de l'écran.
 *
 * Reduce-motion : rendu final immédiat, aucun mouvement.
 */

import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { motion } from '../tokens';

const DOOR_TRANSLATE_PX = 12;

export function useDoorTransition(delay = 0) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      Math.max(0, delay),
      withTiming(1, { duration: motion.door, easing: Easing.out(Easing.cubic) })
    );
  }, [reduce, delay, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: DOOR_TRANSLATE_PX * (1 - progress.value) }],
  }));
}
