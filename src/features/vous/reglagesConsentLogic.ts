/**
 * Logique PURE des consentements des Réglages (lot V2-L4, mission D).
 *
 * Un seul objet ici : l'invariant biométrie « partage ⇒ capture », côté UI.
 * Le garde-fou FAISANT FOI vit dans le service (consentService : révoquer la
 * capture révoque le partage ; activer le partage active la capture). Ce module
 * en est le miroir pur, pour calculer l'état optimiste de l'écran AVANT le
 * retour réseau et pour se tester sans Supabase (ts-jest node).
 *
 * Ton OXV : vouvoiement, sec, sans emoji.
 */

export interface BiometryState {
  /** Capter le rythme cardiaque en séance. */
  capture: boolean;
  /** Partager ce cardio avec le coach binôme. */
  coachShare: boolean;
}

export type BiometryToggle = { which: 'capture' | 'coachShare'; value: boolean };

/**
 * Prochain état des consentements biométrie après une bascule, en maintenant
 * l'invariant « coachShare ⇒ capture » dans les deux sens :
 *   - révoquer la capture révoque le partage (on ne partage pas un cardio qu'on
 *     ne capte plus) ;
 *   - activer le partage active la capture si elle ne l'était pas.
 * Fonction pure : ne mute pas `current`.
 */
export function nextBiometryConsents(
  current: BiometryState,
  change: BiometryToggle
): BiometryState {
  if (change.which === 'capture') {
    const capture = change.value;
    return { capture, coachShare: capture ? current.coachShare : false };
  }
  const coachShare = change.value;
  return { coachShare, capture: coachShare ? true : current.capture };
}

/**
 * Faut-il une confirmation (Sheet) avant d'appliquer cette bascule ? Uniquement
 * la RÉVOCATION de la capture (elle coupe la collecte et, en cascade, le
 * partage) — activer, ou toucher le partage seul, ne demande pas de Sheet.
 */
export function requiresCaptureRevokeConfirm(
  current: BiometryState,
  change: BiometryToggle
): boolean {
  return change.which === 'capture' && change.value === false && current.capture;
}
