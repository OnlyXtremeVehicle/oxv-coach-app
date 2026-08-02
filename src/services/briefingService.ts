/**
 * LE BRIEFING EST COLLECTIF (jalon 7, phase 6).
 *
 * *« Le briefing est collectif — un geste bascule tous les présents. Seul des
 * neuf items à l'être par nature. »* — Plan de montage, Jalon 7, Phase 6.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE : RIEN
 *
 * La table `eligibility_items` existe depuis le 03/07/2026, avec ses neuf clés
 * (`permis`, `cni`, `assurance_circuit`, `controle_technique`, `pneus_freins`,
 * `niveau_sonore`, `casque`, `decharge`, `briefing`) et sa policy
 * `eligibility_update_admin`. **Aucun fichier de `app/(admin)/` ne la
 * mentionnait** : ni lecture, ni écriture, ni par pilote ni collectivement.
 *
 * Les cinq occurrences de « briefing » dans l'espace admin étaient un champ
 * d'horaire à la création d'un événement, jamais réaffiché nulle part.
 *
 * ---
 *
 * POURQUOI CELUI-CI, ET LUI SEUL
 *
 * Les huit autres items se vérifient pilote par pilote : on regarde un permis,
 * on contrôle des pneus. Le briefing, lui, se tient DEVANT TOUT LE MONDE en même
 * temps — le cocher vingt fois de suite décrirait une réalité qui n'a pas eu
 * lieu vingt fois. Un geste, tous les présents.
 *
 * ---
 *
 * L'AUTEUR EST ENREGISTRÉ, ICI
 *
 * Contrairement au pointage de présence et au consentement forcé — deux
 * écritures sans trace, consignées en D-30 —, `eligibility_items` porte
 * `validated_by` et `validated_at`. On les renseigne : qui a tenu le briefing,
 * et quand.
 */

import { supabase } from '@/lib/supabase';

/** La clé du briefing dans le CHECK des neuf items. Ne pas la deviner ailleurs. */
export const CLE_BRIEFING = 'briefing';

export interface EtatBriefing {
  /** Inscriptions du jour dont le briefing est validé. */
  valides: number;
  /** Inscriptions du jour concernées, tous statuts confondus. */
  total: number;
}

export interface ResultatBriefing {
  ok: boolean;
  error?: string;
}

/**
 * L'état du briefing pour un ensemble d'inscriptions.
 *
 * Ne rejette jamais ; rend `null` si la lecture n'a pas abouti. « 0 sur 12 » et
 * « je n'ai pas pu lire » ne commandent pas le même geste au portail.
 */
export async function etatBriefing(
  registrationIds: readonly string[]
): Promise<EtatBriefing | null> {
  const ids = registrationIds.filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return { valides: 0, total: 0 };

  const { data, error } = await supabase
    .from('eligibility_items')
    .select('registration_id, status')
    .eq('item_key', CLE_BRIEFING)
    .in('registration_id', ids);

  if (error || !Array.isArray(data)) return null;

  const lignes = data as { status?: unknown }[];
  return {
    valides: lignes.filter((l) => l.status === 'ok').length,
    total: lignes.length,
  };
}

/**
 * Le geste collectif : le briefing a été tenu, pour tous les présents.
 *
 * Une seule requête, une seule décision. On inscrit l'auteur et l'instant —
 * la table les prévoit, et sans eux « le briefing a été fait » n'engage
 * personne.
 *
 * `validateurId` vient de l'appelant plutôt que d'`auth.uid()` : le service ne
 * doit pas deviner qui agit, il doit le recevoir.
 */
export async function validerBriefingCollectif(
  registrationIds: readonly string[],
  validateurId: string
): Promise<ResultatBriefing> {
  const ids = registrationIds.filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return { ok: false, error: 'Aucun inscrit à valider.' };
  if (typeof validateurId !== 'string' || validateurId.length === 0) {
    // Sans auteur, l'écriture perdrait ce qui fait sa valeur. On refuse plutôt
    // que d'inscrire un briefing que personne n'a tenu.
    return { ok: false, error: 'Auteur inconnu.' };
  }

  const { error } = await supabase
    .from('eligibility_items')
    .update({
      status: 'ok',
      validated_by: validateurId,
      validated_at: new Date().toISOString(),
    })
    .eq('item_key', CLE_BRIEFING)
    .in('registration_id', ids);

  return error ? { ok: false, error: error.message } : { ok: true };
}
