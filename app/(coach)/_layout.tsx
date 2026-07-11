/**
 * Layout coach OXV — section bleu nuit réservée aux coachs.
 *
 * Guard : redirige vers /(app) si le user n'est pas role='coach'.
 * Les sous-routes portent un accent distinct pour repérer visuellement
 * la section coach.
 */

import { Redirect, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { CoachTabBar } from '@/components/CoachTabBar';
import { coachZoneOfRoute, shouldShowCoachTabBar } from '@/lib/coachNav';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function CoachLayout() {
  const profile = useAuthStore((s) => s.profile);
  const pathname = usePathname();

  if (!profile) return null;
  if (profile.role !== 'coach') {
    return <Redirect href="/(app)" />;
  }

  // Barre d'onglets 5 zones (cadrage COACH §1) posée AU-DESSUS du Stack — qui
  // reste inchangé (zéro régression de navigation). Identité coach (rouge doux).
  const showTabBar = shouldShowCoachTabBar(pathname);

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.night }}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.palette.night },
            animation: 'fade',
          }}
        />
      </View>
      {showTabBar ? <CoachTabBar activeZone={coachZoneOfRoute(pathname)} /> : null}
    </View>
  );
}
