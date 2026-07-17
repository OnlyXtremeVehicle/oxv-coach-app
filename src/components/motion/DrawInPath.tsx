/**
 * DrawInPath — un Path SVG qui se dessine à l'apparition.
 *
 * Technique classique strokeDasharray/strokeDashoffset : le dash couvre
 * toute la longueur du tracé, l'offset recule de `length` à 0 et le trait
 * « s'écrit » — tracés de circuit, courbes de vitesse, profils de virage.
 *
 * react-native-svg n'expose pas getTotalLength() : la longueur du tracé
 * est donc fournie par l'appelant via `length`. Pour un tracé issu d'une
 * polyline, les helpers purs polylineToPathD / polylineLength (pathMath.ts)
 * calculent `d` et `length` d'un coup.
 *
 * Doit être enfant d'un <Svg> parent (comme tout Path).
 *
 * Reduce-motion : le tracé est rendu complet immédiatement, sans dash.
 * useNativeDriver: false — les props SVG ne passent pas par le driver natif.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path, type PathProps } from 'react-native-svg';

import { useReduceMotion } from './useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface DrawInPathProps extends Omit<PathProps, 'strokeDasharray' | 'strokeDashoffset'> {
  /** Longueur totale du tracé (voir polylineLength dans pathMath.ts). */
  length: number;
  /** Durée du dessin en ms. Par défaut 1500. */
  duration?: number;
  /** Délai avant le début du dessin en ms. Par défaut 0. */
  delay?: number;
  /** Désactive l'animation (tracé rendu complet). Par défaut false. */
  disabled?: boolean;
}

export function DrawInPath({
  length,
  duration = 1500,
  delay = 0,
  disabled = false,
  ...pathProps
}: DrawInPathProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion || length <= 0;
  // 1 = tracé caché (offset plein), 0 = tracé complet.
  const dashOffset = useRef(new Animated.Value(off ? 0 : 1)).current;

  useEffect(() => {
    if (off) {
      dashOffset.setValue(0);
      return;
    }
    dashOffset.setValue(1);
    const anim = Animated.timing(dashOffset, {
      toValue: 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [off, duration, delay, dashOffset]);

  if (off) {
    return <Path {...pathProps} />;
  }

  return (
    <AnimatedPath
      {...pathProps}
      strokeDasharray={`${length}`}
      strokeDashoffset={dashOffset.interpolate({
        inputRange: [0, 1],
        outputRange: [0, length],
      })}
    />
  );
}
