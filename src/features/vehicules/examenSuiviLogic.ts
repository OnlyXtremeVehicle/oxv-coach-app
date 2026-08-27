/**
 * SUIVI DES DEMANDES D'EXAMEN — l'échéance de l'engagement, et rien d'autre.
 *
 * Logique PURE : aucun accès réseau, aucun rendu, aucune horloge implicite.
 * L'instant courant est toujours passé en paramètre — un module qui appelle
 * `new Date()` lui-même n'est pas testable, et un suivi de délai qu'on ne peut
 * pas tester à une date donnée ne vaut rien.
 *
 * ===========================================================================
 * L'ENGAGEMENT QUE CE MODULE SURVEILLE
 * ===========================================================================
 *
 * CGV art. 5.3, cité dans `eligibiliteLogic.ts` :
 *
 *   « L'absence d'un véhicule du référentiel ne vaut pas décision de
 *     non-éligibilité. Le membre peut solliciter un examen individuel ; le
 *     Club répond dans un délai de soixante-douze heures ouvrées. »
 *
 * C'est un engagement contractuel. Une file d'attente qui ne le montre pas
 * laisse le dépassement se produire sans que personne ne le voie : la demande
 * reste « en attente » indéfiniment, et l'engagement se périme en silence.
 *
 * ===========================================================================
 * CE QUE « SOIXANTE-DOUZE HEURES OUVRÉES » VEUT DIRE ICI — À FAIRE TRANCHER
 * ===========================================================================
 *
 * La formule est ambiguë et ce module ne peut pas lever l'ambiguïté seul :
 *
 *   a) 72 heures d'horloge, week-ends déduits  → trois jours ouvrés
 *   b) 72 heures d'OUVERTURE (ex. 9 h/jour)    → plus de huit jours ouvrés
 *
 * Ce module retient (a), et le retient DÉLIBÉRÉMENT parce que c'est la lecture
 * la plus exigeante pour OXV : elle place l'échéance au plus tôt. Se tromper
 * dans ce sens fait répondre trop vite ; se tromper dans l'autre ferait
 * afficher « dans les temps » une demande contractuellement en retard.
 *
 * Entre les deux erreurs possibles, une seule est réparable.
 *
 * La lecture définitive relève du texte de CGV, donc de Gabin — ce point est
 * remonté, pas enterré dans une constante.
 *
 * ===========================================================================
 * LES JOURS FÉRIÉS NE SONT PAS DÉDUITS, ET C'EST UN CHOIX
 * ===========================================================================
 *
 * Un calendrier de fériés français codé en dur se périme (Pâques est mobile,
 * l'Alsace-Moselle a deux jours de plus). Ne pas les déduire avance l'échéance :
 * l'erreur reste du côté exigeant. Le jour où le calendrier devient nécessaire,
 * il viendra de la base, pas d'un tableau figé dans un fichier.
 *
 * ===========================================================================
 * LE CALCUL EST EN UTC
 * ===========================================================================
 *
 * L'écart avec l'heure de Paris est d'une à deux heures sur un engagement de
 * soixante-douze. La surface montre un ÉTAT (« dans les temps », « échéance
 * proche », « dépassée »), jamais un compte à rebours à la minute — un état
 * ne bascule pas sur deux heures d'écart. Le calcul en UTC rend en échange les
 * tests déterministes quel que soit le fuseau de la machine.
 */

// ===========================================================================
// Constantes de l'engagement
// ===========================================================================

/** Durée de l'engagement, en heures ouvrées. CGV art. 5.3. */
export const HEURES_ENGAGEMENT = 72;

/** Sous ce reste (en heures ouvrées), l'échéance est signalée « proche ». */
export const SEUIL_PROCHE_HEURES = 12;

const UNE_HEURE_MS = 3_600_000;

// ===========================================================================
// Calendrier
// ===========================================================================

/** Samedi ou dimanche, en UTC. */
function estWeekEnd(d: Date): boolean {
  const jour = d.getUTCDay();
  return jour === 0 || jour === 6;
}

/**
 * L'échéance d'une demande déposée à `creeLe`.
 *
 * L'avance se fait heure par heure. Une formule fermée gagnerait quelques
 * microsecondes et perdrait la seule qualité qui compte ici : on peut la lire
 * et vérifier qu'elle dit ce que dit la CGV. Le nombre de pas est borné —
 * 72 heures ouvrées traversent au plus deux week-ends, soit 168 pas.
 */
export function echeanceExamen(creeLe: Date): Date {
  const curseur = new Date(creeLe.getTime());
  let restantes = HEURES_ENGAGEMENT;
  // Une heure est comptée par son DÉBUT. Compter par sa fin jetterait la
  // dernière heure du vendredi (elle s'achève un samedi) et créditerait la
  // première heure du lundi à un dimanche soir : deux erreurs symétriques qui
  // ne s'annulent pas et rendent le calcul indéfendable devant le texte.
  while (restantes > 0) {
    if (!estWeekEnd(curseur)) restantes -= 1;
    curseur.setTime(curseur.getTime() + UNE_HEURE_MS);
  }
  return curseur;
}

/**
 * Heures ouvrées restantes avant l'échéance, à l'instant `maintenant`.
 * Négatif au-delà de l'échéance — le dépassement se mesure, il ne se borne
 * pas à zéro : « en retard de deux heures » et « en retard de six jours » ne
 * demandent pas la même réaction.
 */
export function heuresOuvreesRestantes(creeLe: Date, maintenant: Date): number {
  const echeance = echeanceExamen(creeLe);
  if (maintenant >= echeance) {
    return -compterHeuresOuvrees(echeance, maintenant);
  }
  return compterHeuresOuvrees(maintenant, echeance);
}

/**
 * Heures ouvrées ENTIÈRES entre deux instants (`debut` <= `fin`).
 *
 * L'heure entamée ne compte pas. Arrondir vers le bas fait basculer l'état
 * « dépassée » un peu plus tôt que la stricte vérité ; arrondir vers le haut
 * ferait afficher « dans les temps » une demande qui ne l'est plus. Des deux
 * imprécisions possibles, on garde celle qui alerte trop tôt.
 */
function compterHeuresOuvrees(debut: Date, fin: Date): number {
  const curseur = new Date(debut.getTime());
  let heures = 0;
  while (curseur.getTime() + UNE_HEURE_MS <= fin.getTime()) {
    if (!estWeekEnd(curseur)) heures += 1;
    curseur.setTime(curseur.getTime() + UNE_HEURE_MS);
  }
  return heures;
}

// ===========================================================================
// L'état d'une demande
// ===========================================================================

/**
 * L'état de suivi d'une demande.
 *
 * `close` ne dit rien de l'issue : une demande instruite, référencée ou située
 * hors du périmètre est également close. L'issue est le statut ; ceci est le
 * respect du DÉLAI, qui est une autre question — et une demande peut avoir été
 * instruite en retard.
 */
export type EtatDelai = 'close' | 'dans_les_temps' | 'echeance_proche' | 'depassee';

/** Libellé d'affichage de chaque état. Neutre, sans reproche ni alarme. */
export const LIBELLE_ETAT_DELAI: Readonly<Record<EtatDelai, string>> = {
  close: 'Instruite',
  dans_les_temps: 'Dans les temps',
  echeance_proche: 'Échéance proche',
  depassee: 'Échéance dépassée',
};

/**
 * L'état de suivi, à l'instant `maintenant`.
 *
 * Une demande dont le statut n'est plus `en_attente` est close : le délai a
 * cessé de courir au moment de l'instruction, et continuer à le décompter
 * afficherait un retard imaginaire sur une demande déjà traitée.
 */
export function etatDelai(
  statut: string,
  creeLe: Date,
  maintenant: Date,
): EtatDelai {
  if (statut !== 'en_attente') return 'close';
  const restantes = heuresOuvreesRestantes(creeLe, maintenant);
  if (restantes <= 0) return 'depassee';
  if (restantes <= SEUIL_PROCHE_HEURES) return 'echeance_proche';
  return 'dans_les_temps';
}

/**
 * Les demandes les plus urgentes d'abord.
 *
 * L'ordre est : dépassées, puis échéances proches, puis le reste, puis les
 * closes. À état égal, la plus ancienne passe devant — une file d'attente qui
 * ne respecte pas l'ordre d'arrivée n'est pas une file d'attente.
 */
const RANG_ETAT: Readonly<Record<EtatDelai, number>> = {
  depassee: 0,
  echeance_proche: 1,
  dans_les_temps: 2,
  close: 3,
};

export function rangUrgence(etat: EtatDelai): number {
  return RANG_ETAT[etat];
}

// ===========================================================================
// La plaque, à l'affichage
// ===========================================================================

/** Forme SIV : deux lettres, trois chiffres, deux lettres. */
const SIV = /^([A-Z]{2})(\d{3})([A-Z]{2})$/;

/**
 * La plaque telle qu'on la LIT, à partir de la plaque telle qu'on la RANGE.
 *
 * La base stocke « AB123CD » — sans séparateur, pour que « AB-123-CD » et
 * « ab 123 cd » se rapprochent (`normaliser_plaque`, une seule règle, côté
 * serveur). Personne ne lit une plaque sous cette forme : on la remet en
 * « AB-123-CD » ici, à l'affichage seulement.
 *
 * Le sens est à sens unique et doit le rester : cette fonction ne sert JAMAIS
 * à fabriquer une clé de rapprochement. Une plaque qui ne suit pas la forme
 * SIV (immatriculation ancienne, étrangère, cyclomoteur) est rendue telle
 * quelle — inventer des tirets sur une forme qu'on ne reconnaît pas
 * déformerait la trace au lieu de l'éclairer.
 */
export function formaterPlaque(normalisee: string | null): string | null {
  if (!normalisee) return null;
  const m = SIV.exec(normalisee);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : normalisee;
}
