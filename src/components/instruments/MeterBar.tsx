/**
 * MeterBar — barre de mesure lumineuse, version gaming (thème v2).
 *
 * Le primitif des secteurs (S1/S2/S3) et des piliers (Signature, Consistance,
 * Évolution, Combiné) de la maquette débrief : un libellé, une valeur, une barre
 * de remplissage qui monte à l'ouverture. Optionnellement cliquable — un pilier
 * renvoie vers son écran dédié.
 *
 * Doctrine cockpit factuel : la couleur (`tone`) est de la donnée, jamais un
 * verdict. Or = neutre/donnée, vert = tendance favorable, heritage = signature,
 * faint = en retrait. JAMAIS de rouge (réservé marque + bande coach).
 *
 * Usage :
 *   <MeterBar label="S2" value="38,1" fillPct={68} tone="gold" />
 *   <MeterBar label="Consistance" value="87 %" fillPct={87} tone="green"
 *             onPress={() => router.push('/(app)/regularite')} />
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, fontSize, hitSlop, motion, palette, radius, spacing } from '@/theme/v2';

export type MeterTone = 'gold' | 'green' | 'heritage' | 'faint';

export interface MeterBarProps {
  label: string;
  /** Valeur affichée à droite (ex. « 26,4 », « 87 % », « Tardif »). */
  value?: string;
  /** Remplissage de la barre, 0..100. */
  fillPct: number;
  /** Couleur de la donnée. Défaut « gold ». Jamais de rouge. */
  tone?: MeterTone;
  /** Ligne secondaire optionnelle sous la barre. */
  caption?: string;
  /** Rend la ligne cliquable (navigation vers l'écran du pilier). */
  onPress?: () => void;
  animate?: boolean;
  delay?: number;
}

const TONE_COLOR: Record<MeterTone, string> = {
  gold: palette.gold,
  green: palette.green,
  heritage: palette.heritageGold,
  faint: palette.creamMute,
};

export function MeterBar({
  label,
  value,
  fillPct,
  tone = 'gold',
  caption,
  onPress,
  animate = true,
  delay = 0,
}: MeterBarProps) {
  const color = TONE_COLOR[tone];
  const pct = Math.max(0, Math.min(100, fillPct));

  const [trackW, setTrackW] = useState(0);
  const grow = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    const a = Animated.timing(grow, {
      toValue: 1,
      duration: motion.reveal,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // on anime une largeur (layout)
    });
    a.start();
    return () => a.stop();
  }, [animate, delay, grow]);

  const fillWidth = grow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (trackW * pct) / 100],
  });

  const body = (
    <View>
      <View style={styles.head}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.headRight}>
          {value ? <Text style={[styles.value, { color }]}>{value}</Text> : null}
          {onPress ? <Text style={styles.chevron}>›</Text> : null}
        </View>
      </View>

      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        />
      </View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={hitSlop}
        onPress={onPress}
        style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.7 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.wrap}>{body}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  headRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.faint,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: radius.pill,
    // halo discret (iOS) — la barre « émet » sa couleur sans virer à l'arcade
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: 7,
  },
});
