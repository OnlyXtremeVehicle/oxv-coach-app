import { Redirect, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { AppTabBar } from '@/components/AppTabBar';
import { shouldShowTabBar, zoneOfRoute } from '@/lib/appMap';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  const pilotState = useAppStateStore((s) => s.state);
  const pathname = usePathname();

  // Si la session expire en cours d'usage, le store passe automatiquement en
  // 'unauthenticated' via onAuthStateChange → on renvoie au login.
  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  // Barre d'onglets 5 zones (PR 1) posée AU-DESSUS du Stack — qui reste
  // inchangé (zéro régression de navigation). Layout en colonne flex : le Stack
  // s'insère naturellement au-dessus de la barre. Masquée en piste / flux
  // capture (silence en piste). Compte n'est PAS un onglet (icône haut-droite).
  const showTabBar = shouldShowTabBar(pathname, pilotState);

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
      {showTabBar ? <AppTabBar activeZone={zoneOfRoute(pathname)} /> : null}
    </View>
  );
}
