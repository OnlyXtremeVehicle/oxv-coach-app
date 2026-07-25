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
  /**
   * Libellé lu d'un seul tenant. À fournir quand la valeur passe par
   * `children` : la cellule ne connaît alors pas la valeur rendue et ne
   * regroupe pas (elle n'invente pas un libellé pour un chiffre qu'elle ne
   * lit pas).
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function StatCell({ label, value, children, style, accessibilityLabel }: StatCellProps) {
  // Regroupement : l'étiquette et le chiffre sont UNE donnée, lue d'un seul
  // tenant — sans quoi le lecteur d'écran énonce « Record » puis, au balayage
  // suivant, « 1:41.203 », le lien perdu. Absence dite « non mesuré », comme
  // PillarBar et Dial (le « — » de l'écran n'est pas un mot).
  const absent = value === undefined || value === '—';
  const groupedLabel =
    accessibilityLabel ??
    (children !== undefined ? undefined : `${label} : ${absent ? 'non mesuré' : value}`);

  return (
    <View style={style} accessible={groupedLabel !== undefined} accessibilityLabel={groupedLabel}>
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
