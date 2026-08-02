/**
 * CHARGEMENT DES CIRCUITS POUR L'INSPECTEUR ADMIN (jalon 7, phase 6).
 *
 * Lit la table `circuits` directement, sans passer par `circuitsService` : ce
 * dernier sert le parcours pilote, met en cache 24 h et ne rapporte ni la
 * géométrie ni les virages. L'administrateur, lui, inspecte — il doit voir
 * l'état RÉEL de la base, pas un cache d'hier.
 *
 * ---
 *
 * CE QUE L'ADMIN VOIT, ET CE QU'IL NE VOIT PAS
 *
 * Seuls les circuits OFFICIELS sont listés. Les circuits privés créés par un
 * pilote (`is_official = false`) sont ses repères personnels, pas des objets de
 * régie : les faire remonter dans un écran d'administration les exposerait sans
 * que personne l'ait demandé.
 *
 * Au 02/08/2026, la production compte trois officiels — Charente, Ricardo Tormo
 * (Valence) et Haute Saintonge — et un privé, « La charade ».
 */

import { supabase } from '@/lib/supabase';
import { type GeometrieCircuit, geometrieDuCircuit } from '@/features/admin/inspecteurCircuitLogic';

export interface CircuitInspectable {
  id: string;
  nom: string;
  ville: string | null;
  /** `approved` | `private` | autre — tel que stocké, jamais réinterprété. */
  statut: string | null;
  geometrie: GeometrieCircuit;
}

/**
 * Les circuits officiels, avec leur géométrie, du plus documenté au moins.
 *
 * Ne rejette jamais : une lecture impossible rend une liste vide, et l'écran
 * affiche son état d'erreur. Un inspecteur qui tombe n'apprend rien à personne.
 */
export async function chargerCircuitsInspectables(): Promise<CircuitInspectable[]> {
  const { data, error } = await supabase
    .from('circuits')
    .select('id, name, city, review_status, centerline_latlon, corners')
    .eq('is_official', true)
    .order('name', { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return (data as Record<string, unknown>[])
    .map((row): CircuitInspectable | null => {
      const id = row.id;
      const nom = row.name;
      if (typeof id !== 'string' || typeof nom !== 'string' || nom.length === 0) return null;
      return {
        id,
        nom,
        ville: typeof row.city === 'string' && row.city.length > 0 ? row.city : null,
        statut: typeof row.review_status === 'string' ? row.review_status : null,
        geometrie: geometrieDuCircuit(row),
      };
    })
    .filter((c): c is CircuitInspectable => c !== null);
}
