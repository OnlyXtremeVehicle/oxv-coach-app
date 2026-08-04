/**
 * StatusPill — pastille d'état de la refonte NG (docs/refonte-app).
 *
 * Point + libellé mono, dans une pilule discrète. Pose un état vivant (CONNECTÉ,
 * BÊTA, HORS LIGNE) sans devenir une décoration. Le point respire quand l'état
 * est « live » (connecté) — sinon fixe.
 *
 * Code couleur : vert = connecté / actif (canon) ; or = donnée prête ; neutre =
 * inactif / info. JAMAIS le rouge de marque pour un état pilote.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { useReduceMotion } from '@/components/motion/useReduceMotion';

const { palette, fonts, radius, spacing } = theme;

export type PillTone = 'connected' | 'data' | 'neutral';

const TONE: Record<PillTone, string> = {
  connected: palette.green,
  data: palette.gold,
  neutral: palette.creamMute,
};

export function StatusPill({
  label,
  tone = 'neutral',
  live = false,
}: {
  label: string;
  tone?: PillTone;
  /** Le point respire (état temps réel, ex. connecté). */
  live?: boolean;
}) {
  const dotColor = TONE[tone];
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Le point de présence reste plein, sans respirer.
    if (!live || reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse, reduceMotion]);

  return (
    <View style={s.pill} accessibilityRole="text" accessibilityLabel={label}>
      <Animated.View
        style={[s.dot, { backgroundColor: dotColor }, live ? { opacity: pulse } : null]}
      />
      <Text
        style={[
          s.label,
          { color: dotColor === palette.creamMute ? palette.creamMute : palette.creamSoft },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
