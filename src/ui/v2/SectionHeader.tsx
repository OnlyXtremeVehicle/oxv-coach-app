/**
 * SectionHeader — tête de section (app2) : eyebrow mono capitales espacées,
 * titre optionnel, compteur optionnel en pill hairline (« 3 »).
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space, type as typo } from './tokens';

export interface SectionHeaderProps {
  /** Sur-titre mono, rendu en capitales. */
  eyebrow: string;
  title?: string;
  /** Compteur en pill hairline à droite (« 3 »). */
  count?: number;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ eyebrow, title, count, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      <View style={styles.left}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {title !== undefined ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      {count !== undefined ? (
        <View style={styles.countPill}>
          <Text style={styles.countLabel}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexShrink: 1,
  },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  title: {
    fontFamily: typo.bodySemi,
    fontSize: 17,
    color: colors.text.hi,
    marginTop: space.xs,
  },
  countPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    minWidth: 24,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  countLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.mid,
    fontVariant: ['tabular-nums'],
  },
});
