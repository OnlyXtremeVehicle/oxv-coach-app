/**
 * Logique pure du parrainage (écuries A3) — sans réseau, testable seule.
 *
 * Le serveur (`oxv_redeem_referral`, SECURITY DEFINER) renvoie un jsonb :
 *   - succès : { ok: true, crew_id: uuid }
 *   - échec  : { ok: false, error: '<code>' }
 * Ce module traduit ce jsonb en un résultat normalisé + messages FR vouvoyés.
 * Aucune I/O ici : l'appel Supabase vit dans `referralService`.
 *
 * Idempotence : rejouer un parrainage alors qu'on est déjà dans une écurie
 * (« deja_dans_une_ecurie ») n'est PAS un échec dur — c'est l'état déjà atteint.
 * On l'expose via `alreadyMember` pour que le service résolve l'écurie courante
 * et renvoie un succès stable plutôt qu'une erreur.
 */

/** Codes d'erreur renvoyés par la fonction serveur `oxv_redeem_referral`. */
export type RedeemErrorCode =
  | 'code_invalide'
  | 'auto_parrainage_interdit'
  | 'deja_dans_une_ecurie'
  | 'auth_required';

/** Message FR vouvoyé pour chaque code connu. Ton OXV : sec, sans emoji, sans reproche. */
export const REDEEM_ERROR_MESSAGES: Record<RedeemErrorCode, string> = {
  code_invalide: 'Ce code de parrainage est introuvable. Vérifiez-le et réessayez.',
  auto_parrainage_interdit: 'Vous ne pouvez pas utiliser votre propre code de parrainage.',
  deja_dans_une_ecurie: 'Vous faites déjà partie d’une écurie.',
  auth_required: 'Vous devez être connecté pour rejoindre une écurie.',
};

/** Message de repli si le serveur renvoie un échec non répertorié. */
export const REDEEM_UNKNOWN_ERROR =
  'Le parrainage n’a pas pu être appliqué. Réessayez dans un instant.';

const KNOWN_CODES: readonly RedeemErrorCode[] = [
  'code_invalide',
  'auto_parrainage_interdit',
  'deja_dans_une_ecurie',
  'auth_required',
];

/** Vrai si `code` est l'un des codes d'erreur serveur connus. */
export function isKnownRedeemError(code: string): code is RedeemErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

/**
 * Vrai si l'échec traduit un état déjà atteint (rejeu sans effet). Seul
 * « deja_dans_une_ecurie » est idempotent : l'appelant est déjà rattaché.
 */
export function isIdempotentRedeemError(code: string): boolean {
  return code === 'deja_dans_une_ecurie';
}

/** Résultat normalisé d'une tentative de parrainage, dérivé du jsonb serveur. */
export interface RedeemInterpretation {
  /** true si l'écurie est (ou était déjà) rejointe. */
  ok: boolean;
  /** Écurie rattachée, si le serveur l'a renvoyée (succès direct uniquement). */
  crewId?: string;
  /** Message FR vouvoyé en cas d'échec non idempotent. */
  error?: string;
  /**
   * L'appelant est déjà dans une écurie : le service doit résoudre l'écurie
   * courante et renvoyer un succès stable (idempotence), pas une erreur.
   */
  alreadyMember: boolean;
}

/**
 * Traduit le jsonb renvoyé par `oxv_redeem_referral` en résultat normalisé.
 * Robuste à un payload malformé (null, forme inattendue) : traité en échec doux.
 */
export function interpretRedeem(raw: unknown): RedeemInterpretation {
  const obj = (raw ?? {}) as { ok?: unknown; crew_id?: unknown; error?: unknown };

  if (obj.ok === true) {
    return {
      ok: true,
      crewId: typeof obj.crew_id === 'string' ? obj.crew_id : undefined,
      alreadyMember: false,
    };
  }

  const code = typeof obj.error === 'string' ? obj.error : '';

  if (isIdempotentRedeemError(code)) {
    // Cas connu, pas d'échec dur : le service confirmera l'écurie courante.
    return { ok: true, alreadyMember: true };
  }

  return {
    ok: false,
    error: isKnownRedeemError(code) ? REDEEM_ERROR_MESSAGES[code] : REDEEM_UNKNOWN_ERROR,
    alreadyMember: false,
  };
}
