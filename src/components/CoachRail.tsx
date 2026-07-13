/**
 * CoachRail — rail vertical de la CONSOLE TABLETTE coach (handoff §12, décision
 * fondateur 2026-07-13 : les deux formats coexistent — rail sur tablette,
 * onglets bas sur téléphone).
 *
 * Canon §12 : rail 198px, fond sombre, item actif en rouge coach #E23A4E
 * (barre d'accent gauche 2px + teinte), labels Hanken, logo OXV en tête,
 * avatar (initiales réelles) en bas → profil. Aucun or sur la nav.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Logo } from '@/brand/Logo';
import {
  COACH_RAIL_LABEL,
  COACH_RAIL_MAIN_ROUTE,
  COACH_RAIL_ORDER,
  type CoachRailItem,
} from '@/lib/coachNav';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

const { palette, fonts, spacing, radius } = theme;

export function CoachRail({ activeItem }: { activeItem: CoachRailItem | null }) {
  const profile = useAuthStore((s) => s.profile);
  const initials =
    [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() ||
    '·';
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  return (
    <View style={s.rail}>
      <View style={s.logoRow}>
        <Logo size={22} />
        <Text style={s.logoTxt}>OXV</Text>
      </View>

      <View style={{ gap: 2, marginTop: spacing.lg }}>
        {COACH_RAIL_ORDER.map((item) => {
          const on = activeItem === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={COACH_RAIL_LABEL[item]}
              onPress={() => router.navigate(COACH_RAIL_MAIN_ROUTE[item] as never)}
              style={({ pressed }) => [s.item, on && s.itemOn, pressed && { opacity: 0.8 }]}
            >
              <View style={[s.accent, on && { backgroundColor: palette.coachAccent }]} />
              <Text style={[s.itemTxt, on && s.itemTxtOn]}>{COACH_RAIL_LABEL[item]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* Avatar coach → compte pro (profil). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mon compte${name ? `, ${name}` : ''}`}
        onPress={() => router.navigate('/(coach)/profil' as never)}
        style={({ pressed }) => [s.me, pressed && { opacity: 0.8 }]}
      >
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
        {name ? (
          <Text numberOfLines={1} style={s.meName}>
            {name}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    width: 198,
    backgroundColor: palette.night,
    borderRightWidth: 1,
    borderRightColor: palette.line,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  logoTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 2,
    color: palette.cream,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: radius.sm,
    paddingRight: spacing.sm,
  },
  itemOn: { backgroundColor: 'rgba(226,58,78,0.10)' },
  accent: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 1,
    backgroundColor: 'transparent',
    marginRight: spacing.md,
    marginLeft: 2,
  },
  itemTxt: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.creamMute,
  },
  itemTxtOn: { color: palette.coachAccent },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 11, color: palette.cream },
  meName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.creamMute,
  },
});
