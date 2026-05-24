/**
 * Détection de l'état réseau.
 *
 * Source de vérité : @react-native-community/netinfo. Émet vers
 * useAppStateStore.setCondition('network', …) et useUIStore.setOfflineBannerVisible.
 *
 * Une fonction d'init unique branche les listeners au démarrage de l'app
 * (depuis app/_layout.tsx). Pas de hook React pour éviter les contextes
 * multiples et la dégradation du store.
 */

import NetInfo from '@react-native-community/netinfo';

import { useAppStateStore } from '@/store/useAppStateStore';
import { useUIStore } from '@/store/useUIStore';
import { flushQueue } from '@/services/offlineQueue';

let unsubscribe: (() => void) | null = null;
let wasOffline = false;

export function initNetInfo(): () => void {
  if (unsubscribe) return unsubscribe;

  unsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
    const appState = useAppStateStore.getState();
    const uiState = useUIStore.getState();

    appState.setCondition('network', online ? 'online' : 'offline');
    uiState.setOfflineBannerVisible(!online);

    // Si on revient en ligne après un offline, on vide la queue
    if (online && wasOffline) {
      flushQueue().catch((err) => {
        console.warn('[OXV] flushQueue après reconnexion :', err);
      });
    }
    wasOffline = !online;
  });

  // Lecture initiale (au cas où on démarre offline)
  NetInfo.fetch().then((state) => {
    const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
    useAppStateStore.getState().setCondition('network', online ? 'online' : 'offline');
    useUIStore.getState().setOfflineBannerVisible(!online);
    wasOffline = !online;
  });

  return unsubscribe;
}

export function teardownNetInfo(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
