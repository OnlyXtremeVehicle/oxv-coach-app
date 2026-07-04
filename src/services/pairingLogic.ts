/**
 * Logique pure de l'appairage site ↔ app (Lot M3).
 *
 * Le site génère un code court via l'edge `pair-app` (action=generate) :
 * 8 caractères, alphabet non ambigu (sans 0/O/1/I/L), valable 10 minutes,
 * usage unique. L'app échange ce code contre une session (action=redeem).
 *
 * Ici : normalisation et validation du code saisi, et le libellé humain des
 * erreurs du contrat edge. Pur et testé — le service réseau reste mince.
 */

/** Alphabet du code (miroir de l'edge `pair-app`) : A-Z sans O/I/L, 2-9. */
const CODE_LENGTH = 8;

/**
 * Normalise une saisie utilisateur : majuscules, retrait de tout caractère
 * hors alphabet (espaces, tirets, minuscules typographiques…). Identique à la
 * normalisation appliquée côté edge avant vérification.
 */
export function normalizePairingCode(input: string): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '');
}

/** Un code prêt à être échangé fait exactement 8 caractères. */
export function isPairingCodeComplete(input: string): boolean {
  return normalizePairingCode(input).length === CODE_LENGTH;
}

export type PairingErrorCode =
  | 'invalid_or_expired'
  | 'rate_limited'
  | 'user_not_found'
  | 'link_failed'
  | 'network'
  | 'unknown';

/** Libellé humain (vouvoiement, factuel) des erreurs du contrat pair-app. */
export function pairingErrorMessage(code: PairingErrorCode): string {
  switch (code) {
    case 'invalid_or_expired':
      return 'Code invalide ou expiré. Générez un nouveau code depuis votre compte sur oxvehicle.fr.';
    case 'rate_limited':
      return 'Trop de tentatives. Patientez une minute avant de réessayer.';
    case 'network':
      return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    case 'user_not_found':
    case 'link_failed':
    case 'unknown':
      return 'La liaison a échoué. Réessayez, ou connectez-vous avec votre email.';
  }
}
