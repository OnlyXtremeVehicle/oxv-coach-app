/**
 * NeedleSweep — l'aiguille de cadran V2. Rejoint son angle en spring
 * `motion.spring`, avec le léger overshoot mécanique du ressort.
 *
 * Convention : 0° = midi, sens horaire (utiliser needleAngle de motionMath
 * pour mapper une valeur métier sur une plage d'angles).
 *
 * `snapHaptic` (opt-in, pour le Dial) : haptic('doorSnap') quand l'aiguille
 * se pose — désactivé par défaut pour ne pas vibrer à chaque mise à jour
 * d'une valeur qui vit. Il ne joue QUE sur un vrai mouvement : au montage
 * (l'aiguille naît déjà posée) ou si la cible ne change pas, ni animation
 * ni haptic.
 *
 * Reduce-motion : l'aiguille se place directement.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { haptic } from '../haptics';
import { colors, motion } from '../tokens';

export interface NeedleSweepProps {
  /** Angle cible en degrés (0 = midi, sens horaire). */
  angle: number;
  /** Côté du carré conteneur. Par défaut 48. */
  size?: number;
  /** Couleur de l'aiguille. Par défaut colors.text.hi. */
  color?: string;
  /** Épaisseur de l'aiguille. Par défaut 2. */
  thickness?: number;
  /** haptic('doorSnap') en fin de course. Par défaut false. */
  snapHaptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NeedleSweep({
  angle,
  size = 48,
  color = colors.text.hi,
  thickness = 2,
  snapHaptic = false,
  style,
}: NeedleSweepProps) {
  const reduce = useReduceMotion();
  const rotation = useSharedValue(angle);
  // Dernière cible demandée — l'aiguille naît déjà posée sur `angle`.
  const prevAngle = useRef(angle);

  useEffect(() => {
    // Cible inchangée (montage compris, ou re-run sur une autre dep) :
    // aucun mouvement → ni animation ni haptic.
    if (prevAngle.current === angle) return;
    prevAngle.current = angle;
    if (reduce) {
      rotation.value = angle;
      return;
    }
    rotation.value = withSpring(angle, motion.spring, (finished) => {
      'worklet';
      if (finished === true && snapHaptic) runOnJS(haptic)('doorSnap');
    });
  }, [angle, reduce, snapHaptic, rotation]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.needleWrap, needleStyle]}>
        <View
          style={{
            position: 'absolute',
            top: size * 0.12,
            width: thickness,
            height: size * 0.38,
            borderRadius: thickness / 2,
            backgroundColor: color,
          }}
        />
      </Animated.View>
      <View style={[styles.hub, { top: size / 2 - 3, left: size / 2 - 3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  needleWrap: {
    alignItems: 'center',
  },
  hub: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.strong,
  },
});
