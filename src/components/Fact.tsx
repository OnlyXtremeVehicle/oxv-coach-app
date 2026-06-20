/**
 * Fact — « fait maître » porté du design oxv-mirror-app.
 *
 * Tuile sobre : libellé en capitales + valeur en chiffres mono (la « voix de
 * l'instrument ») + note neutre optionnelle. Utilise les design tokens OXV
 * (mêmes couleurs/typo que le reste de l'app). Composant d'affichage pur :
 * pas de Pressable, donc pas d'accessibilityRole requis.
 */

import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, fontSize, spacing } from '@/theme/tokens';

interface FactProps {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export function Fact({ label, value, unit, note }: FactProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.secondary,
  },
  label: {
    fontSize: fontSize.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.text.tertiary,
  },
  value: {
    fontFamily: 'Menlo',
    fontSize: 24,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  unit: {
    fontFamily: 'Menlo',
    fontSize: fontSize.caption,
    color: colors.text.tertiary,
  },
  note: {
    fontFamily: 'Menlo',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
