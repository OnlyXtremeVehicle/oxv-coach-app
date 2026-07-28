/**
 * Qui peut être pointé présent — logique PURE (jalon 2, phase 3, lot 11).
 *
 * ---
 *
 * LA RÈGLE DU PLAN, ET POURQUOI ELLE COMPTE
 *
 * « L'application n'écrit `attended` que depuis `pending` ou `confirmed`.
 * Jamais autrement, jamais en écrasement. »
 *
 * `setAttendance` posait `attended_at` sans jamais regarder le statut de
 * l'inscription. Un pilote **annulé**, **absent déclaré** (`no_show`) ou dont le
 * paiement est en attente pouvait donc être marqué présent d'un seul geste —
 * et `registrations.attended_at` alimente les indicateurs du site, la demande
 * d'avis J+1 et la livraison des médias.
 *
 * L'enum en base ne protège rien ici : il borne `status`, pas `attended_at`.
 * Les deux colonnes pouvaient diverger sans qu'aucune contrainte ne s'y oppose.
 *
 * ---
 *
 * POURQUOI LE DÉPOINTAGE RESTE TOUJOURS PERMIS
 *
 * Pointer par erreur arrive — un scan de trop, un homonyme. Si le retour en
 * arrière était soumis à la même condition, une erreur commise depuis un statut
 * devenu invalide serait **impossible à corriger depuis l'application**.
 *
 * Une garde qui empêche de réparer ses propres erreurs finit contournée à la
 * main dans la base. On borne l'écriture d'un fait, jamais son retrait.
 */

/** Valeurs de `registration_status_enum`, lues en base le 28/07/2026. */
export type StatutInscription =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'attended'
  | 'no_show'
  | 'pending_payment';

/** Les seuls statuts depuis lesquels une présence peut être posée. */
const POINTABLES: ReadonlySet<string> = new Set(['pending', 'confirmed']);

export interface DecisionPointage {
  autorise: boolean;
  /** Raison, au vouvoiement, descriptive. Absente quand c'est autorisé. */
  raison?: string;
}

/**
 * Peut-on poser (ou retirer) la présence sur cette inscription ?
 *
 * @param statut          statut courant de l'inscription
 * @param dejaPointe      `attended_at` est-il déjà renseigné
 * @param versPresent     true = pointer, false = dépointer
 */
export function decisionPointage(
  statut: string | null,
  dejaPointe: boolean,
  versPresent: boolean
): DecisionPointage {
  // Le retrait est toujours possible — c'est la correction d'une erreur.
  if (!versPresent) return { autorise: true };

  // « Jamais en écrasement » : une présence déjà enregistrée est un fait daté.
  // La ré-horodater réécrirait l'heure d'arrivée sans que personne ne le voie.
  if (dejaPointe) {
    return {
      autorise: false,
      raison: 'La présence est déjà enregistrée. Retirez-la d’abord pour la reposer.',
    };
  }

  if (statut == null) {
    return { autorise: false, raison: 'Statut d’inscription inconnu.' };
  }

  if (!POINTABLES.has(statut)) {
    return { autorise: false, raison: `Inscription ${LIBELLE[statut] ?? statut}.` };
  }

  return { autorise: true };
}

/** Libellé humain d'un statut d'inscription. Vouvoiement, sans emoji. */
export const LIBELLE: Record<string, string> = {
  pending: 'en attente',
  confirmed: 'confirmée',
  cancelled: 'annulée',
  attended: 'déjà pointée',
  no_show: 'déclarée absente',
  pending_payment: 'en attente de paiement',
};
