/**
 * Cockpit — petits primitifs de l'identité « cockpit » OXV, à greffer sur les
 * écrans bâtis avec le kit UI (AppBar/Card/Chip…) sans toucher au kit lui-même.
 *
 * - cockpitHalo : halo neutre discret, à étaler dans le `style` d'une Card ou
 *   d'un panneau. Aucun or décoratif (l'or est réservé au chrono/record V3).
 * - StatusLine  : « point de statut » — pastille neutre + libellé mono. Pose le
 *   contexte de l'écran sous l'AppBar (compte, état), pas une décoration.
 *
 * Code couleur V3 : l'or reste au chrono/record ; ces primitives de contexte
 * sont NEUTRES (crème). Aucune prescription, aucun rouge de marque sur une donnée.
 */

import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { theme } from '@/theme/v2';

/** Halo neutre à étaler dans un `style` (Card, panneau) — aucun or décoratif. */
export const cockpitHalo: ViewStyle = {
  shadowColor: theme.palette.creamMute,
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

/** Pastille de statut neutre (6×6, halo discret). */
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
    backgroundColor: theme.palette.creamMute,
    shadowColor: theme.palette.creamMute,
    shadowOpacity: 0.5,
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
