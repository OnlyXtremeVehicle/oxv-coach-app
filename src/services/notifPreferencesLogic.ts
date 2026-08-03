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
 * Principe 3 — silence en piste, **AU PREMIER PLAN SEULEMENT**.
 *
 * Pendant le roulage (`S6_roulage`, véhicule en mouvement), une notification
 * reçue ALORS QUE L'APPLICATION EST OUVERTE ET AU PREMIER PLAN ne s'affiche
 * pas, ne joue aucun son et ne pose aucun badge. Hors roulage : bannière sans
 * son (sobriété).
 *
 * ---
 *
 * CE COMMENTAIRE AFFIRMAIT « Y COMPRIS UN PUSH DISTANT (COACH, AMI) ». C'EST
 * FAUX, ET C'ÉTAIT LE PLUS GRAVE DES MENSONGES DE CE DÉPÔT.
 *
 * Cette fonction alimente `setNotificationHandler` : elle décide de la
 * PRÉSENTATION AU PREMIER PLAN, rien d'autre. Sur un téléphone verrouillé, dans
 * une poche, pendant que le pilote roule, iOS rend la notification à partir de
 * la CHARGE UTILE envoyée par le serveur. Ce code n'est jamais consulté.
 *
 * Et aucune des fonctions serveur ne regarde l'état du pilote — vérifié le
 * 03/08/2026, zéro occurrence de `silence`, `recording` ou `roulage` dans les
 * sept fonctions `notify-*`. Trois d'entre elles, destinées au PILOTE, portent
 * `sound: 'default'` : `notify-pilot-coach-annotated`,
 * `notify-pilot-friend-request`, `notify-pilot-friend-accepted`.
 *
 * Un pilote en piste, téléphone en poche, reçoit donc aujourd'hui une bannière
 * ET un son quand son coach annote un virage.
 *
 * ---
 *
 * CE QU'IL FAUDRAIT POUR L'ARMER VRAIMENT
 *
 * Que le SERVEUR sache que le pilote roule. L'état ne vit qu'en mémoire de
 * l'appareil (`src/lib/silence.ts`, drapeau de module ; `useAppStateStore`).
 * Il faudrait publier une fenêtre de roulage côté base et la faire lire par les
 * sept fonctions avant tout envoi — donc une modification de schéma, qui
 * demande l'accord du fondateur.
 *
 * Tant que ce n'est pas fait, cette fonction reste utile — elle couvre le cas
 * où l'application est ouverte — mais elle ne tient PAS la promesse du
 * Principe 3. Relevé par la préparation des capacités iOS du 03/08/2026.
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
