/**
 * Layer Tracé — polyline du circuit avec animation optionnelle.
 *
 * Anim : le tracé se dessine progressivement (stroke-dasharray classique)
 * sur ~1.5s avec ease-out. Utile en bilan post-session pour un effet
 * d'apparition sobre.
 *
 * Ce layer ne renvoie QUE des éléments SVG (Path) — il doit être enfant
 * d'un <Svg> parent (fourni par CircuitMap).
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { getScenePoints } from '../projection';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface TrackLayerProps {
  /** Anime le dessin progressif du tracé à l'entrée (~1.5s). */
  animate?: boolean;
  /** Couleur du tracé. Par défaut text.secondary (gris doux). */
  color?: string;
  /** Largeur du trait. Par défaut 4. */
  strokeWidth?: number;
  /** Opacité du tracé. Par défaut 0.4 (discret, layers passent par-dessus). */
  opacity?: number;
}

export function TrackLayer({
  animate = false,
  color = colors.text.secondary,
  strokeWidth = 4,
  opacity = 0.4,
}: TrackLayerProps) {
  const dashOffset = useRef(new Animated.Value(animate ? 1 : 0)).current;

  // d-path + longueur approximative calculés une fois
  const { d, pathLength } = useMemo(() => {
    const points = getScenePoints();
    const dStr = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return { d: dStr, pathLength: total };
  }, []);

  useEffect(() => {
    if (!animate) return;
    Animated.timing(dashOffset, {
      toValue: 0,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animate, dashOffset]);

  const interpolatedOffset = dashOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pathLength],
  });

  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={opacity}
      strokeDasharray={animate ? `${pathLength}` : undefined}
      strokeDashoffset={animate ? interpolatedOffset : undefined}
    />
  );
}
