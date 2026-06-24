/**
 * Cockpit — petits primitifs de l'identité « cockpit » OXV, à greffer sur les
 * écrans bâtis avec le kit UI (AppBar/Card/Chip…) sans toucher au kit lui-même.
 *
 * - cockpitHalo : halo doré discret (donnée = chaleur), à étaler dans le `style`
 *   d'une Card ou d'un panneau.
 * - StatusLine  : « point de statut » — pastille or + libellé mono. Pose le
 *   contexte vivant de l'écran sous l'AppBar (compte, état), pas une décoration.
 *
 * Code couleur respecté : or = donnée / actif. Aucune prescription, aucun rouge
 * perf, jamais d'or Heritage ici.
 */

import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { theme } from '@/theme/v2';

/** Halo doré à étaler dans un `style` (Card, panneau). */
export const cockpitHalo: ViewStyle = {
  shadowColor: theme.palette.gold,
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

/** Pastille de statut dorée (6×6, halo). */
export function StatusDot() {
  return <View style={s.dot} />;
}

/** Ligne de statut : pastille or + libellé mono. Place le contexte de l'écran. */
export function StatusLine({ label }: { label: string }) {
  return (
    <View style={s.row} accessibilityRole="text">
      <View style={s.dot} />
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.85,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
});
