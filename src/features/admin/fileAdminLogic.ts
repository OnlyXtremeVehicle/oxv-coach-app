/**
 * LA FILE D'ADMINISTRATION — tout ce qui attend une main, en une seule liste.
 *
 * ===========================================================================
 * POURQUOI UNE FILE ET NON QUATRE ÉCRANS
 * ===========================================================================
 *
 * Six choses attendent : des examens de véhicule, des sorties d'écurie, des
 * inscriptions à véhicule modifié, des pilotes écartés qui ont demandé à être
 * prévenus — et deux CONSTATS, qui ne sont demandés par personne : un
 * calendrier vide, un tarif inactif.
 *
 * Leur donner un écran chacun produirait six files qu'il faut penser à ouvrir.
 * Or ce qui se perd, en administration, n'est jamais ce qu'on regarde : c'est
 * ce qu'on oublie de regarder. Le hub porte déjà vingt-quatre entrées ; en
 * ajouter six, c'est diluer.
 *
 * Les deux constats méritent une mention particulière. Une file qui ne montre
 * que ce qui EST ARRIVÉ ne montre jamais ce qui N'ARRIVERA PAS — et une
 * boutique fermée ne produit aucun signal, par définition. Mesuré le
 * 28/08/2026 : zéro journée publique au calendrier, et personne pour le voir.
 *
 * ===========================================================================
 * L'ENGAGEMENT DE DÉLAI NE S'APPLIQUE PAS À TOUT, ET LES MÊLER FERAIT CRIER
 * CE QUI PEUT ATTENDRE
 * ===========================================================================
 *
 * Deux postes courent sous les soixante-douze heures ouvrées des CGV (art.
 * 5.3) : l'examen de véhicule et la demande d'écurie. Ce sont des RECOURS —
 * quelqu'un a demandé, OXV s'est engagé à répondre.
 *
 * Les deux autres sont des DILIGENCES : regarder une inscription modifiée,
 * relancer des pilotes écartés. Utile, jamais dû. Leur poser une échéance
 * ferait clignoter en rouge ce qui peut attendre lundi, et l'œil finirait par
 * ne plus distinguer.
 *
 * ===========================================================================
 * LA RÈGLE DES SOIXANTE-DOUZE HEURES N'EST PAS RÉÉCRITE ICI
 * ===========================================================================
 *
 * `examenSuiviLogic.etatDelai` est la SEULE implémentation de cette règle dans
 * le projet, et ce module l'appelle. La base, elle, ne calcule aucune urgence :
 * elle rend des faits et des horodatages. Une seconde implémentation — en SQL,
 * ou ici — créerait deux vérités qui divergeraient au premier ajustement.
 */

import { type EtatDelai, etatDelai, rangUrgence } from '@/features/vehicules/examenSuiviLogic';

export type DomaineFile =
  | 'examen_vehicule'
  | 'ecurie'
  | 'inscription_modifiee'
  | 'intentions'
  // Deux constats, pas deux demandes : ils disent ce qui EMPECHE de vendre.
  // Une file qui ne montre que ce qui est arrive ne montre jamais ce qui
  // n'arrivera pas — et une boutique fermee ne produit aucun signal.
  | 'calendrier'
  | 'tarif'
  // Une journee proposee : creee par le depot d'une ecurie, invisible du
  // catalogue, a valider sous sept jours de calendrier.
  | 'journee_a_valider';

export interface PosteFile {
  domaine: DomaineFile;
  refId: string;
  titre: string;
  detail: string;
  /** Horodatage ISO de ce qui a déclenché l'attente. */
  depuis: string;
  /** Le poste court-il sous l'engagement de réponse des CGV (72 h ouvrées) ? */
  sousEngagement: boolean;
  /**
   * Une échéance DÉJÀ ARRÊTÉE en base, quand il en existe une — la validation
   * d'une journée proposée, sept jours de calendrier.
   *
   * Elle ne se calcule pas ici : elle a été écrite au moment où elle était
   * posée. Deux délais coexistent donc, et ils ne se confondent pas — l'un est
   * un engagement envers un membre et se compte en heures ouvrées, l'autre est
   * une discipline interne et se compte en jours.
   */
  echeance: string | null;
}

/** Un poste sans engagement n'a pas d'état de délai : il n'en court aucun. */
export type EtatPoste = EtatDelai | 'sans_engagement';

export interface PosteClasse extends PosteFile {
  etat: EtatPoste;
}

/** Libellé de domaine. Un nom, pas une catégorie technique. */
export const LIBELLE_DOMAINE: Readonly<Record<DomaineFile, string>> = {
  examen_vehicule: 'Examen de véhicule',
  ecurie: 'Sortie d’écurie',
  inscription_modifiee: 'Véhicule modifié',
  intentions: 'Pilotes écartés',
  calendrier: 'Calendrier',
  tarif: 'Grille tarifaire',
  journee_a_valider: 'Journée proposée',
};

/**
 * Ce que le poste appelle comme geste. Le libellé dit l'action, jamais
 * l'objet : « Instruire » se comprend seul, « Examens » ne dit pas quoi faire.
 */
export const GESTE_DOMAINE: Readonly<Record<DomaineFile, string>> = {
  examen_vehicule: 'Instruire',
  ecurie: 'Répondre',
  inscription_modifiee: 'Regarder',
  intentions: 'Voir la journée',
  // Ces deux-là se règlent sur le site : publier une journée, activer un tarif.
  // Le geste est nommé pour dire OU aller, pas pour promettre un bouton ici.
  calendrier: 'Publier une journée',
  tarif: 'Activer la ligne',
  journee_a_valider: 'Valider ou libérer',
};

/**
 * Les postes sans engagement passent APRÈS tout ce qui en porte un, quel que
 * soit leur âge. Un pilote écarté depuis trois semaines n'est pas plus pressant
 * qu'un recours déposé ce matin : l'un est une occasion, l'autre une promesse.
 */
/**
 * L'état d'un poste.
 *
 * Trois chemins, et l'ordre compte : l'engagement de CGV prime, parce qu'il est
 * promis à quelqu'un. Vient ensuite l'échéance datée, qui n'est promise à
 * personne mais qui court. Le reste n'a pas d'échéance du tout.
 *
 * Une échéance datée réutilise les MÊMES états — dépassée, proche, dans les
 * temps — pour que l'œil n'ait pas à apprendre deux vocabulaires. Seul le
 * calcul diffère : un délai interne se compte en jours de calendrier, pas en
 * heures ouvrées.
 */
function etatDe(p: PosteFile, maintenant: Date): EtatPoste {
  if (p.sousEngagement) return etatDelai('en_attente', new Date(p.depuis), maintenant);
  if (!p.echeance) return 'sans_engagement';

  const reste = new Date(p.echeance).getTime() - maintenant.getTime();
  if (Number.isNaN(reste)) return 'sans_engagement';
  if (reste <= 0) return 'depassee';
  // Sous deux jours, l'échéance est proche. Un délai de sept jours prévenu
  // deux jours avant laisse le temps d'agir ; prévenu la veille, non.
  if (reste <= 2 * 86_400_000) return 'echeance_proche';
  return 'dans_les_temps';
}

const RANG_SANS_ENGAGEMENT = 10;

function rangDe(etat: EtatPoste): number {
  return etat === 'sans_engagement' ? RANG_SANS_ENGAGEMENT : rangUrgence(etat);
}

/**
 * La file, triée par ce qui presse.
 *
 * À état égal, le plus ancien passe devant — une file qui ne respecte pas
 * l'ordre d'arrivée n'est pas une file.
 */
export function classerFile(postes: readonly PosteFile[], maintenant: Date): PosteClasse[] {
  return postes
    .map((p) => ({
      ...p,
      etat: etatDe(p, maintenant),
    }))
    .sort((a, b) => {
      const ra = rangDe(a.etat);
      const rb = rangDe(b.etat);
      return ra !== rb ? ra - rb : a.depuis.localeCompare(b.depuis);
    });
}

export interface ResumeFile {
  total: number;
  depassees: number;
  proches: number;
  sansEngagement: number;
}

/**
 * Le compte en tête d'écran.
 *
 * `depassees` et `proches` ne comptent QUE les postes sous engagement : y
 * mêler les diligences gonflerait un chiffre qui doit rester un signal.
 */
export function resumerFile(postes: readonly PosteClasse[]): ResumeFile {
  return {
    total: postes.length,
    depassees: postes.filter((p) => p.etat === 'depassee').length,
    proches: postes.filter((p) => p.etat === 'echeance_proche').length,
    sansEngagement: postes.filter((p) => p.etat === 'sans_engagement').length,
  };
}

/**
 * La phrase d'en-tête. `null` quand la file est vide — une file vide se dit par
 * son état vide, pas par une bannière qui annonce zéro.
 */
export function phraseResume(r: ResumeFile): string | null {
  if (r.total === 0) return null;

  if (r.depassees > 0) {
    return `${r.depassees} échéance${r.depassees > 1 ? 's' : ''} dépassée${r.depassees > 1 ? 's' : ''} sur ${r.total} poste${r.total > 1 ? 's' : ''}.`;
  }
  if (r.proches > 0) {
    return `${r.proches} échéance${r.proches > 1 ? 's' : ''} proche${r.proches > 1 ? 's' : ''} sur ${r.total} poste${r.total > 1 ? 's' : ''}.`;
  }
  return `${r.total} poste${r.total > 1 ? 's' : ''} en attente, aucune échéance pressante.`;
}
