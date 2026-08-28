/**
 * SERVICE ADMIN — instruire une demande de sortie d'écurie.
 *
 * Le fil de l'écurie dépose ; personne ne répondait. C'est le pendant manquant,
 * et il est réservé à l'administration : les politiques d'`UPDATE` sur
 * `reservations_ecurie` exigent `is_admin()`.
 *
 * ===========================================================================
 * CONFIRMER, C'EST ARRÊTER UNE JOURNÉE
 * ===========================================================================
 *
 * Le déclencheur `reservations_ecurie_confirmation_complete` refuse une
 * confirmation sans `session_id`. Ce n'est pas une formalité : le fil annonce
 * automatiquement « votre réservation est confirmée » à toute l'écurie, et une
 * annonce sans journée serait vraie tout en ne servant à rien — personne ne
 * pourrait s'inscrire à quoi que ce soit.
 *
 * Le service ne contourne donc rien : il présente les journées disponibles et
 * laisse la base refuser si l'on s'en écarte.
 */

import { supabase } from '@/lib/supabase';

import type { FormuleEcurie, StatutReservation } from '@/features/club/filEcurieLogic';

export interface DemandeEcurie {
  id: string;
  crewId: string;
  nomEcurie: string;
  effectif: number;
  formule: FormuleEcurie;
  statut: StatutReservation;
  message: string | null;
  sessionId: string | null;
  dates: string[];
  creeLe: string;
}

interface LigneDemande {
  id: string;
  crew_id: string;
  effectif_annonce: number;
  formule: string;
  statut: string;
  message: string | null;
  session_id: string | null;
  cree_le: string;
  crews: { name: string | null } | null;
  reservations_ecurie_dates: { date_souhaitee: string; rang: number }[] | null;
}

/**
 * Les demandes vivantes, la plus ancienne d'abord.
 *
 * Les demandes closes sont écartées : elles appartiennent au passé, et une file
 * d'instruction qui les montre oblige à les relire pour rien. Les confirmées
 * restent — leur journée peut encore être corrigée.
 */
export async function listerDemandesEcurie(): Promise<DemandeEcurie[]> {
  const { data, error } = await supabase
    .from('reservations_ecurie' as never)
    .select(
      'id, crew_id, effectif_annonce, formule, statut, message, session_id, cree_le, crews(name), reservations_ecurie_dates(date_souhaitee, rang)' as never,
    )
    .in('statut', ['deposee', 'dates_proposees', 'confirmee'])
    .order('cree_le', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[ecurieAdmin] listerDemandesEcurie:', error.message);
    return [];
  }

  return (data as unknown as LigneDemande[]).map((l) => ({
    id: l.id,
    crewId: l.crew_id,
    nomEcurie: l.crews?.name ?? 'Une écurie',
    effectif: l.effectif_annonce,
    formule: l.formule as FormuleEcurie,
    statut: l.statut as StatutReservation,
    message: l.message,
    sessionId: l.session_id,
    dates: (l.reservations_ecurie_dates ?? [])
      .sort((a, b) => a.rang - b.rang)
      .map((d) => d.date_souhaitee),
    creeLe: l.cree_le,
  }));
}

export interface JourneeChoisissable {
  id: string;
  date: string;
  format: string;
  placesTotales: number | null;
}

interface LigneSession {
  id: string;
  date: string;
  format: string | null;
  max_capacity: number | null;
}

/**
 * Les journées à venir sur lesquelles poser une écurie.
 *
 * Aucun filtre sur le format ni sur les places : une insertion se pose sur une
 * journée Access, une privatisation transforme la journée en journée privée, et
 * c'est l'administration qui sait. Filtrer ici retirerait des options
 * légitimes sans le dire — le défaut que ce dépôt corrige partout ailleurs.
 */
export async function listerJourneesAVenir(): Promise<JourneeChoisissable[]> {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('sessions')
    .select('id, date, format, max_capacity')
    .gte('date', aujourdhui)
    .order('date', { ascending: true })
    .limit(60);

  if (error || !data) {
    if (error) console.warn('[ecurieAdmin] listerJourneesAVenir:', error.message);
    return [];
  }
  return (data as unknown as LigneSession[]).map((l) => ({
    id: l.id,
    date: l.date,
    format: l.format ?? '—',
    placesTotales: l.max_capacity,
  }));
}

export interface EchecInstruction {
  motif: string;
}

/**
 * Confirme une demande en arrêtant la journée.
 *
 * Les deux écritures partent ENSEMBLE : poser la journée puis confirmer en deux
 * temps laisserait une fenêtre où la demande est confirmée sans journée — et le
 * déclencheur la refuserait, ce qui vaut mieux, mais l'administrateur verrait
 * un échec sans comprendre lequel des deux gestes a manqué.
 */
export async function confirmerDemandeEcurie(
  id: string,
  sessionId: string,
  reponse: string | null,
): Promise<true | EchecInstruction> {
  const { error } = await supabase
    .from('reservations_ecurie' as never)
    .update({
      session_id: sessionId,
      statut: 'confirmee',
      reponse: reponse?.trim() || null,
      repondu_le: new Date().toISOString(),
    } as never)
    .eq('id', id);

  if (error) {
    console.warn('[ecurieAdmin] confirmerDemandeEcurie:', error.message);
    return { motif: error.message || 'La confirmation n’a pas abouti.' };
  }
  return true;
}

/**
 * Clôt une demande sans la confirmer.
 *
 * Le mot « close » est celui de la base, et il ne dit rien de l'issue : une
 * demande peut se clore parce que l'écurie renonce, parce que la date ne se
 * trouve pas, ou parce qu'elle a été traitée autrement. Le champ `reponse` porte
 * le motif — et le fil de l'écurie le reçoit automatiquement.
 */
export async function clore(id: string, reponse: string | null): Promise<true | EchecInstruction> {
  const { error } = await supabase
    .from('reservations_ecurie' as never)
    .update({
      statut: 'close',
      reponse: reponse?.trim() || null,
      repondu_le: new Date().toISOString(),
    } as never)
    .eq('id', id);

  if (error) {
    console.warn('[ecurieAdmin] clore:', error.message);
    return { motif: error.message || 'La clôture n’a pas abouti.' };
  }
  return true;
}
