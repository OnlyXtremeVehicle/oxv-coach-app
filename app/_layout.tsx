import { useEffect } from 'react';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';

import { initBle, teardownBle } from '@/ble/initBle';
import { initFlic, teardownFlic } from '@/ble/initFlic';
import { BleErrorModal } from '@/components/BleErrorModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateModal } from '@/components/UpdateModal';
import { initGeolocation, teardownGeolocation } from '@/lib/initGeolocation';
import { initNetInfo, teardownNetInfo } from '@/lib/netinfo';
import { isExpoGo, runtimeLabel } from '@/lib/runtime';
import { initSentry } from '@/lib/sentry';
import { trackEvent } from '@/services/analyticsService';
import { registerForPushNotifications } from '@/services/pushNotificationsService';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppFonts } from '@/theme/fonts';
import { theme } from '@/theme/v2';

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {
  // SplashScreen peut être indisponible en mode dev client, on ignore.
});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const status = useAuthStore((s) => s.status);
  const profileId = useAuthStore((s) => s.profile?.id);
  const lastNotifResponse = Notifications.useLastNotificationResponse();
  const navState = useRootNavigationState();
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    console.warn(`[OXV] Runtime : ${runtimeLabel()}`);
    initialize();
    initNetInfo();
    // Mesure d'audience anonyme (§9) — no-op si non configurée ou opt-out.
    trackEvent('app_ouverte');
    if (!isExpoGo()) {
      // BLE et Flic 2 nécessitent des modules natifs custom indisponibles
      // dans Expo Go. En preview UI, on les skip — l'app reste navigable.
      initBle();
      initFlic();
    }
    initGeolocation().catch(() => undefined);
    return () => {
      teardownNetInfo();
      if (!isExpoGo()) {
        teardownBle();
        teardownFlic();
      }
      teardownGeolocation();
    };
  }, [initialize]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && status !== 'idle' && status !== 'loading') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status, fontsLoaded, fontError]);

  // Enregistre le token Expo Push après connexion réussie. Idempotent.
  // Skip en Expo Go (le token push remote n'y est pas généré, et l'app
  // tomberait sur une erreur silencieuse).
  useEffect(() => {
    if (isExpoGo()) return;
    if (status === 'authenticated' && profileId) {
      registerForPushNotifications(profileId).catch(() => undefined);
    }
  }, [status, profileId]);

  // Deep-link sur tap d'une notification : route vers l'écran ciblé.
  // On attend que le navigation state soit prêt pour éviter les races.
  useEffect(() => {
    if (!lastNotifResponse || !navState?.key) return;
    const data = lastNotifResponse.notification.request.content.data as
      | {
          type?: string;
          sessionId?: string | null;
          cornerIndex?: number;
          pilotId?: string;
          friendshipId?: string;
          friendId?: string;
          initiatorId?: string;
        }
      | undefined;
    if (data?.type === 'debrief' && data.sessionId) {
      router.push({
        pathname: '/(app)/debrief',
        params: { sessionId: data.sessionId },
      });
    } else if (data?.type === 'session_reminder') {
      router.push('/(app)');
    } else if (data?.type === 'media_ready' && data.sessionId) {
      // Médias OXV disponibles pour une séance → galerie de cette séance (PR-68).
      router.push({
        pathname: '/(app)/session-media/[sessionId]',
        params: { sessionId: data.sessionId },
      } as never);
    } else if (data?.type === 'coach_annotation' && data.cornerIndex) {
      // Note du coach : ouvrir le zoom virage concerné (avec sessionId si lié)
      router.push({
        pathname: '/(app)/virage',
        params: {
          index: String(data.cornerIndex),
          sessionId: data.sessionId ?? '',
        },
      });
    } else if (data?.type === 'session_analyzed' && data.pilotId) {
      // Côté coach : nouvelle session analysée pour un pilote suivi.
      // Ouvre le détail pilote — le coach voit la nouvelle session en
      // tête de liste et peut tap pour voir le bilan.
      router.push({
        pathname: '/(coach)/pilote/[id]',
        params: { id: data.pilotId },
      } as never);
    } else if (data?.type === 'coach_assigned') {
      // Pilote tape la notif "Un coach vous suit" → ouvre l'écran consentement
      router.push('/(app)/mon-coach' as never);
    } else if (data?.type === 'pilot_consented') {
      // Coach tape la notif "Un pilote a consenti" → ouvre son hub
      router.push('/(coach)' as never);
    } else if (data?.type === 'friend_request') {
      // Pilote tape la notif "X souhaite vous comparer" → ouvre la liste
      // d'amis pour qu'il puisse accepter/décliner la demande.
      router.push('/(app)/amis' as never);
    } else if (data?.type === 'friend_accepted' && data.friendId) {
      // Pilote tape la notif "X a accepté" → ouvre directement la vue
      // côte à côte pour qu'il puisse comparer avec son copain.
      router.push(`/(app)/cote-a-cote/${data.friendId}` as never);
    }
  }, [lastNotifResponse, navState?.key]);

  // Garde le splash tant que les polices V2 ne sont pas chargées (évite un
  // flash en police système avant bascule sur Geist / Geist Mono).
  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.palette.night }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.palette.night },
              animation: 'fade',
            }}
          />
          <OfflineBanner />
          <BleErrorModal />
          <UpdateModal />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
