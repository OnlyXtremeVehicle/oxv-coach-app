/**
 * AnimatedPresence — mount/unmount en fondu + translation pour les
 * panneaux dépliables.
 *
 * `visible` pilote la présence : à l'ouverture, le contenu monte en fondu
 * (opacity 0 → 1, translateY léger) pendant que LayoutAnimation anime la
 * réorganisation du contenu autour ; à la fermeture, le fondu sortant se
 * joue AVANT le démontage — le panneau ne disparaît jamais sèchement.
 *
 * LayoutAnimation est encapsulé proprement : activation Android
 * (setLayoutAnimationEnabledExperimental) faite une seule fois, au premier
 * usage — l'appelant n'a rien à configurer.
 *
 * Reduce-motion : montage/démontage direct, aucune animation de layout.
 * Fondu en useNativeDriver: true → 60 fps.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReduceMotion } from './useReduceMotion';

let layoutAnimationReady = false;

/** Active LayoutAnimation côté Android (no-op ailleurs, une seule fois). */
function ensureLayoutAnimationEnabled(): void {
  if (layoutAnimationReady) return;
  layoutAnimationReady = true;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

function configureLayout(duration: number): void {
  ensureLayoutAnimationEnabled();
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      duration,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
}

export interface AnimatedPresenceProps {
  /** Présence du contenu : true = monté et visible, false = démonté. */
  visible: boolean;
  children: ReactNode;
  /** Durée du fondu en ms. Par défaut 250. */
  duration?: number;
  /** Amplitude de la translation verticale en pixels. Par défaut 6. */
  translateY?: number;
  /** Désactive l'animation (montage/démontage direct). Par défaut false. */
  disabled?: boolean;
  /** Style du conteneur. */
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPresence({
  visible,
  children,
  duration = 250,
  translateY = 6,
  disabled = false,
  style,
}: AnimatedPresenceProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion;
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (off) {
      progress.stopAnimation();
      progress.setValue(visible ? 1 : 0);
      setRendered(visible);
      return;
    }

    if (visible) {
      // Le layout s'ouvre en même temps que le fondu entrant.
      configureLayout(duration);
      setRendered(true);
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      anim.start();
      return () => {
        anim.stop();
      };
    }

    // Fermeture : fondu sortant d'abord, démontage ensuite.
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      // Si une réouverture a interrompu la sortie, on ne démonte pas.
      if (!finished) return;
      configureLayout(duration);
      setRendered(false);
    });
    return () => {
      anim.stop();
    };
  }, [visible, off, duration, progress]);

  if (!rendered) return null;

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
