/**
 * Layout coach OXV — ADAPTATIF deux formats (décision fondateur 2026-07-13) :
 *   - TABLETTE (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : console §12 — rail
 *     vertical gauche 198px (Poste·File·Studio·Pilotes·Agenda·Business +
 *     avatar), contenu à droite.
 *   - TÉLÉPHONE : compagnon — onglets bas (En direct·Pilotes·Messages·
 *     Agenda·Moi), inchangé.
 * Le Stack reste identique dans les deux cas (zéro régression de navigation).
 *
 * Guard : redirige vers /(app) si le user n'est pas role='coach'.
 */

import { Redirect, Stack, usePathname } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';

import { CoachRail } from '@/components/CoachRail';
import { CoachTabBar } from '@/components/CoachTabBar';
import {
  COACH_CONSOLE_MIN_WIDTH,
  coachRailItemOfRoute,
  coachZoneOfRoute,
  shouldShowCoachTabBar,
} from '@/lib/coachNav';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function CoachLayout() {
  const profile = useAuthStore((s) => s.profile);
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  if (!profile) return null;
  if (profile.role !== 'coach') {
    return <Redirect href="/(app)" />;
  }

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.palette.night },
        animation: 'fade',
      }}
    />
  );

  // Console tablette : rail à gauche, contenu à droite.
  if (width >= COACH_CONSOLE_MIN_WIDTH) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.palette.night }}>
        <CoachRail activeItem={coachRailItemOfRoute(pathname)} />
        <View style={{ flex: 1 }}>{stack}</View>
      </View>
    );
  }

  // Compagnon téléphone : onglets bas (overlay au-dessus du Stack).
  const showTabBar = shouldShowCoachTabBar(pathname);
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.night }}>
      <View style={{ flex: 1 }}>{stack}</View>
      {showTabBar ? <CoachTabBar activeZone={coachZoneOfRoute(pathname)} /> : null}
    </View>
  );
}
