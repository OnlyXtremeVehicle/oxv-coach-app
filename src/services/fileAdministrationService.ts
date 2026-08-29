/**
 * SERVICE — la file d'administration.
 *
 * Un seul appel, `oxv_file_administration()`, qui rassemble quatre domaines.
 * Quatre requêtes séparées auraient donné quatre latences, quatre pannes
 * possibles et quatre occasions d'oublier d'en ajouter une cinquième le jour où
 * un domaine naît.
 *
 * LA FONCTION NE REND QUE DES FAITS. Aucune urgence n'est calculée en base :
 * `fileAdminLogic` s'en charge, en appelant `examenSuiviLogic.etatDelai`, seule
 * implémentation de la règle des soixante-douze heures ouvrées dans le projet.
 */

import { supabase } from '@/lib/supabase';

import type { DomaineFile, PosteFile } from '@/features/admin/fileAdminLogic';

interface LigneFile {
  domaine: string;
  ref_id: string;
  titre: string;
  detail: string | null;
  depuis: string;
  sous_engagement: boolean;
  echeance: string | null;
}

/**
 * Les domaines que L'APPLICATION affiche.
 *
 * ===========================================================================
 * L'APP FAIT LE PADDOCK, LE SITE FAIT LE BUREAU
 * ===========================================================================
 *
 * Arbitrage du fondateur, 28/08/2026. L'instruction d'une sortie d'écurie est
 * un travail de bureau : elle se fait assis, avant la journée, en arbitrant des
 * dates et un tarif. Le site la porte depuis le 28/08 — et l'application l'a
 * portée aussi, quelques heures, avant que cette règle ne soit posée.
 *
 * `ecurie` est donc écarté ICI plutôt qu'en base : la fonction serveur reste
 * complète, et le site pourra l'adopter telle quelle pour les postes qu'il ne
 * couvre pas encore. Retirer le domaine de la base aurait détruit ce que
 * l'autre surface pourra reprendre.
 */
const DOMAINES: readonly DomaineFile[] = [
  'examen_vehicule',
  'inscription_modifiee',
  'intentions',
  'calendrier',
  'tarif',
  'journee_a_valider',
];

/**
 * Un domaine inconnu est ÉCARTÉ, pas rangé dans une catégorie par défaut.
 *
 * Le jour où la base rend un cinquième domaine que l'application ne connaît
 * pas, le montrer sous une étiquette fausse serait pire que ne pas le montrer :
 * l'administrateur croirait avoir traité autre chose. La console le signale
 * pour que l'oubli se voie.
 */
function domaineConnu(brut: string): DomaineFile | null {
  if ((DOMAINES as readonly string[]).includes(brut)) return brut as DomaineFile;
  // `ecurie` arrive de la base et n'est pas une erreur : il appartient au
  // bureau. On l'écarte en silence, sans avertir — un avertissement répété
  // sur un cas normal finit par masquer les vrais.
  if (brut !== 'ecurie') {
    console.warn('[fileAdmin] domaine inconnu, poste écarté :', brut);
  }
  return null;
}

/**
 * Tout ce qui attend une main. Réservé aux administrateurs — la fonction
 * serveur filtre elle-même sur `is_admin()`, et rend une liste vide autrement.
 */
export async function listerFileAdministration(): Promise<PosteFile[]> {
  const { data, error } = await supabase.rpc('oxv_file_administration' as never);

  if (error || !data) {
    if (error) console.warn('[fileAdmin] listerFileAdministration:', error.message);
    return [];
  }

  const postes: PosteFile[] = [];
  for (const l of data as unknown as LigneFile[]) {
    const domaine = domaineConnu(l.domaine);
    if (domaine === null) continue;
    postes.push({
      domaine,
      refId: l.ref_id,
      titre: l.titre,
      detail: l.detail ?? '',
      depuis: l.depuis,
      sousEngagement: l.sous_engagement === true,
      echeance: l.echeance ?? null,
    });
  }
  return postes;
}
