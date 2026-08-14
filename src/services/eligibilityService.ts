/**
 * LES PIÈCES DE LA JOURNÉE — ce que le pilote déclare, ce que l'admin contrôle.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ LE 14/08/2026
 * ===========================================================================
 *
 * `eligibility_items` est en production depuis le **03/07**, avec ses neuf
 * clés contraintes et ses deux policies. La RPC `declare_eligibility_item`
 * l'accompagne depuis le **11/08**, `security definer`, avec ses garanties
 * écrites : elle n'écrit QUE `declared_at`, sur SA propre ligne, et laisse
 * l'`UPDATE` général réservé à `is_admin()`.
 *
 * **Sa seule occurrence dans tout le code était le fichier de types généré.**
 * Zéro appelant. Le pilote ne pouvait rien déclarer, nulle part.
 *
 * La ligne du plan dit *« le pilote saisit une fois, l'application prévient,
 * l'admin contrôle — trois écrans, une seule donnée »*. Il y en avait un, côté
 * admin, et il ne touchait qu'UNE des neuf clés : le briefing.
 *
 * ===========================================================================
 * LE PILOTE DÉCLARE, IL NE VALIDE PAS
 * ===========================================================================
 *
 * `status` reste la colonne de l'ADMIN — c'est lui qui met « ok » ou
 * « refused », et la RPC ne peut pas y toucher. `declared_at` dit seulement
 * « je l'ai, je l'apporte ».
 *
 * Cette séparation n'est pas cosmétique : une déclaration n'est pas un
 * contrôle, et laisser le pilote passer une pièce en « ok » ferait de la
 * checklist d'accès à la piste une formalité qu'il remplit lui-même.
 *
 * ===========================================================================
 * ET LES LIGNES NE SE CRÉENT PAS ICI
 * ===========================================================================
 *
 * La RPC lève « Pièce introuvable » si aucune ligne n'existe pour cette
 * réservation. Les lignes sont semées à l'inscription, côté serveur. L'écran
 * affiche donc ce qu'il LIT, et se tait s'il n'y a rien — il n'invente pas une
 * checklist que l'exploitant n'a pas ouverte.
 */

import { supabase } from '@/lib/supabase';
import type { CleEligibilite } from './eligibilityLogic';

export {
  CLES_DECLARABLES,
  CLES_ELIGIBILITE,
  LIBELLES,
  type CleEligibilite,
} from './eligibilityLogic';

export type StatutPiece = 'pending' | 'ok' | 'refused' | 'na';

export interface PieceEligibilite {
  registrationId: string;
  cle: CleEligibilite;
  /** Verdict de l'ADMIN. Le pilote ne l'écrit jamais. */
  statut: StatutPiece;
  /** Quand le pilote a dit « je l'ai ». `null` = pas encore déclarée. */
  declareeLe: string | null;
  note: string | null;
}

/**
 * Les pièces d'une réservation, telles que la RLS `eligibility_select_own`
 * les laisse lire au titulaire.
 *
 * Rejette en cas d'erreur plutôt que de rendre `[]` : une liste vide et une
 * lecture refusée ne commandent pas le même écran — l'une dit « rien à
 * déclarer », l'autre « je n'ai pas pu lire ».
 */
export async function listPiecesForRegistration(
  registrationId: string
): Promise<PieceEligibilite[]> {
  const { data, error } = await supabase
    .from('eligibility_items')
    .select('registration_id, item_key, status, declared_at, note')
    .eq('registration_id', registrationId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const row = r as {
      registration_id: string;
      item_key: string;
      status: string;
      declared_at?: string | null;
      note?: string | null;
    };
    return {
      registrationId: row.registration_id,
      cle: row.item_key as CleEligibilite,
      statut: row.status as StatutPiece,
      declareeLe: row.declared_at ?? null,
      note: row.note ?? null,
    };
  });
}

export interface ResultatDeclaration {
  ok: boolean;
  /** L'horodatage retenu par le serveur, ou `null` si la pièce est retirée. */
  declareeLe?: string | null;
  error?: string;
}

/**
 * Déclarer (ou retirer) une pièce.
 *
 * L'horodatage rendu est celui du SERVEUR, pas une heure locale : c'est lui
 * qui fera foi devant l'administrateur, et une horloge de téléphone décalée
 * inscrirait une déclaration à une heure qui n'a pas eu lieu.
 */
export async function declarePiece(
  registrationId: string,
  cle: CleEligibilite,
  declare = true
): Promise<ResultatDeclaration> {
  const { data, error } = await supabase.rpc('declare_eligibility_item', {
    p_registration_id: registrationId,
    p_item_key: cle,
    p_declare: declare,
  });

  if (error) {
    console.warn('[OXV][eligibilite] declare :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, declareeLe: (data as string | null) ?? null };
}
