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
import { ProfilIndisponible } from '@/components/ProfilIndisponible';
import { theme } from '@/theme/v2';

export default function CoachLayout() {
  const profile = useAuthStore((s) => s.profile);
  const status = useAuthStore((s) => s.status);
  const profilIndisponible = useAuthStore((s) => s.profilIndisponible);
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  // Déconnexion : `profile` retombe à null et ce layout ne rendait plus rien —
  // écran noir définitif, sans porte de sortie. Rien ne renavigue tout seul
  // quand la route courante est /(coach). Cette garde doit passer AVANT
  // `profilIndisponible` : après un signOut, l'état repart de `initialState`,
  // où le drapeau est faux ; c'est `status` qui dit la vérité.
  if (status === 'unauthenticated') {
    return <Redirect href={'/(auth)/login' as never} />;
  }

  // `return null` rendait un écran NOIR, sans un mot, aussi bien pour une fiche
  // absente que pour une lecture ratée. Le coach ne pouvait rien en faire.
  if (profilIndisponible) return <ProfilIndisponible />;
  if (!profile) return null;
  if (profile.role !== 'coach') {
    return <Redirect href={'/(app2)' as never} />;
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
