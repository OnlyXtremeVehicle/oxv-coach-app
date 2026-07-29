/**
 * Étiquetage [M] / [D] / [I] de la banque de calculs — jalon 4, phase 4sexies.
 * Logique PURE.
 *
 * ---
 *
 * CE QUE LE DOSSIER DEMANDE
 *
 * « Socle robuste · étiquetage [M] / [D] / [I] ». Toute grandeur que
 * l'application affiche doit dire d'où elle vient — mesurée, déduite, ou
 * inférée. C'est la forme systématique de la règle fondateur : toute valeur
 * affichée trace vers une source réelle.
 *
 * ---
 *
 * CE QUI EXISTAIT, ET POURQUOI ÇA NE SUFFISAIT PAS
 *
 * `kinematics.ts` porte déjà `Origine = 'mesure' | 'derivation'`, et remplit un
 * champ `origines` sur son résultat. **Ce champ n'est lu nulle part.** Deux
 * niveaux au lieu de trois, un seul module sur sept, et aucun consommateur :
 * la garde était posée, jamais armée.
 *
 * Ce module la reprend pour la banque entière, avec le niveau qui manquait.
 *
 * ---
 *
 * LA FRONTIÈRE ENTRE [D] ET [I], QUI EST TOUTE LA DIFFICULTÉ
 *
 * Déduit et inféré se ressemblent : les deux sont calculés. La différence n'est
 * pas la complexité du calcul, c'est **ce qu'il faut supposer**.
 *
 *   [D] — le calcul n'ajoute AUCUNE hypothèse sur le monde. `∫ v dt` donne une
 *         distance parce que c'est la définition d'une distance. Si la mesure
 *         est juste, le résultat l'est.
 *
 *   [I] — le calcul suppose quelque chose qui n'a pas été mesuré, et qui peut
 *         être faux. Le tour idéal suppose que les meilleurs secteurs sont
 *         combinables ; aucun tour ne l'a jamais réalisé. Le taux
 *         d'exploitation suppose que l'enveloppe atteinte approche l'adhérence
 *         disponible ; c'est une hypothèse sur le pneu, pas une mesure.
 *
 * Une convention de seuil ne fait pas un [I]. Détecter un freinage sous −0,3 g
 * reste une déduction arithmétique sur des mesures : le seuil est un choix, pas
 * une hypothèse sur le véhicule. Il doit être NOMMÉ, ce que fait `convention`.
 *
 * ---
 *
 * POURQUOI UN REGISTRE, ET PAS UN CHAMP SUR CHAQUE RÉSULTAT
 *
 * Un champ se remplit à la main, donc s'oublie. Un registre se confronte : le
 * test `provenance.test.ts` exige que **toute grandeur exportée par la banque y
 * figure**. Une grandeur nouvelle sans étiquette fait échouer le banc — elle ne
 * peut pas atteindre un écran sans que quelqu'un ait dit d'où elle vient.
 */

/** Les trois niveaux du dossier. */
export type Provenance = 'M' | 'D' | 'I';

export interface Grandeur {
  /** Clé stable, `module.champ`. */
  cle: string;
  /** Nom affichable, en français. */
  nom: string;
  prov: Provenance;
  /**
   * D'où elle vient, en une phrase.
   *
   * Pour [M] : le canal du capteur. Pour [D] : la formule. Pour [I] :
   * **l'hypothèse**, nommée — c'est elle qui justifie le niveau.
   */
  source: string;
  /**
   * Seuil ou choix de méthode qui borne le résultat sans être une hypothèse
   * sur le monde. Absent quand il n'y en a pas.
   */
  convention?: string;
}

/**
 * LA BANQUE. Sept modules de `src/telemetry/`.
 *
 * Ordre : les mesures d'abord, puis ce qu'on en déduit, puis ce qu'on en
 * infère. C'est aussi l'ordre de confiance décroissante.
 */
export const BANQUE: readonly Grandeur[] = [
  // ---- [M] les canaux du boîtier -----------------------------------------
  {
    cle: 'sample.speed',
    nom: 'Vitesse',
    prov: 'M',
    source: 'Canal direct du RaceBox (UBX NAV-PVT, gSpeed). Le plus fiable du boîtier.',
  },
  {
    cle: 'sample.yawRate',
    nom: 'Vitesse de lacet',
    prov: 'M',
    source: 'Gyroscope du boîtier, axe Z (lacet). Canal distinct de l’accéléromètre.',
  },
  {
    cle: 'gg.gLong',
    nom: 'Accélération longitudinale mesurée',
    prov: 'M',
    source: 'Accéléromètre du boîtier, axe longitudinal. Canal brut, non filtré.',
  },
  {
    cle: 'gg.gLat',
    nom: 'Accélération latérale mesurée',
    prov: 'M',
    source: 'Accéléromètre du boîtier, axe latéral. Canal brut, non filtré.',
  },

  // ---- [D] ce qui se déduit sans rien supposer ----------------------------
  {
    cle: 'kinematics.distance',
    nom: 'Distance parcourue',
    prov: 'D',
    source: 'Intégration de la vitesse, ∫ v dt.',
    convention:
      'Intégrée depuis la vitesse et non sommée depuis les positions : la position porte un bruit qui s’accumulerait.',
  },
  {
    cle: 'kinematics.aLong',
    nom: 'Accélération longitudinale déduite',
    prov: 'D',
    source: 'Dérivée de la vitesse, dv/dt, ramenée en g.',
    convention: 'Nulle part définie aux bornes : une dérivée n’existe pas d’un seul côté.',
  },
  {
    cle: 'kinematics.aLat',
    nom: 'Accélération latérale déduite',
    prov: 'D',
    source: 'a = v × ω, depuis la vitesse et la vitesse de lacet.',
    convention: 'Absente sans gyroscope. Jamais remplacée par le canal accéléromètre.',
  },
  {
    cle: 'kinematics.curvature',
    nom: 'Courbure',
    prov: 'D',
    source: 'κ = ω / v — vitesse de lacet divisée par vitesse, en 1/m.',
    convention: 'Absente sous 0,5 m/s : à l’arrêt, le cap ne veut plus rien dire.',
  },
  {
    cle: 'resample.grid',
    nom: 'Ré-échantillonnage en distance',
    prov: 'D',
    source: 'Interpolation linéaire sur une grille de distance.',
    convention: 'En base DISTANCE, jamais en base temps : deux tours ne durent pas pareil.',
  },
  {
    cle: 'delta.cumulative',
    nom: 'Delta cumulé',
    prov: 'D',
    source: 'Différence de temps de passage à distance égale, forme MoTeC.',
    convention:
      'Se referme à zéro sur un tour comparé à lui-même — c’est le critère d’acceptation du jalon.',
  },
  {
    cle: 'braking.zones',
    nom: 'Zones de freinage',
    prov: 'D',
    source: 'Seuil sur l’accélération longitudinale déduite.',
    convention: 'Freinage retenu sous −0,3 g. Le seuil est un choix, pas une hypothèse.',
  },
  {
    cle: 'braking.dispersion',
    nom: 'Dispersion des freinages',
    prov: 'D',
    source: 'Écart-type des points de début de freinage, tour à tour.',
  },
  {
    cle: 'accel.cornerExit',
    nom: 'Sortie de virage',
    prov: 'D',
    source: 'Reprise d’accélération après le point de vitesse minimale.',
  },
  {
    cle: 'segment.segments',
    nom: 'Découpage droites / virages',
    prov: 'D',
    source: 'Seuil sur la courbure, avec hystérésis.',
    convention: 'L’hystérésis évite qu’un virage se hache en trois à la moindre oscillation.',
  },
  {
    cle: 'gg.reachedHull',
    nom: 'Enveloppe atteinte',
    prov: 'D',
    source: 'Enveloppe convexe des points (g long, g lat) réellement mesurés.',
    convention:
      'Enveloppe ATTEINTE : ce que le pilote a fait ce jour-là, pas ce que la voiture peut faire.',
  },

  // ---- [I] ce qui suppose quelque chose de non mesuré ---------------------
  {
    cle: 'delta.idealLapTime',
    nom: 'Tour idéal composé',
    prov: 'I',
    source:
      'Somme des meilleurs secteurs. **Suppose que ces secteurs sont combinables dans un même tour** — aucun tour ne l’a réalisé.',
    convention: 'À annoncer théorique partout où il s’affiche.',
  },
  {
    cle: 'gg.exploitationRate',
    nom: 'Taux d’exploitation',
    prov: 'I',
    source:
      'Rapport à l’enveloppe atteinte. **Suppose que cette enveloppe approche l’adhérence disponible** — hypothèse sur le pneu, jamais mesurée.',
  },
  {
    cle: 'gg.trailBrakingOverlap',
    nom: 'Recouvrement freinage-virage',
    prov: 'I',
    source:
      'Part du nuage en zone combinée. **Suppose que la dissociation des phases est lisible dans le nuage**, ce qui dépend du châssis.',
  },
];

/** Index par clé. */
const PAR_CLE = new Map(BANQUE.map((g) => [g.cle, g]));

export function grandeur(cle: string): Grandeur | undefined {
  return PAR_CLE.get(cle);
}

/** Étiquette courte, telle qu'elle s'affiche à côté d'un chiffre. */
export function etiquette(prov: Provenance): string {
  return `[${prov}]`;
}

/** Libellé long, pour une légende ou une infobulle. */
export function libelleProvenance(prov: Provenance): string {
  switch (prov) {
    case 'M':
      return 'Mesuré';
    case 'D':
      return 'Déduit';
    case 'I':
      return 'Inféré';
  }
}

/**
 * Une grandeur peut-elle porter un chiffre roi ?
 *
 * Non si elle est inférée. Le chiffre roi est l'unique valeur dominante d'un
 * écran ; lui donner une grandeur qui repose sur une hypothèse reviendrait à
 * présenter une supposition comme le fait principal de la séance.
 *
 * Le tour idéal peut s'afficher — il doit simplement ne pas régner.
 */
export function peutEtreChiffreRoi(cle: string): boolean {
  const g = PAR_CLE.get(cle);
  return g != null && g.prov !== 'I';
}
