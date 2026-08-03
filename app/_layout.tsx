import { useEffect } from 'react';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';

import { initBle, teardownBle } from '@/ble/initBle';
import { initFlic, teardownFlic } from '@/ble/initFlic';
import { BleErrorModal } from '@/components/BleErrorModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateModal } from '@/components/UpdateModal';
import { initGeolocation, teardownGeolocation } from '@/lib/initGeolocation';
import { initEtatPilote, teardownEtatPilote } from '@/lib/initEtatPilote';
import { initNetInfo, teardownNetInfo } from '@/lib/netinfo';
import { isExpoGo, runtimeLabel } from '@/lib/runtime';
import { initSentry } from '@/lib/sentry';
import { trackEvent } from '@/services/analyticsService';
import { resumeUnsyncedCaptures } from '@/services/captureSyncQueue';
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
    // Reprend les captures non synchronisées d'un run précédent (crash / arrêt
    // hors-ligne) : draine la file de synchro si elle n'est pas vide. Silencieux,
    // non bloquant (silence en piste).
    void resumeUnsyncedCaptures();
    // Mesure d'audience anonyme (§9) — no-op si non configurée ou opt-out.
    trackEvent('app_ouverte');
    if (!isExpoGo()) {
      // BLE et Flic 2 nécessitent des modules natifs custom indisponibles
      // dans Expo Go. En preview UI, on les skip — l'app reste navigable.
      initBle();
      initFlic();
    }
    // `initGeolocation()` NE PART PLUS D'ICI — voir l'effet dédié plus bas.
    // Cet effet tourne au montage de la racine, donc pendant l'écran de
    // connexion, et la première chose que fait la géolocalisation est de lire
    // le circuit de référence. Or la policy de lecture des circuits est
    // réservée aux comptes authentifiés : la requête partait en anonyme et
    // revenait vide, sans erreur.
    // Réveille la machine d'état pilote : sans elle, `hasAccount` reste faux,
    // l'état ne quitte jamais S1, et le silence en piste ne s'arme jamais.
    initEtatPilote();
    return () => {
      teardownNetInfo();
      if (!isExpoGo()) {
        teardownBle();
        teardownFlic();
      }
      teardownGeolocation();
      teardownEtatPilote();
    };
  }, [initialize]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && status !== 'idle' && status !== 'loading') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status, fontsLoaded, fontError]);

  // Démarre la géolocalisation UNE FOIS LE PILOTE CONNECTÉ.
  //
  // Elle partait du montage de la racine, avant toute connexion. La lecture du
  // circuit de référence revenait alors vide — la policy `SELECT` de `circuits`
  // est `TO authenticated`, et la RLS filtre à zéro ligne sans lever d'erreur —
  // et `initGeolocation` refermait son verrou sur cet échec : la permission de
  // localisation n'était jamais demandée, et le suivi jamais démarré, de toute
  // la session. Le même appel anonyme empoisonnait au passage le cache des
  // circuits avec une liste vide, pour vingt-quatre heures.
  //
  // `initGeolocation` est idempotente : la rappeler après un aller-retour par
  // 'unauthenticated' ne redémarre rien qui tourne déjà.
  useEffect(() => {
    if (status !== 'authenticated') return;
    initGeolocation().catch(() => undefined);
  }, [status]);

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
    // Lot L6 — les notifications sont la seule porte d'entrée de l'app depuis
    // l'extérieur : elles visent l'arbre V2 depuis la bascule. Les écrans v1
    // debrief / session-media sont réunis dans /(app2)/bilan/[sessionId], qui
    // les sert en sections.
    if (data?.type === 'debrief' && data.sessionId) {
      router.push({
        pathname: '/(app2)/bilan/[sessionId]',
        params: { sessionId: data.sessionId },
      } as never);
    } else if (data?.type === 'session_reminder') {
      router.push('/(app2)' as never);
    } else if (data?.type === 'media_ready' && data.sessionId) {
      // Médias OXV disponibles → section SOUVENIRS du bilan de cette séance.
      router.push({
        pathname: '/(app2)/bilan/[sessionId]',
        params: { sessionId: data.sessionId },
      } as never);
    } else if (data?.type === 'coach_annotation' && data.cornerIndex) {
      // Note du coach sur un virage → la séance, OUVERTE SUR CE VIRAGE.
      //
      // Ce commentaire disait jusqu'au lot J5 : « LIMITE CONNUE : l'écran de
      // séance V2 n'accepte que l'identifiant de séance, pas d'ancre virage ».
      // L'ancre `?corner=` existe depuis, et cette notification était le seul
      // endroit de l'application qui porte un numéro de virage — elle le
      // jetait. Le pilote recevait « votre coach a annoté un virage » et
      // atterrissait en haut d'un écran de deux mille lignes.
      //
      // L'index est à base 1, comme `app_segment_analyses.segment_index` ;
      // l'écran ignore proprement une valeur hors liste.
      router.push(
        (data.sessionId
          ? `/(app2)/data/session/${data.sessionId}?corner=${String(data.cornerIndex)}`
          : '/(app2)/data') as never
      );
    } else if (data?.type === 'session_analyzed' && data.pilotId) {
      // Côté coach : nouvelle session analysée pour un pilote suivi.
      // Ouvre le détail pilote — le coach voit la nouvelle session en
      // tête de liste et peut tap pour voir le bilan.
      router.push({
        pathname: '/(coach)/pilote/[id]',
        params: { id: data.pilotId },
      } as never);
    } else if (data?.type === 'coach_assigned') {
      // Pilote tape la notif "Un coach vous suit" → onglet Mon coach, où se
      // règlent les consentements.
      router.push('/(app2)/club/coaching' as never);
    } else if (data?.type === 'pilot_consented') {
      // Coach tape la notif "Un pilote a consenti" → ouvre son hub
      router.push('/(coach)' as never);
    } else if (data?.type === 'friend_request') {
      // Pilote tape la notif "X souhaite vous comparer" → onglet Amis, pour
      // accepter ou décliner la demande.
      router.push('/(app2)/club/roulages?tab=amis' as never);
    } else if (data?.type === 'friend_accepted' && data.friendId) {
      // Pilote tape la notif "X a accepté" → la comparaison ouverte sur cet
      // ami (le comparateur V2 lit le paramètre `friend`).
      router.push(`/(app2)/data/comparer?friend=${data.friendId}` as never);
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
          <MaintenanceGate />
          {/*
            L'HÔTE DES MESSAGES — il manquait.

            VINGT-QUATRE fichiers appellent `Toast.show`, et aucun `<Toast />`
            n'était monté nulle part : chaque confirmation et chaque refus de
            l'application partait dans le vide, depuis toujours. Un pilote qui
            enregistrait son intention, un coach dont l'envoi échouait — aucun
            des deux ne voyait quoi que ce soit.

            Trouvé par la revue adversariale du 02/08/2026, en cherchant si les
            quatre phrases du marqueur s'affichaient. Elles ne s'affichaient pas,
            ni elles ni les autres.

            Monté EN DERNIER, donc au-dessus : un message doit passer par-dessus
            les bandeaux et les modales, sinon il se cache derrière ce qu'il
            commente.
          */}
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
