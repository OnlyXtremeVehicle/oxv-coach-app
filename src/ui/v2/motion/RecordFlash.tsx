/**
 * RecordFlash — célébration record SOBRE, 900 ms, une seule fois.
 *
 * Le chrono pulse deux fois blanc → or (interpolateColor sur l'UI thread),
 * léger grossissement, halo bref sous le texte — rendu ici par l'ombre
 * portée du texte en `heritage.glow` (une lumière DU trait, jamais un
 * fond : conforme à la règle des tokens, et sans dépendance Skia pour
 * cette primitive). haptic('record') au départ. Pas de confetti, jamais.
 *
 * Le composant possède son Animated.Text (la couleur ne s'anime pas de
 * l'extérieur) : passer le chrono via `text`. Front montant de `trigger`
 * → joue une fois ; repasser trigger à false ré-arme.
 *
 * Reduce-motion : or tenu 900 ms puis retour, sans pulse ni scale.
 */

import { useEffect, useRef } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { haptic } from '../haptics';
import { RECORD_FLASH_MS, recordPulsePhases } from './motionMath';
import { colors, type as typo } from '../tokens';

export interface RecordFlashProps {
  /** Front montant → la célébration joue une fois. False ré-arme. */
  trigger: boolean;
  /** Le chrono célébré (ex. '1:41.203'). */
  text: string;
  /** Par défaut 34. */
  fontSize?: number;
  /** Par défaut type.monoSemi. */
  fontFamily?: string;
  /** Couleur de repos. Par défaut colors.text.hi (blanc). */
  baseColor?: string;
  /** Couleur du pulse. Par défaut colors.heritage.gold. */
  goldColor?: string;
  style?: StyleProp<TextStyle>;
  /** Appelé à la fin des 900 ms. */
  onDone?: () => void;
}

export function RecordFlash({
  trigger,
  text,
  fontSize = 34,
  fontFamily = typo.monoSemi,
  baseColor = colors.text.hi,
  goldColor = colors.heritage.gold,
  style,
  onDone,
}: RecordFlashProps) {
  const reduce = useReduceMotion();
  const phase = useSharedValue(0);
  const played = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!trigger) {
      played.current = false;
      return;
    }
    if (played.current) return;
    played.current = true;

    // Jamais deux timers en vie : un ré-armement rapide (trigger false →
    // true) laisserait sinon l'ancien timeout éteindre la nouvelle
    // célébration à contretemps.
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    haptic('record');
    const finish = () => {
      if (onDone) onDone();
    };

    if (reduce) {
      // Sans mouvement : l'or se tient, puis s'éteint.
      phase.value = 1;
      timer.current = setTimeout(() => {
        timer.current = null;
        phase.value = 0;
        finish();
      }, RECORD_FLASH_MS);
      return;
    }

    const [p1, p2, p3, p4] = recordPulsePhases(RECORD_FLASH_MS);
    phase.value = 0;
    phase.value = withSequence(
      withTiming(1, { duration: p1, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: p2, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: p3, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: p4, easing: Easing.in(Easing.quad) }, (finished) => {
        'worklet';
        if (finished === true) runOnJS(finish)();
      })
    );
  }, [trigger, reduce, onDone, phase]);

  // Nettoyage au démontage uniquement — on n'interrompt pas une
  // célébration en cours sur un simple changement de prop.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      cancelAnimation(phase);
    },
    [phase]
  );

  const flashStyle = useAnimatedStyle(() => ({
    color: interpolateColor(phase.value, [0, 1], [baseColor, goldColor]),
    transform: [{ scale: 1 + 0.04 * phase.value }],
    textShadowColor: colors.heritage.glow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12 * phase.value,
  }));

  const baseStyle: TextStyle = {
    fontFamily,
    fontSize,
    fontVariant: ['tabular-nums'],
  };

  return (
    <Animated.Text style={[baseStyle, style, flashStyle]} allowFontScaling={false}>
      {text}
    </Animated.Text>
  );
}
