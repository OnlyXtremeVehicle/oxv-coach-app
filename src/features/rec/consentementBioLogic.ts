/**
 * CONSENTEMENT BIOMÉTRIE — faut-il poser la question ?
 *
 * Module PUR : aucune dépendance React, React Native, Supabase ni store. La
 * règle qui décide si l'on sollicite un pilote sur une donnée de santé mérite
 * d'être lisible d'un coup d'œil et testable sans rien monter.
 *
 * ---
 *
 * LE PROBLÈME QU'IL RÉSOUT
 *
 * `users` portait deux colonnes de consentement, et **un refus comme une
 * question jamais posée y valaient tous deux NULL**. Un flux qui demande « la
 * première fois seulement » ne pouvait donc pas savoir qu'il y avait déjà eu une
 * première fois : il aurait redemandé à chaque journée au pilote qui a dit non.
 *
 * Le RGPD veut qu'un refus soit respecté, pas re-sollicité. Et la doctrine OXV
 * dit que l'application montre, elle ne dirige pas — reposer indéfiniment la
 * même question est une forme d'insistance.
 *
 * `users.biometry_asked_at` (migration `20260801150133_l21_biometry_asked_at`)
 * date la SOLLICITATION, pas la réponse. C'est elle qui rend la règle possible.
 *
 * ---
 *
 * ON NE DEMANDE QU'UNE FOIS, ET JAMAIS POUR RIEN
 *
 * Quatre conditions, toutes nécessaires. Chacune écarte un cas où poser la
 * question serait au mieux inutile, au pire insistant.
 */

export interface EtatConsentementBio {
  /** Drapeau serveur `biometry`. Faux → la fonction n'existe pas pour ce pilote. */
  flagActif: boolean;
  /** Date de la dernière SOLLICITATION, ou null si la question n'a jamais été posée. */
  solliciteLe: string | null;
  /** Date du consentement de capture, ou null (refusé OU jamais demandé). */
  consentementCaptureLe: string | null;
}

/**
 * Faut-il ouvrir la feuille de consentement à ce pilote, maintenant ?
 *
 * `true` UNIQUEMENT si :
 *
 *   1. le drapeau serveur est actif — sinon la fonction n'existe pas, et
 *      demander un consentement pour une capacité absente n'a aucun sens ;
 *   2. la question n'a JAMAIS été posée — c'est tout l'objet du lot : un refus
 *      antérieur vaut réponse, et ne se re-sollicite pas ;
 *   3. le pilote n'a pas déjà consenti — inutile de redemander un oui ;
 *   4. rien d'incohérent : un consentement sans sollicitation enregistrée
 *      (donné depuis les réglages, hors flux) compte comme une réponse.
 *
 * FAIL-CLOSED sur le doute : une entrée non conforme ne déclenche pas la
 * question. Mieux vaut ne pas demander que demander deux fois.
 */
export function doitSolliciterConsentementBio(etat: EtatConsentementBio): boolean {
  if (etat === null || typeof etat !== 'object') return false;
  if (etat.flagActif !== true) return false;

  // SEUL UN `null` EXPLICITE vaut « jamais posée ».
  //
  // Une première rédaction écartait `null` ET `undefined`, ce qui laissait un
  // champ ABSENT franchir la garde et déclencher la question — l'inverse du
  // fail-closed annoncé. Le test l'a montré. Un champ absent est une lecture
  // douteuse, pas une absence de sollicitation : dans le doute, on se tait.
  if (etat.solliciteLe !== null) return false;

  // Déjà consenti hors flux (réglages) : c'est une réponse, on n'y revient pas.
  if (etat.consentementCaptureLe !== null) return false;

  return true;
}
