/**
 * Service push notifications — sem 13 J3.
 *
 * Stratégie V1 :
 *   - Notifications LOCALES côté device pour le debrief J+1 et la veille
 *     de session. Pas de dépendance serveur, pas de coût.
 *   - On enregistre quand même le token Expo Push en base (`users.expo_push_token`)
 *     pour préparer V1.1 (Edge Function qui pushe à distance pour les
 *     pilotes qui n'ouvriront pas l'app entre temps).
 *
 * Contraintes doctrinales :
 *   - **Silence en piste** : aucune notif programmée pendant un état
 *     S5-S8 (roulage). C'est l'appelant qui décide ; le service ne sait
 *     pas l'état pilote.
 *   - **Ton** : titre court + corps factuel, jamais directif.
 *   - **Opt-in** : si `users.push_notif_enabled = false`, aucune notif
 *     n'est programmée. Le pilote peut couper depuis #24 Settings.
 *
 * Deep-linking : à la réception, on route vers `/debrief?sessionId=xxx`
 * (le router expo-router lit la query). Câblé dans `app/_layout.tsx`
 * via `useLastNotificationResponse`.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { type NotifChannel, readNotifPref } from '@/services/notifPreferencesLogic';

// Configuration globale du handler — comment réagir quand une notif arrive
// alors que l'app est au premier plan. V1 : on AFFICHE la bannière, mais
// sans son (doctrine sobriété).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const DEBRIEF_CHANNEL_ID = 'debrief';
const SESSION_REMINDER_CHANNEL_ID = 'session_reminder';

// ============================================================================
// Permission + enregistrement du token Expo Push
// ============================================================================

export interface RegisterResult {
  granted: boolean;
  token: string | null;
  reason?: string;
}

/**
 * Demande la permission, récupère le token Expo Push, le persiste en DB.
 * Idempotent : un re-appel ne fait rien de plus si le token est inchangé.
 *
 * À appeler après la connexion réussie (depuis `app/_layout.tsx` ou un
 * effet dans le hub `(app)/`), une seule fois par session app.
 */
export async function registerForPushNotifications(userId: string): Promise<RegisterResult> {
  if (!Device.isDevice) {
    return { granted: false, token: null, reason: 'Émulateur — push indisponible.' };
  }

  // Crée les canaux Android (ignoré sur iOS)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEBRIEF_CHANNEL_ID, {
      name: 'Debrief J+1',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
    });
    await Notifications.setNotificationChannelAsync(SESSION_REMINDER_CHANNEL_ID, {
      name: 'Veille de session',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
    });
  }

  // Vérifie permission existante, sinon demande
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync();
    status = ask.status;
  }
  if (status !== 'granted') {
    return { granted: false, token: null, reason: 'Permission refusée par l’utilisateur.' };
  }

  // Récupère le token Expo Push
  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    token = result.data;
  } catch (e) {
    return { granted: true, token: null, reason: `Récupération token KO : ${errMsg(e)}` };
  }

  // Persiste en DB seulement si différent du token actuel
  const { data: current } = await supabase
    .from('users')
    .select('expo_push_token')
    .eq('id', userId)
    .maybeSingle();
  const currentToken = (current as { expo_push_token?: string | null } | null)?.expo_push_token;

  if (currentToken !== token) {
    const { error } = await supabase
      .from('users')
      .update({
        expo_push_token: token,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) {
      return { granted: true, token, reason: `Persist KO : ${error.message}` };
    }
  }

  return { granted: true, token };
}

// ============================================================================
// Notifications locales
// ============================================================================

export interface ScheduleDebriefInput {
  userId: string;
  sessionId: string;
  /** Délai en millisecondes avant le déclenchement. Par défaut 24 h. */
  delayMs?: number;
}

/**
 * Programme une notification locale "Votre debrief est prêt" pour J+1.
 *
 * Best-effort : si l'utilisateur a coupé les notifs OXV (`push_notif_enabled
 * = false`), on ne fait rien. Si la permission système est refusée, idem.
 *
 * Retourne l'identifiant de la notif programmée (utile pour annulation), ou
 * null si pas planifiée.
 */
export async function scheduleDebriefNotification(
  input: ScheduleDebriefInput
): Promise<string | null> {
  const enabled = await isChannelEnabled(input.userId, 'debrief');
  if (!enabled) return null;

  const delayMs = input.delayMs ?? 24 * 60 * 60 * 1000;
  const triggerSeconds = Math.max(60, Math.floor(delayMs / 1000));

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Votre debrief est prêt.',
        body: 'Une lecture posée vous attend, quand vous le souhaitez.',
        data: { type: 'debrief', sessionId: input.sessionId },
      },
      trigger: {
        seconds: triggerSeconds,
        channelId: DEBRIEF_CHANNEL_ID,
      },
    });
    return id;
  } catch (e) {
    console.warn('[OXV] scheduleDebriefNotification KO :', errMsg(e));
    return null;
  }
}

export interface ScheduleSessionReminderInput {
  userId: string;
  sessionOxvId: string;
  /** Date/heure du début de la session OXV. */
  sessionAt: Date;
  /** Combien d'heures avant prévenir. Par défaut 18 h. */
  hoursBefore?: number;
}

/**
 * Programme une notification locale "La veille de votre session" en
 * amont d'une session OXV inscrite.
 */
export async function scheduleSessionReminder(
  input: ScheduleSessionReminderInput
): Promise<string | null> {
  const enabled = await isChannelEnabled(input.userId, 'reminder');
  if (!enabled) return null;

  const hoursBefore = input.hoursBefore ?? 18;
  const trigger = new Date(input.sessionAt.getTime() - hoursBefore * 60 * 60 * 1000);
  const delayMs = trigger.getTime() - Date.now();
  if (delayMs <= 0) return null; // déjà passé, on ne programme pas

  const triggerSeconds = Math.floor(delayMs / 1000);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Demain, vous roulez.',
        body: 'Vérifiez votre équipement à tête reposée. L’app sera prête.',
        data: { type: 'session_reminder', sessionOxvId: input.sessionOxvId },
      },
      trigger: {
        seconds: triggerSeconds,
        channelId: SESSION_REMINDER_CHANNEL_ID,
      },
    });
    return id;
  } catch (e) {
    console.warn('[OXV] scheduleSessionReminder KO :', errMsg(e));
    return null;
  }
}

/**
 * Annule toutes les notifications locales OXV programmées. Utile à la
 * déconnexion ou si le pilote coupe l'opt-in dans #24 Settings.
 */
export async function cancelAllOxvNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[OXV] cancelAllOxvNotifications KO :', errMsg(e));
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Un canal de notification est-il actif pour ce pilote ?
 * Maître `push_notif_enabled` (opt-in global) ET préférence fine par canal (D5,
 * stockée dans notification_preferences). Défaut-ON si non renseigné.
 */
async function isChannelEnabled(userId: string, channel: NotifChannel): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('push_notif_enabled, notification_preferences')
    .eq('id', userId)
    .maybeSingle();
  const row = data as {
    push_notif_enabled?: boolean | null;
    notification_preferences?: unknown;
  } | null;
  if (row?.push_notif_enabled === false) return false;
  return readNotifPref(row?.notification_preferences, channel);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
