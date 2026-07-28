/**
 * Liste blanche à trois états des lectures approfondies — jalon 2, phase 3,
 * lot 13. Logique PURE.
 *
 * ---
 *
 * LE DÉFAUT QUE CE MODULE FERME
 *
 * Les six lectures étaient offertes en permanence. Chaque vue décidait seule, à
 * l'ouverture de sa feuille, si elle avait de quoi dessiner — et rendait sinon
 * « Données insuffisantes sur cette séance ».
 *
 * Le pilote voyait donc six portes, les ouvrait une à une, et trouvait six fois
 * la même phrase. Rien n'était faux ; tout était décevant, et l'information
 * arrivait après le geste au lieu de le précéder.
 *
 * Le dossier de conception l'écrit sans détour : trois états, `disponible`,
 * `absent` — le tiret et sa raison —, `demo` jamais en production. Et il assume
 * la conséquence : **tant que rien n'est mesuré, la section entière s'efface.**
 * Une section vide est une information ; six portes fermées n'en sont pas une.
 *
 * ---
 *
 * POURQUOI LA DÉCISION EST ICI, ET PAS DANS CHAQUE VUE
 *
 * Une règle répartie sur six composants est une règle qu'on applique cinq fois.
 * Les vues gardent leur propre garde — elles restent honnêtes si on les monte
 * quand même — mais c'est ce module qui décide de les OFFRIR.
 */

import type { SessionInsights } from '@/circuit/sessionInsights';
import type { ReadingKey } from './catalogue';

/**
 * Les trois états. `demo` existe dans le type parce que le dossier le nomme,
 * et parce qu'un état qu'on refuse de nommer est un état qu'on laisse passer.
 * `productionAutorise` en interdit le rendu hors développement.
 */
export type EtatLecture = 'disponible' | 'absent' | 'demo';

export interface Disponibilite {
  key: ReadingKey;
  etat: EtatLecture;
  /**
   * Pourquoi c'est absent. Descriptif, jamais prescriptif — on ne dit pas au
   * pilote quoi faire pour l'obtenir. Renseigné seulement si `etat = 'absent'`.
   */
  raison?: string;
}

/** Ce dont chaque lecture a besoin pour exister. */
export interface EntreesLectures {
  insights: SessionInsights | null;
  /** Nuage (G long, G lat) du diagramme G-G. */
  nbPointsGG: number;
  /** Points de jerk résiduel de la cohérence du flow. */
  nbPointsFlow: number;
}

/**
 * Raisons d'absence. Une seule formulation par cause, pour que deux lectures
 * absentes pour la même raison le disent avec les mêmes mots.
 */
const RAISONS = {
  aucuneMesure: 'Aucune mesure sur cette séance',
  pasDeVirage: 'Aucun virage exploitable',
  pasAssezDeTours: 'Pas assez de tours pour comparer',
  pasDeChrono: 'Chronos de secteur non calculés',
  pasDInertiel: 'Signal inertiel absent',
  pasDeGyroscope: 'Gyroscope absent',
} as const;

/** Un enregistrement de virage est-il exploitable ? */
function aDuContenu(bloc: unknown): boolean {
  if (bloc == null) return false;
  if (Array.isArray(bloc)) return bloc.length > 0;
  if (typeof bloc === 'object') return Object.keys(bloc as object).length > 0;
  return false;
}

/**
 * État d'UNE lecture.
 *
 * Aucune lecture n'est `disponible` par défaut : chacune doit prouver qu'elle a
 * de quoi. C'est la même discipline que le fail-closed ailleurs dans ce dépôt —
 * l'absence de preuve n'est pas une preuve d'absence de problème.
 */
export function etatLecture(key: ReadingKey, e: EntreesLectures): Disponibilite {
  const i = e.insights;

  if (i == null) return { key, etat: 'absent', raison: RAISONS.aucuneMesure };

  switch (key) {
    case 'anatomie':
      return aDuContenu(i.anatomy)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDeVirage };

    case 'gg':
      return e.nbPointsGG > 0
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDInertiel };

    case 'dispersion':
      return aDuContenu(i.dispersion)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasAssezDeTours };

    case 'tour-ideal':
      return aDuContenu(i.ideal_lap)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDeChrono };

    case 'flow':
      return e.nbPointsFlow > 0
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDInertiel };

    case 'transfert':
      return aDuContenu(i.load_transfer)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDeGyroscope };

    default:
      return { key, etat: 'absent', raison: RAISONS.aucuneMesure };
  }
}

/**
 * La section doit-elle s'afficher ?
 *
 * Non si aucune lecture n'a quoi que ce soit. **C'est la conséquence assumée du
 * lot** : tant que la première capture réelle n'a pas eu lieu, la section
 * entière disparaît. Elle reviendra d'elle-même à la première mesure.
 */
export function sectionAffichable(etats: Disponibilite[]): boolean {
  return etats.some((d) => d.etat === 'disponible');
}

/**
 * Un état `demo` peut-il être rendu ?
 *
 * Jamais en production. `__DEV__` est posé par React Native : vrai en
 * développement, faux dans un build de release. La garde est donc effective à
 * l'exécution, pas seulement écrite.
 */
export function productionAutorise(etat: EtatLecture): boolean {
  if (etat !== 'demo') return true;
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}
