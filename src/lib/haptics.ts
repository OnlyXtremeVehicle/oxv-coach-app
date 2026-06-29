/**
 * Feedback haptique discret — sobriété OXV.
 *
 * Vibration brève sur les actions confirmées (CTA primaire, démarrage
 * session, etc.). Le pilote OXV n'attend pas une expérience "ludique"
 * façon jeu mobile : c'est un retour tactile minimal qui confirme
 * l'action sans la dramatiser.
 *
 * Skip propre en Expo Go et sur émulateur. Best-effort partout : si
 * l'API Haptics n'est pas dispo, on no-op silencieusement plutôt que
 * de logger ou crasher.
 */

import * as Haptics from 'expo-haptics';

import { isExpoGo } from './runtime';
import { isSilenced } from './silence';

/**
 * Coupe-circuit commun. En piste (`S6_roulage`), AUCUNE vibration ne se
 * déclenche, où qu'elle soit appelée (BLE perdu, fin de run…) — silence en
 * piste, Principe 3. Hors piste, on no-op aussi sous Expo Go.
 */
function muted(): boolean {
  return isSilenced() || isExpoGo();
}

/** Tap léger — pour les actions secondaires (toggle, nav). */
export function tap(): void {
  if (muted()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Confirmation — pour les CTA primaires (Découvrir, Démarrer, Continuer). */
export function confirm(): void {
  if (muted()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Réussite — pour les transitions de jalons (fin de session OK, etc.). */
export function success(): void {
  if (muted()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Alerte — pour les modals d'erreur (BLE lost, etc.). */
export function warning(): void {
  if (muted()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}
