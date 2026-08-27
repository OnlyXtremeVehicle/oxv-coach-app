/**
 * SERVICE — le fil de l'écurie et sa réservation groupée.
 *
 * Les tables `ecurie_messages`, `reservations_ecurie` et
 * `reservations_ecurie_dates` sont nées le 27/08/2026 et ne figurent pas encore
 * dans `database.types.ts`. On applique le motif maison (`.from('...' as never)`,
 * cf. `coachCurationService.ts`) : la dette est signalée, pas soldée à la sauvette.
 *
 * ===========================================================================
 * LE DÉPÔT NE PASSE PAS PAR UNE ÉCRITURE DIRECTE, ET C'EST VOULU
 * ===========================================================================
 *
 * `oxv_deposer_reservation_ecurie` est le SEUL chemin : la base n'expose aucune
 * politique d'insertion sur `reservations_ecurie`. C'est elle qui vérifie les
 * trois dates, refuse une seconde demande ouverte, et calcule la formule.
 *
 * Cette règle a été apprise à ses dépens : une politique d'insertion directe
 * avait d'abord été posée en parallèle de la fonction, et un capitaine pouvait
 * écrire une privatisation à trente pilotes avec zéro date. Une règle dans une
 * fonction plus une porte qui la contourne n'est pas une règle.
 */

import { supabase } from '@/lib/supabase';

import type { FormuleEcurie, MessageFil, StatutReservation } from '@/features/club/filEcurieLogic';

interface LigneMessage {
  id: string;
  auteur_id: string | null;
  nature: string;
  texte: string;
  cree_le: string;
}

/** Une nature inconnue est traitée comme une parole de membre : c'est le repli
 *  le moins trompeur — jamais faire passer un message douteux pour un avis OXV. */
function natureSure(brut: string): MessageFil['nature'] {
  return brut === 'systeme' ? 'systeme' : 'membre';
}

/**
 * Le fil d'une écurie, du plus ancien au plus récent.
 *
 * Borné à 200 messages : au-delà, un fil se pagine. La borne est explicite
 * plutôt que laissée au défaut de PostgREST, qui tronquerait en silence — et
 * un fil tronqué sans le dire donne l'impression que des messages ont disparu.
 */
export async function listerMessagesFil(crewId: string): Promise<MessageFil[]> {
  const { data, error } = await supabase
    .from('ecurie_messages' as never)
    .select('id, auteur_id, nature, texte, cree_le' as never)
    .eq('crew_id', crewId)
    .order('cree_le', { ascending: true })
    .limit(200);

  if (error || !data) {
    if (error) console.warn('[ecurieFil] listerMessagesFil:', error.message);
    return [];
  }
  return (data as unknown as LigneMessage[]).map((l) => ({
    id: l.id,
    auteurId: l.auteur_id,
    nature: natureSure(l.nature),
    texte: l.texte,
    creeLe: l.cree_le,
  }));
}

/**
 * Poser une parole dans le fil.
 *
 * `nature` n'est pas passée : la politique d'insertion n'accepte que
 * `'membre'`, et l'omettre laisse le défaut faire son travail. Un client qui
 * tenterait `'systeme'` serait refusé par la base — personne ne peut fabriquer
 * un faux avis d'OXV dans le fil de son écurie.
 */
export async function envoyerMessage(
  crewId: string,
  auteurId: string,
  texte: string,
): Promise<boolean> {
  const propre = texte.trim();
  if (propre.length === 0 || propre.length > 2000) return false;

  const { error } = await supabase
    .from('ecurie_messages' as never)
    .insert({ crew_id: crewId, auteur_id: auteurId, texte: propre } as never);

  if (error) {
    console.warn('[ecurieFil] envoyerMessage:', error.message);
    return false;
  }
  return true;
}

export interface ReservationEcurie {
  id: string;
  statut: StatutReservation;
  formule: FormuleEcurie;
  effectif: number;
  sessionId: string | null;
  dates: string[];
}

interface LigneReservation {
  id: string;
  statut: string;
  formule: string;
  effectif_annonce: number;
  session_id: string | null;
  reservations_ecurie_dates: { date_souhaitee: string; rang: number }[] | null;
}

/**
 * La demande en cours de l'écurie, s'il y en a une.
 *
 * On ne retient que les états VIVANTS : une demande close appartient au passé,
 * et l'afficher en bandeau ferait croire à une action en attente. `null`
 * signifie « rien en cours », jamais « erreur » — l'appelant ne peut pas
 * distinguer, et c'est assumé : une bannière absente vaut mieux qu'une bannière
 * fausse.
 */
export async function reservationEnCours(crewId: string): Promise<ReservationEcurie | null> {
  const { data, error } = await supabase
    .from('reservations_ecurie' as never)
    .select(
      'id, statut, formule, effectif_annonce, session_id, reservations_ecurie_dates(date_souhaitee, rang)' as never,
    )
    .eq('crew_id', crewId)
    .in('statut', ['deposee', 'dates_proposees', 'confirmee'])
    .order('cree_le', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[ecurieFil] reservationEnCours:', error.message);
    return null;
  }

  const l = data as unknown as LigneReservation;
  return {
    id: l.id,
    statut: l.statut as StatutReservation,
    formule: l.formule as FormuleEcurie,
    effectif: l.effectif_annonce,
    sessionId: l.session_id,
    dates: (l.reservations_ecurie_dates ?? [])
      .sort((a, b) => a.rang - b.rang)
      .map((d) => d.date_souhaitee),
  };
}

export interface EchecDepot {
  /** Message affichable, tel que la base l'a formulé. */
  motif: string;
}

/**
 * Déposer la demande groupée. Seul le capitaine y parvient — la fonction
 * serveur le vérifie, et rend un motif lisible sinon.
 *
 * Le motif d'échec est REMONTÉ TEL QUEL. Les exceptions de cette fonction sont
 * rédigées pour être lues par un capitaine (« une privatisation demande
 * exactement trois dates souhaitées ») ; les remplacer par un « erreur »
 * générique perdrait la seule information utile.
 */
export async function deposerReservationEcurie(
  effectif: number,
  message: string | null,
  sessionId: string | null,
  dates: readonly string[] | null,
): Promise<{ id: string } | EchecDepot> {
  const { data, error } = await supabase.rpc('oxv_deposer_reservation_ecurie' as never, {
    p_effectif: effectif,
    p_message: message,
    p_session_id: sessionId,
    p_dates: dates && dates.length > 0 ? dates : null,
  } as never);

  if (error) {
    console.warn('[ecurieFil] deposerReservationEcurie:', error.message);
    return { motif: error.message || 'La demande n’a pas pu être déposée.' };
  }
  return { id: data as unknown as string };
}
