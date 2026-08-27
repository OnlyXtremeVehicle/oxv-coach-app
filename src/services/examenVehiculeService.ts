/**
 * SERVICE — demandes d'examen individuel de véhicule.
 *
 * La table `demandes_examen_vehicule` est en production depuis le lot 11 ; le
 * site y dépose les demandes. **Jusqu'ici, rien dans l'app ne les lisait.**
 * Une voie de recours que personne n'ouvre n'est pas une voie de recours :
 * elle accumule des demandes qu'aucun écran ne montre, pendant que la CGV
 * promet une réponse sous soixante-douze heures ouvrées (art. 5.3).
 *
 * Ce service est ce qui manquait entre la promesse et l'instruction.
 *
 * ===========================================================================
 * LE VOCABULAIRE EST VERROUILLÉ, ET CE N'EST PAS DU STYLE
 * ===========================================================================
 *
 * Ni « refus », ni « rejet », ni « inéligible » — voir `eligibiliteLogic.ts` :
 * l'article L121-11 du code de la consommation interdit de refuser une
 * prestation à un consommateur sans motif légitime, et toute la validité du
 * dispositif tient dans la distinction entre « refuser quelqu'un » et
 * « publier un périmètre de service ». Les quatre statuts disent l'issue sans
 * jamais l'énoncer comme une décision sur la personne.
 *
 * L'écran de certification des belles routes, lui, dit « Rejeter ». C'est
 * correct là-bas — une route n'est pas un consommateur. Le verbe ne se
 * recopie PAS ici.
 *
 * ===========================================================================
 * LA TABLE N'EST PAS DANS LES TYPES GÉNÉRÉS
 * ===========================================================================
 *
 * `database.types.ts` date d'avant le lot 11. On passe donc par le motif
 * maison (`.from('...' as never)`, cf. `coachCurationService.ts`) avec une
 * forme de ligne déclarée ici. Régénérer le fichier de types entier au milieu
 * de ce chantier produirait un écart massif et hors sujet : la dette est
 * signalée, pas soldée à la sauvette.
 */

import { supabase } from '@/lib/supabase';

// ===========================================================================
// Statuts
// ===========================================================================

/** Les quatre statuts du CHECK en base. Aucun n'énonce un refus. */
export type StatutExamen = 'en_attente' | 'instruite' | 'referencee' | 'hors_perimetre';

export const STATUTS_EXAMEN: readonly StatutExamen[] = [
  'en_attente',
  'instruite',
  'referencee',
  'hors_perimetre',
];

/**
 * Les issues qu'un administrateur peut poser. `en_attente` n'en fait pas
 * partie : c'est l'état initial, pas une décision — mais le déclencheur en
 * base sait y revenir (et efface alors la date d'instruction).
 */
export const ISSUES_EXAMEN: readonly StatutExamen[] = [
  'referencee',
  'instruite',
  'hors_perimetre',
];

/** Libellés publiés. « Hors du périmètre » ne dit pas « refusé ». */
export const LIBELLE_STATUT: Readonly<Record<StatutExamen, string>> = {
  en_attente: 'En attente',
  instruite: 'Instruite',
  referencee: 'Référencée',
  hors_perimetre: 'Hors du périmètre',
};

/** Ce que chaque issue engage, en une phrase, pour l'administrateur. */
export const PORTEE_ISSUE: Readonly<Record<StatutExamen, string>> = {
  en_attente: 'La demande attend son examen.',
  instruite: 'Une réponse a été apportée, sans entrée au référentiel.',
  referencee: 'Le véhicule entre au référentiel publié.',
  hors_perimetre: 'Le véhicule ne relève pas du périmètre de service publié.',
};

// ===========================================================================
// La demande
// ===========================================================================

export interface DemandeExamen {
  id: string;
  email: string;
  marque: string;
  modele: string;
  annee: number | null;
  puissanceCh: number | null;
  masseKg: number | null;
  /** Plaque normalisée par la base (majuscules, sans séparateur), ou null. */
  immatriculation: string | null;
  statut: StatutExamen;
  reponse: string | null;
  creeLe: string;
  instruiteLe: string | null;
  userId: string | null;
}

interface LigneDemande {
  id: string;
  email: string;
  marque: string;
  modele: string;
  annee: number | null;
  puissance_ch: number | null;
  masse_kg: number | string | null;
  immatriculation: string | null;
  statut: string;
  reponse: string | null;
  cree_le: string;
  instruite_le: string | null;
  user_id: string | null;
}

/** Un statut inconnu retombe sur `en_attente` : mieux vaut instruire deux fois
 *  qu'escamoter une demande derrière une valeur qu'on ne sait pas lire. */
function statutSur(brut: string): StatutExamen {
  return (STATUTS_EXAMEN as readonly string[]).includes(brut)
    ? (brut as StatutExamen)
    : 'en_attente';
}

function mapDemande(l: LigneDemande): DemandeExamen {
  return {
    id: l.id,
    email: l.email,
    marque: l.marque,
    modele: l.modele,
    annee: l.annee,
    puissanceCh: l.puissance_ch,
    masseKg: l.masse_kg === null ? null : Number(l.masse_kg),
    immatriculation: l.immatriculation,
    statut: statutSur(l.statut),
    reponse: l.reponse,
    creeLe: l.cree_le,
    instruiteLe: l.instruite_le,
    userId: l.user_id,
  };
}

/**
 * Toutes les demandes, la plus ancienne d'abord.
 *
 * Aucun filtre sur le statut : une file qui ne montre que l'attente cache ce
 * qui a été instruit, donc empêche de vérifier qu'on a bien répondu. Le tri
 * par urgence appartient à la surface, qui seule connaît l'instant courant.
 */
export async function listerDemandesExamen(): Promise<DemandeExamen[]> {
  const { data, error } = await supabase
    .from('demandes_examen_vehicule' as never)
    .select('*' as never)
    .order('cree_le', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[examenVehicule] listerDemandesExamen:', error.message);
    return [];
  }
  return (data as unknown as LigneDemande[]).map(mapDemande);
}

/**
 * Pose l'issue d'une demande. La date d'instruction n'est PAS écrite ici :
 * un déclencheur en base l'horodate, et un horodatage que le client fabrique
 * est un horodatage qu'un client peut mentir.
 */
export async function instruireDemande(
  id: string,
  statut: StatutExamen,
  reponse: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('demandes_examen_vehicule' as never)
    .update({ statut, reponse: reponse?.trim() || null } as never)
    .eq('id', id);

  if (error) {
    console.warn('[examenVehicule] instruireDemande:', error.message);
    return false;
  }
  return true;
}

// ===========================================================================
// La plaque, comme trace
// ===========================================================================

/**
 * Combien d'inscriptions portent chacune de ces plaques.
 *
 * C'est là toute la raison d'être de `registrations.immatriculation` : la
 * plaque est FIGÉE sur l'inscription, donc elle garde la trace du véhicule
 * tel qu'il s'est présenté ce jour-là, même si `vehicles.license_plate` change
 * ensuite. Sans cette colonne, une demande d'examen serait un dossier sans
 * passé ; avec elle, l'administrateur voit tout de suite si ce véhicule est
 * déjà venu.
 *
 * Une seule requête pour toutes les plaques : une par demande donnerait un
 * N+1 sur une file qui a vocation à s'allonger.
 */
export async function compterInscriptionsParPlaque(
  plaques: readonly string[],
): Promise<Record<string, number>> {
  const uniques = [...new Set(plaques.filter((p) => p.length > 0))];
  if (uniques.length === 0) return {};

  // `registrations` est bien dans les types générés, mais sa colonne
  // `immatriculation` vient d'être créée : le fichier de types ne la connaît
  // pas encore. Même motif que ci-dessus, pour la même raison.
  const { data, error } = await supabase
    .from('registrations' as never)
    .select('immatriculation' as never)
    .in('immatriculation' as never, uniques as never);

  if (error || !data) {
    if (error) console.warn('[examenVehicule] compterInscriptionsParPlaque:', error.message);
    return {};
  }

  const compte: Record<string, number> = {};
  for (const ligne of data as unknown as { immatriculation: string | null }[]) {
    const p = ligne.immatriculation;
    if (p) compte[p] = (compte[p] ?? 0) + 1;
  }
  return compte;
}

// ===========================================================================
// Les inscriptions à examiner
// ===========================================================================

/**
 * Une inscription dont le véhicule porte des modifications déclarées.
 *
 * C'est l'autre visage du même sujet : `demandes_examen_vehicule` porte les
 * véhicules ABSENTS du référentiel, celle-ci porte les véhicules référencés
 * mais MODIFIÉS. Les deux appellent le même geste — regarder le véhicule — et
 * méritent donc la même surface. Les séparer en deux écrans ferait qu'on en
 * surveillerait un et pas l'autre.
 */
export interface InscriptionAExaminer {
  id: string;
  statut: string;
  immatriculation: string | null;
  modificationsDetail: string | null;
  offre: string;
  pilote: string;
  dateSession: string | null;
}

interface LigneInscription {
  id: string;
  status: string;
  offer_type: string | null;
  immatriculation: string | null;
  modifications_detail: string | null;
  users: { first_name: string | null; last_name: string | null } | null;
  sessions: { date: string | null } | null;
}

/**
 * Les inscriptions qui attendent un regard sur le véhicule.
 *
 * `pending` ET `en_examen` : la première est arrivée et n'a pas encore été
 * prise en main, la seconde l'est. Ne montrer que `en_examen` ferait
 * disparaître de la file tout ce qui n'a pas encore été touché — c'est-à-dire
 * exactement ce qu'il faut voir.
 *
 * Les statuts terminaux (`confirmed`, `cancelled`, `attended`, `no_show`)
 * sortent de la file : l'examen n'a plus d'objet une fois la journée jouée ou
 * l'inscription confirmée.
 */
export async function listerInscriptionsAExaminer(): Promise<InscriptionAExaminer[]> {
  const { data, error } = await supabase
    .from('registrations' as never)
    .select(
      'id, status, offer_type, immatriculation, modifications_detail, users:user_id(first_name,last_name), sessions:session_id(date)' as never,
    )
    .eq('modifications_declarees' as never, true as never)
    .in('status' as never, ['pending', 'en_examen'] as never);

  if (error || !data) {
    if (error) console.warn('[examenVehicule] listerInscriptionsAExaminer:', error.message);
    return [];
  }

  return (data as unknown as LigneInscription[]).map((l) => ({
    id: l.id,
    statut: l.status,
    immatriculation: l.immatriculation,
    modificationsDetail: l.modifications_detail,
    offre: l.offer_type ?? '—',
    pilote: `${l.users?.first_name ?? ''} ${l.users?.last_name ?? ''}`.trim() || '—',
    dateSession: l.sessions?.date ?? null,
  }));
}

/**
 * Prend une inscription en examen, ou la rend au cours normal.
 *
 * DEUX VALEURS SEULEMENT, et c'est délibéré. Confirmer une inscription depuis
 * cet écran court-circuiterait le paiement ; l'annuler prendrait une décision
 * qui appartient au membre. Cette surface dit « je regarde » ou « j'ai fini de
 * regarder » — la suite du parcours ne lui appartient pas.
 *
 * Le pilote garde son droit d'annulation pendant l'examen : le déclencheur
 * `registrations_garde_pilote` liste `en_examen` parmi les statuts annulables.
 * Examiner un véhicule est une diligence d'OXV, jamais une retenue du membre.
 */
export async function poserStatutInscription(
  id: string,
  statut: 'en_examen' | 'pending',
): Promise<boolean> {
  const { error } = await supabase
    .from('registrations' as never)
    .update({ status: statut } as never)
    .eq('id', id);

  if (error) {
    console.warn('[examenVehicule] poserStatutInscription:', error.message);
    return false;
  }
  return true;
}
