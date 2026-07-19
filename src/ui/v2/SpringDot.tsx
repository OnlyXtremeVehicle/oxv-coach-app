/**
 * SpringDot — fragment Skia : une puce qui « claque » (rayon 0 → r en spring
 * `motion.spring`, léger overshoot mécanique) après `delay` ms, dès que
 * `play` passe à vrai. Utilisée par RadarQdi (sommets) et TraceCircuit
 * (puces d'événements), séquencée via `DOT_STAGGER_MS`.
 *
 * `still` (reduce-motion) : puce pleine immédiatement, aucun mouvement.
 * À PLACER DANS UN <Canvas> Skia — ceci n'est pas une vue RN.
 */

import { useEffect } from 'react';
import { Circle } from '@shopify/react-native-skia';
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { motion } from './tokens';

export interface SpringDotProps {
  x: number;
  y: number;
  /** Rayon final (px). */
  r: number;
  color: string;
  /** Délai avant le claquement (ms). Par défaut 0. */
  delay?: number;
  /** Déclenche le spring (une fois). */
  play?: boolean;
  /** Rendu statique plein, sans mouvement (reduce-motion). */
  still?: boolean;
}

export function SpringDot({
  x,
  y,
  r,
  color,
  delay = 0,
  play = false,
  still = false,
}: SpringDotProps) {
  const scale = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    if (play) {
      scale.value = withDelay(delay, withSpring(1, motion.spring));
    }
  }, [still, play, delay, scale]);

  const radiusValue = useDerivedValue(() => Math.max(0, r * scale.value));

  return <Circle cx={x} cy={y} r={radiusValue} color={color} />;
}
