/**
 * BreathingGlow — un halo d'opacité qui respire lentement.
 *
 * Boucle subtile 1 → minOpacity → 1 en ease-in-out sur `period` ms.
 * Réservé aux héros d'écran : le chiffre roi, une carte trophée. Discret
 * par construction (minOpacity 0.88 par défaut) — si on le remarque au
 * premier regard, c'est trop.
 *
 * Un seul BreathingGlow par écran : deux respirations simultanées se
 * désynchronisent et attirent l'œil au lieu de le poser.
 *
 * Reduce-motion : opacité pleine, statique, aucune boucle.
 * useNativeDriver: true (opacity) → aucun coût JS par frame.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

export interface BreathingGlowProps {
  children: ReactNode;
  /** Opacité basse de la respiration. Par défaut 0.88. */
  minOpacity?: number;
  /** Durée d'un cycle complet (aller-retour) en ms. Par défaut 4000. */
  period?: number;
  /** Désactive la respiration (opacité pleine, statique). Par défaut false. */
  disabled?: boolean;
  /** Style du conteneur. */
  style?: StyleProp<ViewStyle>;
}

export function BreathingGlow({
  children,
  minOpacity = 0.88,
  period = 4000,
  disabled = false,
  style,
}: BreathingGlowProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion;
  // 0 = opacité pleine, 1 = opacité basse.
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (off) {
      breath.setValue(0);
      return;
    }
    const half = period / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      breath.setValue(0);
    };
  }, [off, period, breath]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: breath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, minOpacity],
          }),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
