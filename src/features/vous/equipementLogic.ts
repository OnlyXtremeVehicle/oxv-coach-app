/**
 * equipementLogic — logique PURE de l'écran Équipement (V2-L4, porte VOUS, 5/8).
 *
 * NE PAS confondre avec `src/features/rec/equipementLogic.ts` (flux de capture
 * BLE : scan, ordre des boîtiers, phase d'écran). ICI c'est l'écran d'ÉTAT de
 * l'équipement du pilote (boîtier affecté, ceinture, Apple Watch) — pas de scan.
 * Les helpers batterie (`clampBatteryLevel`) sont RÉUTILISÉS depuis le module rec
 * (pas de duplication).
 *
 * Décisions couvertes :
 *   - la lecture de la BATTERIE depuis l'état textuel du boîtier (device_health) ;
 *   - la PASTILLE d'état du boîtier (bon / à vérifier / inconnu) — tonale, jamais
 *     rouge : le SEUL accent de l'écran est l'arc du cadran batterie (UN accent
 *     par zone) ;
 *   - la GARDE Apple Watch fail-closed (consentement biométrie + drapeau + iOS) :
 *     la demande d'autorisation HealthKit n'a lieu QUE si les trois conditions
 *     sont réunies, sinon on renvoie vers les Réglages consentements.
 *
 * Aucune dépendance React / react-native native : testé sous ts-jest/node
 * (src/features/vous/__tests__/equipementLogic.test.ts).
 */

import { clampBatteryLevel } from '@/features/rec/equipementLogic';

// ---------------------------------------------------------------------------
// Batterie du boîtier — depuis l'état textuel de device_health
// ---------------------------------------------------------------------------

/**
 * Niveau de batterie (0..100) lu dans l'état textuel du boîtier
 * (`devices.battery_status` / `device_health_logs.battery_status`), qui peut
 * valoir « 85 », « 85% », « low », « ok »… Renvoie null si aucune valeur
 * chiffrée n'est présente — le cadran affiche alors « — » (jamais un 0 fabriqué).
 */
export function parseBatteryPercent(status: string | null | undefined): number | null {
  if (status == null) return null;
  const match = /-?\d+(?:\.\d+)?/.exec(status);
  if (!match) return null;
  return clampBatteryLevel(Number(match[0]));
}

// ---------------------------------------------------------------------------
// Pastille d'état — tonale (jamais rouge : l'accent unique = l'arc du cadran)
// ---------------------------------------------------------------------------

export type DevicePastille = 'ok' | 'attention' | 'unknown';

const OK_WORDS = ['ok', 'good', 'healthy', 'connected', 'nominal', 'bon'];
const WARN_WORDS = ['low', 'warn', 'warning', 'error', 'degraded', 'critical', 'fault', 'faible'];

/**
 * Pastille d'état du boîtier dérivée de `health_status`. Absent / vide / inconnu
 * → 'unknown' (jamais un « bon » affirmé sans donnée). Correspondance
 * insensible à la casse, par mot contenu.
 */
export function devicePastille(healthStatus: string | null | undefined): DevicePastille {
  if (healthStatus == null) return 'unknown';
  const s = healthStatus.trim().toLowerCase();
  if (s === '') return 'unknown';
  if (OK_WORDS.some((w) => s.includes(w))) return 'ok';
  if (WARN_WORDS.some((w) => s.includes(w))) return 'attention';
  return 'unknown';
}

/** Libellé factuel de l'état du boîtier (jamais prescriptif). */
export function deviceHealthLabel(healthStatus: string | null | undefined): string {
  switch (devicePastille(healthStatus)) {
    case 'ok':
      return 'Bon état';
    case 'attention':
      return 'À vérifier';
    default:
      return 'État inconnu';
  }
}

// ---------------------------------------------------------------------------
// Apple Watch — statut HealthKit + garde d'autorisation (consent + flag + iOS)
// ---------------------------------------------------------------------------

/**
 * Statut d'autorisation santé côté écran. 'idle' = pas encore demandée ; les
 * trois autres reprennent `HealthAuthStatus` du healthKitService.
 */
export type WatchAuthStatus = 'idle' | 'granted' | 'denied' | 'unavailable';

export function watchStatusLabel(status: WatchAuthStatus): string {
  switch (status) {
    case 'granted':
      return 'Autorisée';
    case 'denied':
      return 'Refusée';
    case 'unavailable':
      return 'Indisponible sur cet appareil';
    case 'idle':
    default:
      return 'Non demandée';
  }
}

/** Le bouton « Autoriser » a-t-il un sens à cet état ? (masqué si déjà accordée / indisponible.) */
export function watchShowAuthorizeButton(status: WatchAuthStatus): boolean {
  return status !== 'granted' && status !== 'unavailable';
}

/** La carte Apple Watch n'existe que sur iOS (HealthKit iOS-only). Android : absente. */
export function watchCardVisible(isIOS: boolean): boolean {
  return isIOS === true;
}

export interface WatchGateInput {
  /** Plateforme iOS ? (HealthKit iOS-only.) */
  isIOS: boolean;
  /** Drapeau serveur `biometry` activé ? (fail-closed : défaut false.) */
  biometryFlagOn: boolean;
  /** Consentement de CAPTURE cardio accordé ? (loadBiometryConsents.capture) */
  captureConsent: boolean;
}

/**
 * Peut-on réellement demander l'autorisation HealthKit ? Fail-closed : OUI
 * uniquement si les trois conditions sont réunies (iOS + drapeau biométrie +
 * consentement de capture). Sinon la pression « Autoriser » renvoie le pilote
 * vers les Réglages consentements (on ne touche pas au cardio sans consentement).
 * Chaque booléen manquant est déjà false côté appelant → jamais ouvert par accident.
 */
export function canRequestHealthAuth(input: WatchGateInput): boolean {
  return input.isIOS === true && input.biometryFlagOn === true && input.captureConsent === true;
}
