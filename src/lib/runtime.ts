/**
 * Détection du contexte d'exécution.
 *
 * Distingue Expo Go (preview rapide, pas de modules natifs custom)
 * des dev/preview/production builds (chaîne native complète).
 *
 * Utilisé pour skipper l'init des modules incompatibles Expo Go :
 *   - react-native-ble-plx (BLE RaceBox)
 *   - Push notifications remote (notifs locales OK)
 *   - Sentry (déjà guardé par __DEV__ + DSN)
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * `true` si l'app tourne dans Expo Go (l'app gratuite Apple/Android),
 * `false` si elle tourne dans un dev/preview/production build EAS.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * Label humain du runtime — utile pour les logs et les bannières debug.
 */
export function runtimeLabel(): string {
  switch (Constants.executionEnvironment) {
    case ExecutionEnvironment.StoreClient:
      return 'Expo Go';
    case ExecutionEnvironment.Standalone:
      return 'Build standalone';
    case ExecutionEnvironment.Bare:
      return 'Bare workflow';
    default:
      return 'Dev/preview build';
  }
}
