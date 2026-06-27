/**
 * EmptyState — état d'attente honnête, version gaming (thème v2).
 *
 * Quand un module n'a pas encore de donnée réelle (télémétrie absente, champ
 * vide), l'app le DIT — elle n'invente jamais un chiffre. Ce primitif factorise
 * les nombreux `EmptyState` redéfinis écran par écran.
 *
 * Honnêteté : `source` affiche le nom du champ attendu (ex. « gg_envelope »),
 * pour que l'attente soit traçable plutôt que vague.
 *
 * Usage :
 *   <EmptyState message="La carte G-G apparaîtra après votre premier roulage." source="gg_envelope" />
 */

import { StyleSheet, Text, View } from 'react-native';

import { fonts, fontSize, palette, radius, spacing } from '@/theme/v2';

export interface EmptyStateProps {
  /** Eyebrow mono. Défaut « EN ATTENTE ». */
  label?: string;
  /** Message factuel expliquant l'attente. */
  message: string;
  /** Champ de données attendu (honnêteté). Affiché discrètement. */
  source?: string | null;
}

export function EmptyState({ label = 'En attente', message, source = null }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.message}>{message}</Text>
      {source ? <Text style={styles.source}>champ · {source}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.faint,
    marginBottom: 8,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: palette.creamMute,
    textAlign: 'center',
  },
  source: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: spacing.sm,
  },
});
