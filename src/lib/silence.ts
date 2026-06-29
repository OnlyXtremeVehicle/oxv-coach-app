/**
 * Silence en piste (Principe 3, non négociable) — drapeau runtime central.
 *
 * Pendant le roulage (`S6_roulage`), l'app dort : aucun écran, aucune notif,
 * aucun son, AUCUNE vibration. Ce module porte un drapeau lu par les primitives
 * de bas niveau (haptique) pour qu'aucune ne se déclenche en piste, où qu'elle
 * soit appelée. Le drapeau est posé par la state machine (`useAppStateStore`)
 * à chaque recalcul d'état.
 *
 * Feuille volontairement SANS dépendance : tout module peut l'importer sans
 * risque de cycle (notamment `@/lib/haptics`).
 */

let silenced = false;

/** Pose le mode silence (vrai en S6_roulage). Appelé par la state machine. */
export function setSilenceMode(value: boolean): void {
  silenced = value;
}

/** Sommes-nous en piste, équipement à l'écoute, app muette ? */
export function isSilenced(): boolean {
  return silenced;
}
