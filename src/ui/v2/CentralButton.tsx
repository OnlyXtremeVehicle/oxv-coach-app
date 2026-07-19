/**
 * CentralButton — le bouton central de la TabBar (lot L0, Livrable 7).
 *
 * 3 états visuels (mapping pur dans shellLogic.centralButtonVisual) :
 *   reserve   → cercle fond carte, bord accent, icône drapeau-damier
 *   countdown → même chrome, label mono (ex. 'J-3'), icône chrono à défaut
 *   rec       → cercle PLEIN accent, point pulsant (motion.pulse),
 *               haptic('arm') à l'appui — armer la capture
 *
 * Flottant −8 px au-dessus de la ligne de la barre (CENTRAL_FLOAT_OFFSET).
 * S'appuie sur PressScale (scale 0.97) avec son haptic coupé : le vocabulaire
 * tactile dépend du mode et passe par haptic() ici.
 * Reduce-motion : point statique, pas de pulse.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from './haptics';
import { OxvIcon } from './icons';
import { PressScale } from './motion/PressScale';
import { useReduceMotion } from './motion/useReduceMotion';
import {
  CENTRAL_BUTTON_SIZE,
  CENTRAL_FLOAT_OFFSET,
  centralButtonAccessibilityLabel,
  centralButtonVisual,
  type CentralButtonMode,
} from './shellLogic';
import { colors, motion, type as typo } from './tokens';

/** Diamètre du point pulsant en mode rec (px). */
const REC_DOT_SIZE = 14;

export interface CentralButtonProps {
  mode: CentralButtonMode;
  /** Label court affiché dans le cercle (ex. 'J-3'). Ignoré en mode rec. */
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CentralButton({ mode, label, onPress, style }: CentralButtonProps) {
  const reduce = useReduceMotion();
  const visual = centralButtonVisual(mode);

  // Pulse du point rec : respiration lente sur motion.pulse, UI thread.
  const dotScale = useSharedValue(1);
  useEffect(() => {
    if (!visual.pulse || reduce) {
      cancelAnimation(dotScale);
      dotScale.value = 1;
      return;
    }
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: motion.pulse / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: motion.pulse / 2, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(dotScale);
    };
  }, [visual.pulse, reduce, dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  const handlePress = () => {
    haptic(visual.haptic);
    onPress();
  };

  const showLabel = mode !== 'rec' && label !== undefined && label.length > 0;

  // Le flottement vit sur une vue EXTÉRIEURE : le style animé de PressScale
  // pose sa propre clé `transform` et écraserait un translateY passé en style.
  return (
    <View style={[styles.float, style]}>
      <PressScale
        onPress={handlePress}
        hapticOnPress={false}
        accessibilityLabel={centralButtonAccessibilityLabel(mode, label)}
      >
        <View style={[styles.circle, visual.filled ? styles.circleFilled : styles.circleOutlined]}>
          {mode === 'rec' ? (
            <Animated.View style={[styles.recDot, dotStyle]} />
          ) : showLabel ? (
            <Text style={styles.label} allowFontScaling={false} numberOfLines={1}>
              {label}
            </Text>
          ) : visual.icon !== null ? (
            <OxvIcon name={visual.icon} size={24} color={colors.accent} />
          ) : null}
        </View>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  float: {
    transform: [{ translateY: CENTRAL_FLOAT_OFFSET }],
  },
  circle: {
    width: CENTRAL_BUTTON_SIZE,
    height: CENTRAL_BUTTON_SIZE,
    borderRadius: CENTRAL_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOutlined: {
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  circleFilled: {
    backgroundColor: colors.accent,
  },
  recDot: {
    width: REC_DOT_SIZE,
    height: REC_DOT_SIZE,
    borderRadius: REC_DOT_SIZE / 2,
    backgroundColor: colors.text.hi,
  },
  label: {
    fontFamily: typo.monoSemi,
    fontSize: 15,
    color: colors.text.hi,
    paddingHorizontal: 4,
  },
});
