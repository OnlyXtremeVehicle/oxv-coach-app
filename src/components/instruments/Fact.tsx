/**
 * Fact — tuile de fait, version gaming (thème v2).
 *
 * Même rôle et même API que le `Fact.tsx` racine (legacy, tokens + Menlo), mais
 * au thème v2 : Geist Mono (« la voix de l'instrument »), palette OXV. Tuile
 * sobre — libellé mono en capitales + valeur en chiffres mono + note optionnelle.
 *
 * Doctrine : un fait, pas un verdict. Valeur en cream par défaut ; `accent`
 * passe la valeur en or (donnée mise en avant) avec un léger halo. Le chiffre
 * DOMINANT de l'écran reste l'affaire de `GaugeInstrument`, pas d'une tuile.
 *
 * Remplace `src/components/Fact.tsx` à la transposition (import depuis
 * `@/components/instruments`).
 */

import { StyleSheet, Text, View } from 'react-native';

import { fonts, fontSize, palette, radius, spacing } from '@/theme/v2';

export interface FactProps {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  /** Valeur en or (donnée mise en avant) plutôt qu'en cream. */
  accent?: boolean;
}

export function Fact({ label, value, unit, note, accent = false }: FactProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]}>
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: palette.faint,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 24,
    color: palette.cream,
    marginTop: spacing.xs,
  },
  valueAccent: {
    color: palette.gold,
    textShadowColor: 'rgba(255,183,3,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: palette.creamMute,
  },
  note: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: spacing.xs,
  },
});
