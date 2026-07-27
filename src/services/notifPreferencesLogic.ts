/**
 * Préférences de notification fines (D5, charte 13 — design honnête).
 *
 * Stockées dans `users.notification_preferences` (JSONB déjà en base) — pas de
 * nouvelle colonne. Deux canaux que l'app programme RÉELLEMENT :
 *   - `debrief`  : la notification « votre debrief est prêt » (J+1)
 *   - `reminder` : la notification « la veille de votre session »
 *
 * Doctrine : un réglage ne contrôle que ce qui existe vraiment (pas de canal
 * fantôme). Absent = actif (défaut-ON), sous le maître `push_notif_enabled`.
 *
 * Pur (sans React Native ni Supabase) → testable sous ts-jest.
 */

import type { PilotState } from '@/types/state';

export type NotifChannel = 'debrief' | 'reminder';

/** Comportement d'affichage d'une notif reçue au premier plan. */
export interface NotifForegroundBehavior {
  /**
   * @deprecated depuis expo-notifications 0.29 (SDK 53), qui a scindé l'alerte
   * en bannière et liste. Conservé parce qu'il reste lu par les runtimes plus
   * anciens : le retirer rendrait le silence en piste moins étanche sur un
   * appareil qui n'a pas encore la nouvelle interface.
   */
  shouldShowAlert: boolean;
  /** Bannière transitoire en haut de l'écran. */
  shouldShowBanner: boolean;
  /** Entrée persistante dans le centre de notifications. */
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
}

/**
 * Principe 3 — **silence en piste**. Pendant le roulage (`S6_roulage`, véhicule
 * en mouvement), une notification reçue au premier plan ne s'affiche pas, ne
 * joue aucun son et ne pose aucun badge — y compris un push distant (coach,
 * ami). Hors roulage : bannière sans son (sobriété). C'est le garde-fou que le
 * handler ne tenait pas (il affichait tout, sans consulter l'état pilote).
 */
export function notificationBehaviorForState(state: PilotState): NotifForegroundBehavior {
  const driving = state === 'S6_roulage';
  // Les trois surfaces d'affichage suivent le MÊME interrupteur. Le SDK 53 a
  // scindé l'alerte en bannière et liste : en laisser une seule à `true` en
  // piste rouvrirait le silence par la porte de derrière — la notification ne
  // s'afficherait plus en bannière, mais atterrirait dans le centre.
  return {
    shouldShowAlert: !driving,
    shouldShowBanner: !driving,
    shouldShowList: !driving,
    shouldPlaySound: false,
    shouldSetBadge: !driving,
  };
}

/** Lit l'état d'un canal depuis le JSONB brut. Absent/non-bool → actif (défaut-ON). */
export function readNotifPref(raw: unknown, channel: NotifChannel): boolean {
  if (!raw || typeof raw !== 'object') return true;
  return (raw as Record<string, unknown>)[channel] !== false;
}

/**
 * Renvoie un nouvel objet de préférences avec `channel` positionné à `value`,
 * en PRÉSERVANT toutes les autres clés déjà présentes (le site peut en stocker).
 */
export function writeNotifPref(
  raw: unknown,
  channel: NotifChannel,
  value: boolean
): Record<string, unknown> {
  const base = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  base[channel] = value;
  return base;
}
