/**
 * StatCell — cellule de statistique : label eyebrow mono capitales + valeur
 * mono tabulaire. La valeur accepte un slot (`children`, ex. RollingCounter)
 * qui prime sur la prop `value`.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, space, type as typo } from './tokens';

export interface StatCellProps {
  /** Label eyebrow, rendu en capitales. */
  label: string;
  /** Valeur mono. Ignorée si `children` est fourni. */
  value?: string;
  /** Slot valeur (ex. RollingCounter) — prime sur `value`. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function StatCell({ label, value, children, style }: StatCellProps) {
  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      {children !== undefined ? (
        children
      ) : (
        <Text style={styles.value} numberOfLines={1}>
          {value ?? '—'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.xs,
  },
  value: {
    fontFamily: typo.monoSemi,
    fontSize: 22,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
});
