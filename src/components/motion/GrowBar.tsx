/**
 * GrowBar — une barre qui s'étire à l'apparition.
 *
 * scaleX 0 → 1 depuis le bord gauche (transformOrigin: 'left', supporté
 * depuis RN 0.73), ease-out cubic. Pour toutes les barres de données :
 * jauges de marge, barres de comparaison, segments de secteur.
 *
 * La barre EST ce composant : l'appelant lui donne son style (couleur,
 * hauteur, largeur/flex, radius) et la donnée reste la largeur finale —
 * le motion habille, il ne fabrique rien.
 *
 * Reduce-motion : la barre est rendue à sa taille finale immédiatement.
 * useNativeDriver: true (transform) → 60 fps.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

export interface GrowBarProps {
  /** Contenu optionnel (étiquette posée sur la barre). */
  children?: ReactNode;
  /** Durée de l'étirement en ms. Par défaut 600. */
  duration?: number;
  /** Délai avant le début en ms. Par défaut 0. */
  delay?: number;
  /** Désactive l'animation (rendu direct). Par défaut false. */
  disabled?: boolean;
  /** Style de la barre (couleur, dimensions, radius). */
  style?: StyleProp<ViewStyle>;
}

export function GrowBar({
  children,
  duration = 600,
  delay = 0,
  disabled = false,
  style,
}: GrowBarProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion;
  const progress = useRef(new Animated.Value(off ? 1 : 0)).current;

  useEffect(() => {
    if (off) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [off, duration, delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          transformOrigin: 'left',
          transform: [{ scaleX: progress }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
