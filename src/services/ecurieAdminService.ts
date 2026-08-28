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
  /** `proposee` = créée par un dépôt, pas encore validée, invisible du catalogue. */
  statut: string;
  classesAdmises: string[];
  privee: boolean;
}

interface LigneSession {
  id: string;
  date: string;
  format: string | null;
  max_capacity: number | null;
  status: string | null;
  classes_admises: string[] | null;
  is_private: boolean | null;
}

/**
 * Les journées à venir, avec de quoi savoir lesquelles la base acceptera.
 *
 * L'écran ne peut pas filtrer sans ces trois champs — statut, classes admises,
 * privée — et proposer une journée que le déclencheur refusera est exactement
 * le défaut que ce dépôt corrige partout ailleurs. Le service les rend ; c'est
 * l'écran qui trie, parce que la règle dépend de la formule de CHAQUE demande.
 *
 * Les journées `proposee` sont incluses : ce sont précisément celles que le
 * dépôt vient de créer aux dates souhaitées. Les exclure priverait
 * l'administration de ce qu'elle est venue chercher.
 */
export async function listerJourneesAVenir(): Promise<JourneeChoisissable[]> {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('sessions' as never)
    .select('id, date, format, max_capacity, status, classes_admises, is_private' as never)
    .gte('date', aujourdhui)
    .not('status', 'in', '(cancelled,archived)')
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
    statut: l.status ?? 'scheduled',
    classesAdmises:
      Array.isArray(l.classes_admises) && l.classes_admises.length
        ? l.classes_admises
        : ['I', 'II', 'III'],
    privee: l.is_private === true,
  }));
}

export interface EchecInstruction {
  motif: string;
}

/**
 * Crée la journée qu'une écurie a demandée, à l'une des dates qu'elle propose.
 *
 * ===========================================================================
 * POURQUOI CE GESTE EXISTE ICI
 * ===========================================================================
 *
 * Le capitaine propose trois dates LIBRES — c'est tout l'objet d'une
 * privatisation. Il n'y a donc, le plus souvent, aucune journée existante à
 * retenir : l'écran d'instruction listait soixante journées à venir et n'en
 * trouvait aucune qui corresponde. L'administrateur devait alors ouvrir le
 * site pour créer la journée, revenir dans l'application, puis confirmer —
 * un aller-retour entre deux applications que rien ne signalait à l'écran.
 *
 * ===========================================================================
 * CE QUE LA JOURNÉE PORTE, ET POURQUOI
 * ===========================================================================
 *
 * Journée complète Signature — donc Heritage aussi, la base l'impose : une
 * journée Signature EST une journée Heritage, au choix du client. C'est le
 * format d'une privatisation d'écurie.
 *
 * Les trois classes sont admises : une écurie rassemble des véhicules
 * disparates, et restreindre par défaut en amputerait une partie. Si le plateau
 * demande une restriction, elle se pose ensuite, en voyant qui elle écarte.
 *
 * La saison se déduit du mois — haute de mai à octobre — comme le fait le site.
 * La dupliquer ici est un pis-aller assumé : la règle est d'une ligne et n'a
 * jamais bougé, mais le jour où elle change, deux endroits devront suivre.
 */
export async function creerJourneePourEcurie(
  date: string,
): Promise<{ id: string } | EchecInstruction> {
  const mois = Number.parseInt(date.slice(5, 7), 10);
  const saison = mois >= 5 && mois <= 10 ? 'high' : 'low';

  const { data, error } = await supabase
    .from('sessions' as never)
    .insert({
      date,
      status: 'scheduled',
      is_private: false,
      format: 'full_day',
      available_offers: { access: false, signature: true },
      max_capacity: 20,
      capacity_access: 0,
      capacity_signature: 20,
      season_type: saison,
      classes_admises: ['I', 'II', 'III'],
    } as never)
    .select('id' as never)
    .single();

  if (error || !data) {
    // Le motif vient de la base — journée invendable, tarif manquant — et il
    // dit quoi corriger. Le remplacer perdrait la seule information utile.
    console.warn('[ecurieAdmin] creerJourneePourEcurie:', error?.message);
    return { motif: error?.message || 'La journée n’a pas pu être créée.' };
  }
  return { id: (data as unknown as { id: string }).id };
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
