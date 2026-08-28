/**
 * LA FILE D'ADMINISTRATION — tout ce qui attend une main, en une seule liste.
 *
 * ===========================================================================
 * POURQUOI UNE FILE ET NON QUATRE ÉCRANS
 * ===========================================================================
 *
 * Quatre choses attendent aujourd'hui : des examens de véhicule, des sorties
 * d'écurie, des inscriptions à véhicule modifié, et des pilotes écartés qui
 * ont demandé à être prévenus.
 *
 * Leur donner un écran chacun produirait quatre files qu'il faut penser à
 * ouvrir. Or ce qui se perd, en administration, n'est jamais ce qu'on regarde :
 * c'est ce qu'on oublie de regarder. Le hub porte déjà vingt-trois entrées ;
 * en ajouter quatre, c'est diluer.
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
  | 'intentions';

export interface PosteFile {
  domaine: DomaineFile;
  refId: string;
  titre: string;
  detail: string;
  /** Horodatage ISO de ce qui a déclenché l'attente. */
  depuis: string;
  /** Le poste court-il sous l'engagement de réponse des CGV ? */
  sousEngagement: boolean;
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
};

/**
 * Les postes sans engagement passent APRÈS tout ce qui en porte un, quel que
 * soit leur âge. Un pilote écarté depuis trois semaines n'est pas plus pressant
 * qu'un recours déposé ce matin : l'un est une occasion, l'autre une promesse.
 */
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
      etat: p.sousEngagement
        ? etatDelai('en_attente', new Date(p.depuis), maintenant)
        : ('sans_engagement' as const),
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
