/**
 * Layout pilote professionnel — espace réservé aux comptes `role='pro_pilot'`.
 *
 * Guard strict : redirige vers /(app) si le user n'est pas pilote pro. Le pilote
 * pro est un pilote (mêmes données, mêmes RLS own-row) avec un espace distinct
 * et des outils renforcés. Les écrans data restent partagés avec l'espace pilote.
 *
 * Barre d'onglets pro (PR-78) posée AU-DESSUS du Stack — qui reste inchangé. Five
 * onglets métier (Paddock · Performance · Média · Équipe · Partage) ; Compte reste
 * une icône (jamais un onglet). Masquée hors des racines d'onglet.
 */

import { Redirect, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { ProTabBar } from '@/components/ProTabBar';
import { proZoneOfRoute, shouldShowProTabBar } from '@/lib/proNav';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function ProPilotLayout() {
  const profile = useAuthStore((s) => s.profile);
  const pathname = usePathname();

  if (!profile) return null;
  if (profile.role !== 'pro_pilot') {
    return <Redirect href={'/(app2)' as never} />;
  }

  const showTabBar = shouldShowProTabBar(pathname);

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
      {showTabBar ? <ProTabBar activeZone={proZoneOfRoute(pathname)} /> : null}
    </View>
  );
}
