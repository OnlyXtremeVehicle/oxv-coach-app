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
}

const DOMAINES: readonly DomaineFile[] = [
  'examen_vehicule',
  'ecurie',
  'inscription_modifiee',
  'intentions',
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
  console.warn('[fileAdmin] domaine inconnu, poste écarté :', brut);
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
    });
  }
  return postes;
}
