/**
 * Politique de reconnexion BLE — logique PURE, sans dépendance React Native ni
 * accès au manager natif, donc vérifiable isolément (cf. reconnectPolicy.test.ts).
 *
 * Deux préoccupations, deux fonctions pures :
 *   1. le DÉLAI avant la prochaine tentative (backoff progressif plafonné) ;
 *   2. la DÉCISION d'abandonner selon le mode (borné vs illimité).
 *
 * Extraite de bluetoothService pour être testée sans instancier la radio.
 */

/**
 * Nombre de tentatives avant bascule en `lost` en mode BORNÉ (usages hors
 * capture : watchdog initBle / paddock). En mode illimité (capture armée), cette
 * borne est ignorée — cf. `shouldGiveUpReconnect`.
 */
export const RECONNECT_MAX_ATTEMPTS = 5;

/** Délai de base du backoff progressif (avant la toute première tentative). */
export const RECONNECT_BACKOFF_BASE_MS = 2_000;

/**
 * Plafond du backoff progressif : au-delà, on n'allonge plus le délai. Évite de
 * marteler la radio sur une coupure longue tout en gardant une cadence de reprise
 * raisonnable (au pire une tentative toutes les 30 s).
 */
export const RECONNECT_BACKOFF_MAX_MS = 30_000;

/**
 * Délai (ms) avant la prochaine tentative de reconnexion, pour un nombre de
 * tentatives DÉJÀ effectuées `attempt` (0 = rien tenté → délai de base).
 *
 * Croissance géométrique base × 2^attempt, PLAFONNÉE à RECONNECT_BACKOFF_MAX_MS :
 *   attempt 0 → 2 s · 1 → 4 s · 2 → 8 s · 3 → 16 s · 4+ → 30 s (plafond).
 *
 * Le plafond s'applique dans les DEUX modes (borné et illimité) : en illimité on
 * retente indéfiniment, mais jamais plus vite que le plafond.
 */
export function nextReconnectDelayMs(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const raw = RECONNECT_BACKOFF_BASE_MS * 2 ** safeAttempt;
  return Math.min(raw, RECONNECT_BACKOFF_MAX_MS);
}

/**
 * Faut-il ABANDONNER la reconnexion (bascule terminale `lost`) ?
 *
 *   - mode ILLIMITÉ (capture armée) : JAMAIS — on retente sans fin. La session
 *     reste ouverte ; seul le pilote (stop/abort) ou un timeout long la clôt.
 *   - mode BORNÉ (initBle / paddock) : après RECONNECT_MAX_ATTEMPTS tentatives.
 */
export function shouldGiveUpReconnect(attempt: number, unlimited: boolean): boolean {
  if (unlimited) return false;
  return attempt >= RECONNECT_MAX_ATTEMPTS;
}
