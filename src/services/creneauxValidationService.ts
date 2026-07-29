/**
 * La file des créneaux à valider, côté administration. Jalon 6, préalable.
 *
 * ---
 *
 * CE QUE CE SERVICE DÉBLOQUE
 *
 * Depuis la migration `20260729034324`, un créneau proposé par un coach entre
 * en `pending_validation` — il attend au lieu d'être rabattu sur `closed`.
 *
 * L'état n'avait **aucune sortie applicative** : personne ne pouvait valider un
 * créneau, l'attente était sans fin, et seule la console Supabase permettait
 * d'en sortir. Un état sans sortie est pire qu'un mensonge franc — il donne
 * l'apparence d'un processus.
 *
 * ---
 *
 * ON RELIT TOUJOURS LE STATUT RETENU
 *
 * La règle de la maison, posée au lot 27bis : le déclencheur
 * `oxv_coach_availability_open_gate` peut réécrire ce qu'on demande. On rend
 * donc toujours ce que la BASE a retenu, jamais ce qu'on a demandé.
 *
 * Ici l'appelant est administrateur, donc le déclencheur le laisse passer — mais
 * s'appuyer là-dessus sans relire serait exactement l'erreur que le lot 27bis a
 * corrigée. Si `is_admin()` cessait un jour d'être vrai pour cet écran, le
 * silence reviendrait.
 *
 * ---
 *
 * RIEN N'EST SUPPRIMÉ
 *
 * Refuser un créneau le passe en `closed`, jamais en suppression : le coach
 * garde la trace de ce qu'il a proposé, et l'administrateur celle de ce qu'il a
 * refusé.
 */

import { supabase } from '@/lib/supabase';
import type { CreneauEnAttente } from '@/features/admin/creneauxValidationLogic';

import type { AvailabilityStatus } from './coachMarketplaceService';

/** Ce que rend une action de validation. Jamais d'exception à l'écran. */
export type ResultatValidation =
  | { ok: true; statutRetenu: AvailabilityStatus }
  | { ok: false; erreur: string };

interface LigneBrute {
  id: string;
  coach_id: string;
  circuit_name: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  notes: string | null;
  created_at: string;
}

/**
 * Les créneaux en attente de validation.
 *
 * L'ordre est posé par `construitFile`, pas ici : une file se trie une fois, à
 * l'endroit où sa règle est écrite et testée.
 *
 * **Ne lève jamais.** Une panne rend une liste vide, et l'écran dit l'erreur.
 */
export async function listeCreneauxEnAttente(): Promise<{
  creneaux: CreneauEnAttente[];
  erreur: boolean;
}> {
  const { data, error } = await supabase
    .from('coach_availability')
    .select('id, coach_id, circuit_name, starts_at, ends_at, capacity, notes, created_at')
    .eq('status', 'pending_validation')
    .order('created_at', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[OXV][validation] liste :', error.message);
    return { creneaux: [], erreur: true };
  }

  const lignes = data as LigneBrute[];
  const nomsParCoach = await nomsDesCoachs(lignes.map((l) => l.coach_id));

  return {
    creneaux: lignes.map((l) => ({
      id: l.id,
      coachId: l.coach_id,
      coachNom: nomsParCoach.get(l.coach_id) ?? null,
      circuitName: l.circuit_name,
      startsAt: l.starts_at,
      endsAt: l.ends_at,
      capacity: l.capacity,
      notes: l.notes,
      createdAt: l.created_at,
    })),
    erreur: false,
  };
}

/**
 * Les intitulés de fiche, pour nommer les coachs.
 *
 * Best-effort : un coach sans fiche publiée n'a pas de nom ici, et `libelleCoach`
 * montrera son identifiant tronqué plutôt qu'un nom fabriqué.
 */
async function nomsDesCoachs(ids: readonly string[]): Promise<Map<string, string>> {
  const uniques = Array.from(new Set(ids));
  if (uniques.length === 0) return new Map();

  const { data, error } = await supabase
    .from('coach_profiles')
    .select('coach_id, headline')
    .in('coach_id', uniques);

  if (error || !data) return new Map();
  const m = new Map<string, string>();
  for (const r of data as { coach_id: string; headline: string | null }[]) {
    const h = r.headline?.trim();
    if (h) m.set(r.coach_id, h);
  }
  return m;
}

/** Écrit un statut et REND CELUI QUE LA BASE A RETENU. */
async function ecritStatut(id: string, statut: AvailabilityStatus): Promise<ResultatValidation> {
  const { data, error } = await supabase
    .from('coach_availability')
    .update({ status: statut })
    .eq('id', id)
    .select('status')
    .maybeSingle();

  if (error || !data) {
    console.warn('[OXV][validation] écriture :', error?.message ?? 'ligne introuvable');
    return { ok: false, erreur: 'Le créneau n’a pas pu être mis à jour.' };
  }
  return { ok: true, statutRetenu: (data as { status: string }).status as AvailabilityStatus };
}

/** Ouvre le créneau : il devient visible sur la fiche publique du coach. */
export function validerCreneau(id: string): Promise<ResultatValidation> {
  return ecritStatut(id, 'open');
}

/**
 * Referme le créneau sans le supprimer.
 *
 * `closed` et non `cancelled` : l'annulation appartient au coach, qui renonce.
 * Le refus appartient à OXV, qui n'ouvre pas. Les deux ne disent pas la même
 * chose et ne doivent pas se confondre dans l'historique.
 */
export function refuserCreneau(id: string): Promise<ResultatValidation> {
  return ecritStatut(id, 'closed');
}
