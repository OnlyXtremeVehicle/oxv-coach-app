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

import type { IdealLap, SessionInsights } from '@/circuit/sessionInsights';
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
/**
 * LES RAISONS SONT DES MOTS-CLÉS — corrigé le 01/09/2026.
 *
 * Elles s'affichent sur l'écran de séance, qui est une FEUILLE DE DONNÉES. La
 * règle y interdit la phrase, et quatre des sept en étaient : « Aucune mesure
 * sur cette séance », « Pas assez de tours pour comparer », « Chronos de
 * secteur non calculés », « Lecture non calculée pour cette séance ».
 *
 * `check-doctrine` ne pouvait pas les voir : il lit les fichiers `.tsx`, et ces
 * chaînes vivent dans un `.ts` d'où elles voyagent jusqu'à l'écran. C'est la
 * même limite que pour les soixante-cinq noms du catalogue, et la même réponse
 * — la règle s'applique à la SOURCE, tenue par `libellesDeService.guard`.
 *
 * Une seule formulation par cause, toujours : deux lectures absentes pour la
 * même raison le disent avec les mêmes mots.
 */
export const RAISONS = {
  /**
   * LE MOTEUR N'A PAS TOURNÉ — ce qui n'est PAS « aucune mesure ».
   *
   * Les quatre lectures ci-dessous naissent de `session_insights`, une table
   * écrite par une fonction serveur. Quand la ligne manque, on ne sait RIEN de
   * ce qu'elle aurait contenu : ni s'il y avait des virages, ni si le
   * gyroscope a répondu.
   *
   * Les raisons spécifiques étaient donc servies à tort. Sur la séance de
   * référence — 26 999 trames, gyroscope présent sur 100 % d'entre elles —
   * le pilote lisait « Gyroscope absent » et « Aucune mesure sur cette
   * séance ». Deux affirmations fausses, tirées d'une absence de calcul.
   *
   * Une raison qui désigne un capteur doit venir d'une mesure du capteur.
   */
  nonCalcule: 'LECTURE NON CALCULÉE',
  aucuneMesure: 'AUCUNE MESURE',
  pasDeVirage: 'AUCUN VIRAGE EXPLOITABLE',
  pasAssezDeTours: 'TOURS INSUFFISANTS',
  pasDeChrono: 'CHRONOS SECTEUR · NON CALCULÉS',
  pasDInertiel: 'SIGNAL INERTIEL ABSENT',
  pasDeGyroscope: 'GYROSCOPE ABSENT',
} as const;

/** Un enregistrement de virage est-il exploitable ? */
function aDuContenu(bloc: unknown): boolean {
  if (bloc == null) return false;
  if (Array.isArray(bloc)) return bloc.length > 0;
  if (typeof bloc === 'object') return Object.keys(bloc as object).length > 0;
  return false;
}

/**
 * LE BLOC `ideal_lap` PORTE-T-IL LES CHRONOS QUE LA VUE LIT ?
 *
 * `aDuContenu` suffisait aux autres blocs, qui sont des enregistrements plats.
 * Pas à celui-ci. Le moteur de production `compute-session-insights-v3` écrit :
 *
 *     ideal_lap: { theoretical_day: {…}, theoretical_record: {…} }
 *
 * — une forme IMBRIQUÉE, quand `IdealLap` et `TourIdealViz` lisent
 * `ideal_time_s` / `real_best_s` À PLAT. Compter les clés voyait donc deux
 * clés, déclarait la lecture disponible, et la vue ouvrait sur « Données
 * insuffisantes sur cette séance ».
 *
 * C'est exactement la porte fermée que ce module existe pour supprimer, et
 * elle vit sur le chemin de production. On exige ici ce que la vue exige :
 * deux chronos finis, à plat. Le reste est absent, et le dit.
 *
 * (La forme imbriquée n'est PAS lue au passage : la rattacher serait un choix
 * de produit — quel potentiel montrer, celui du jour ou celui du record — qui
 * revient au fondateur, pas à cette liste blanche.)
 */
function chronosLisibles(bloc: unknown): boolean {
  if (bloc == null || typeof bloc !== 'object') return false;
  const b = bloc as Partial<IdealLap>;
  return (
    typeof b.ideal_time_s === 'number' &&
    Number.isFinite(b.ideal_time_s) &&
    typeof b.real_best_s === 'number' &&
    Number.isFinite(b.real_best_s)
  );
}

/**
 * Les deux lectures qui ne lisent PAS `session_insights`. Elles comptent des
 * points venus des trames ; l'absence d'insights ne les concerne pas.
 */
export const SANS_INSIGHTS: readonly ReadingKey[] = ['gg', 'flow'];

/**
 * État d'UNE lecture.
 *
 * Aucune lecture n'est `disponible` par défaut : chacune doit prouver qu'elle a
 * de quoi. C'est la même discipline que le fail-closed ailleurs dans ce dépôt —
 * l'absence de preuve n'est pas une preuve d'absence de problème.
 */
export function etatLecture(key: ReadingKey, e: EntreesLectures): Disponibilite {
  const i = e.insights;

  // LE PORTILLON NE FERME QUE CE QU'IL GOUVERNE — corrige le 01/09/2026.
  //
  // Il sortait AVANT le switch : `insights` nul fermait les six lectures. Or
  // deux d'entre elles ne lisent jamais `insights`. Le diagramme G-G compte des
  // points (G long, G lat) et la coherence du flow des points de jerk : les uns
  // et les autres viennent des trames, que la seance porte des insights ou non.
  //
  // Sur la seance de reference — 26 999 trames, `session_insights` vide — le
  // pilote lisait donc « Aucune mesure sur cette seance » devant deux lectures
  // que ses propres trames alimentaient. C'est le contresens exact que ce
  // module existe pour supprimer, une porte fermee de plus.
  if (i == null && !SANS_INSIGHTS.includes(key)) {
    return { key, etat: 'absent', raison: RAISONS.nonCalcule };
  }

  switch (key) {
    case 'anatomie':
      return i != null && aDuContenu(i.anatomy)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDeVirage };

    case 'gg':
      return e.nbPointsGG > 0
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDInertiel };

    case 'dispersion':
      return i != null && aDuContenu(i.dispersion)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasAssezDeTours };

    case 'tour-ideal':
      return i != null && chronosLisibles(i.ideal_lap)
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDeChrono };

    case 'flow':
      return e.nbPointsFlow > 0
        ? { key, etat: 'disponible' }
        : { key, etat: 'absent', raison: RAISONS.pasDInertiel };

    case 'transfert':
      return i != null && aDuContenu(i.load_transfer)
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
