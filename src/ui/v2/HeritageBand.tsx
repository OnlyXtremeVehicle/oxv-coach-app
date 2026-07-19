/**
 * HeritageBand — bande du tier Heritage (lot L0, livrable 7).
 *
 * Un label en capitales (display) + un TRAIT or `heritage.gold` dont la
 * lumière est `heritage.glow` en OMBRE DU TRAIT uniquement (GlowStroke
 * Skia, deux passes) — jamais un fond doré, jamais un chrome générique :
 * l'or reste exclusif au tier Heritage.
 *
 * Contenu libre en dessous via `children`. Statique : la bande signe, elle
 * ne s'anime pas.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';

import { GlowStroke } from './motion/GlowStroke';
import { colors, radius, space, type as typo } from './tokens';

export interface HeritageBandProps {
  /** Libellé de la bande. Défaut 'HERITAGE'. */
  label?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Hauteur du ruban Skia : le trait 2 px + la place de sa lumière (blur 6). */
const RULE_HEIGHT = 14;

export function HeritageBand({ label = 'HERITAGE', children, style }: HeritageBandProps) {
  const [ruleWidth, setRuleWidth] = useState(0);

  return (
    <View style={[styles.band, style]} accessible accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.rule} onLayout={(event) => setRuleWidth(event.nativeEvent.layout.width)}>
        {ruleWidth > 0 ? (
          <Canvas style={{ width: ruleWidth, height: RULE_HEIGHT }}>
            <GlowStroke
              path={`M 1 ${RULE_HEIGHT / 2} L ${ruleWidth - 1} ${RULE_HEIGHT / 2}`}
              color={colors.heritage.gold}
              glowColor={colors.heritage.glow}
              strokeWidth={2}
              glowRadius={6}
            />
          </Canvas>
        ) : null}
      </View>

      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  label: {
    fontFamily: typo.display,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.heritage.text,
  },
  rule: {
    height: RULE_HEIGHT,
    marginTop: space.sm,
  },
  content: {
    marginTop: space.md,
  },
});
