/**
 * RoleBadge — pastille d'identité de rôle (refonte NG, SPEC_BUILD).
 *
 * Point + libellé dans la couleur d'identité du rôle (jamais l'or, réservé à la
 * donnée). Sert à situer un utilisateur/espace : Pilote (neutre), Coach (rouge
 * de marque), Partenaire (bleu), Admin (cyan). Décision fondateur 2026-07-06 :
 * couleurs des maquettes Claude Design, source unique `roleColors` du thème.
 *
 * Ce n'est pas un statut d'état (voir StatusPill) : c'est QUI, pas OÙ.
 */

import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import type { RoleKey } from '@/theme/v2';

const { roleColors, palette, fonts, radius, spacing } = theme;

const DEFAULT_LABEL: Record<RoleKey, string> = {
  pilot: 'Pilote',
  coach: 'Coach',
  partner: 'Partenaire',
  admin: 'Admin',
};

export function RoleBadge({ role, label }: { role: RoleKey; label?: string }) {
  const color = roleColors[role];
  return (
    <View
      style={[s.badge, { borderColor: color }]}
      accessibilityRole="text"
      accessibilityLabel={`Rôle : ${label ?? DEFAULT_LABEL[role]}`}
    >
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.label, { color }]}>{label ?? DEFAULT_LABEL[role]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    backgroundColor: palette.card2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
