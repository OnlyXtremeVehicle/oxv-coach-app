/**
 * Les cinq niveaux de restitution — jalon 4, phase 4septies. Logique PURE.
 *
 * ---
 *
 * CE QUE LE FONDATEUR A TRANCHÉ
 *
 * *« Cinq niveaux de restitution de télémétrie différents, du moins technique
 * au plus technique. »* Le plan de montage demandait « cinq niveaux ouverts par
 * la donnée · un niveau fermé reste visible, éteint, avec son compteur », sans
 * les nommer. L'axe est celui-ci : la TECHNICITÉ DE LA LECTURE.
 *
 * L'ordre suit celui du dossier de conception, qui décrit la séquence stable du
 * coach — *delta → vitesse → dérivés → segmentation par virage* — et son socle
 * robuste à 25 Hz.
 *
 * ---
 *
 * CE NE SONT PAS DES PALIERS. C'EST LA PROPRIÉTÉ CENTRALE DU MODULE.
 *
 * « Cinq niveaux qui s'ouvrent » est à un cheveu d'une mécanique de progression,
 * que la doctrine interdit — aucun classement, aucun score, aucune récompense.
 *
 * Ce qui empêche le glissement n'est pas une formulation prudente, c'est une
 * propriété structurelle : **chaque niveau s'ouvre sur SA condition, sans aucun
 * égard aux autres.** Il n'y a pas de chaîne. Avec deux tours et un gyroscope,
 * `phases` et `delta` sont ouverts pendant que `regularite`, qui demande trois
 * tours, reste fermé.
 *
 * On ne peut donc pas les gravir, et le test le vérifie. Le rang n'ordonne que
 * l'affichage ; il ne conditionne rien, et il ne s'affiche jamais sous la forme
 * « 3 sur 5 ».
 *
 * ---
 *
 * CE QU'UN COMPTEUR A LE DROIT DE DIRE
 *
 * Un fait sur la donnée présente, jamais un objectif. « Deux tours
 * chronométrés. Cette lecture en demande trois. » énonce l'état et le besoin ;
 * une barre qui se remplit, un pourcentage ou un « 2/3 » isolé énoncent une
 * progression vers une récompense.
 *
 * Pour `phases` et `enveloppe`, le compteur nomme **le canal absent**, pas le
 * pilote. Un niveau fermé faute de gyroscope est fermé par le boîtier — et le
 * dire ainsi retire toute lecture méritocratique.
 */

import { ECART_LONGUEUR_TOLERE } from './adaptation';

/** Clé stable d'un niveau. */
/**
 * LES NOMS ONT ÉTÉ TRADUITS LE 14/08/2026.
 *
 * Les CLÉS (`delta`, `enveloppe`) restent techniques : elles ne sont jamais
 * affichées, et les renommer aurait cassé des données persistées pour un gain
 * nul. Ce sont les `nom` que le pilote lit, et deux d'entre eux parlaient une
 * langue qui n'est pas la sienne :
 *
 *   « Le delta et la trace » → « L'écart entre vos tours »
 *   « L'enveloppe »          → « Les appuis de la voiture »
 *
 * Dernier verrou du jalon 5 : *« QDI et vocabulaire technique »*. Le QDI avait
 * été traité le 13/08 ; le vocabulaire, jamais.
 */
export type CleNiveau = 'chrono' | 'regularite' | 'delta' | 'phases' | 'enveloppe';

export interface Niveau {
  cle: CleNiveau;
  /**
   * Rang de technicité, 1 = le moins technique. **N'ordonne que l'affichage.**
   * Ne conditionne aucune ouverture, et ne s'affiche jamais tel quel.
   */
  rang: 1 | 2 | 3 | 4 | 5;
  /** Titre affichable. Nomme le sujet, jamais le rang. */
  nom: string;
  /** Ce qu'on y lit, en une phrase. Descriptif. */
  contenu: string;
  /** Ce que la lecture demande de savoir. Sert à situer, pas à décourager. */
  lecture: string;
  /** Clés du registre de provenance que ce niveau met à l'écran. */
  grandeurs: readonly string[];
}

/**
 * Nombre de tours sous lequel une dispersion ne veut rien dire.
 *
 * Le dossier est net : *« un seul tour ne prouve rien »*, et il faut un `n`
 * suffisant pour un coefficient de variation stable. Trois est le minimum pour
 * qu'une série ait à la fois un milieu et un étalement — c'est une convention,
 * pas une mesure, et elle est nommée pour cela.
 */
export const TOURS_POUR_DISPERSION = 3;

/**
 * Trames minimales pour qu'un nuage soit un nuage.
 *
 * Cent points, soit quatre secondes à vingt-cinq hertz. En deçà, tracer une
 * enveloppe ou segmenter un tour reviendrait à dessiner une forme sur une
 * poignée de points et à la présenter comme une signature.
 */
export const TRAMES_POUR_NUAGE = 100;

/**
 * LES CINQ NIVEAUX, du moins technique au plus technique.
 *
 * Chacun ne cite que des grandeurs enregistrées au registre de provenance :
 * `niveaux.test.ts` le vérifie, pour qu'aucun niveau ne puisse afficher une
 * valeur dont personne n'a dit d'où elle vient.
 */
export const NIVEAUX: readonly Niveau[] = [
  {
    cle: 'chrono',
    rang: 1,
    nom: 'Le chrono',
    contenu: 'Vos temps au tour, le nombre de tours bouclés, la vitesse la plus haute.',
    lecture: 'Rien à savoir. Ce sont des faits de chronométrie.',
    grandeurs: ['laps.lapTime', 'sample.speed'],
  },
  {
    cle: 'regularite',
    rang: 2,
    nom: 'La régularité',
    contenu: 'La façon dont vos tours se ressemblent — leur milieu et leur étalement.',
    lecture: 'Une notion de dispersion suffit. Aucune connaissance du tracé.',
    grandeurs: ['laps.lapTime'],
  },
  /**
   * Le freinage est ICI et non au niveau suivant, et ce n'est pas un détail de
   * rangement : `detectBrakingZones` ne consomme que l'accélération
   * longitudinale, elle-même dérivée de la seule VITESSE. Le placer derrière le
   * gyroscope cacherait une lecture disponible sur toute séance.
   *
   * C'est aussi l'ordre du dossier, qui décrit le coach lisant la FORME de la
   * trace de vitesse — la « crosse de hockey » du freinage dégressif — juste
   * après le delta et bien avant les dérivés gyroscopiques.
   */
  {
    cle: 'delta',
    rang: 3,
    nom: 'L’écart entre vos tours',
    contenu:
      'Où le temps se fait le long du tour, et la forme de votre trace de vitesse — freinages compris.',
    lecture: 'Se lit en base distance, jamais en base temps. La pente dit le rythme.',
    grandeurs: [
      'delta.cumulative',
      'resample.grid',
      'kinematics.distance',
      'kinematics.aLong',
      'braking.zones',
      'braking.dispersion',
    ],
  },
  /**
   * Tout ce qui reste ici dépend de la COURBURE, donc du gyroscope : le
   * découpage droites/virages seuille `κ`, le point le plus lent se situe dans
   * un virage qu'il a fallu délimiter, et la relance s'analyse depuis ces
   * mêmes bornes. Sans lacet, ce niveau n'a rien à montrer — au sens propre.
   */
  {
    cle: 'phases',
    rang: 4,
    nom: 'Les phases du virage',
    contenu: 'Le découpage en droites et virages, le point le plus lent, la relance.',
    lecture: 'Demande le vocabulaire du virage et les seuils qui le découpent.',
    grandeurs: ['kinematics.curvature', 'kinematics.aLat', 'segment.segments', 'accel.cornerExit'],
  },
  {
    cle: 'enveloppe',
    rang: 5,
    nom: 'Les appuis de la voiture',
    contenu: 'Le nuage des accélérations, et la forme qu’il prend sur la séance.',
    lecture: 'La lecture la plus technique. La forme du nuage porte plus que ses extrêmes.',
    grandeurs: ['gg.gLat', 'gg.gLong', 'gg.reachedHull', 'gg.exploitationRate'],
  },
];

/** Index par clé. */
const PAR_CLE = new Map(NIVEAUX.map((n) => [n.cle, n]));

export function niveau(cle: CleNiveau): Niveau | undefined {
  return PAR_CLE.get(cle);
}

/**
 * Ce que la séance contient réellement. **Des faits comptés, pas des jugements.**
 *
 * Se construit depuis les trames et les tours par `etatDepuisSeance`.
 */
export interface EtatSeance {
  /** Tours chronométrés sur la séance. */
  toursChronometres: number;
  /** Tours dont la longueur est voisine d'au moins un autre tour. */
  toursComparables: number;
  /** Trames portant une vitesse de lacet exploitable. */
  tramesAvecLacet: number;
  /** Trames portant les deux accélérations exploitables. */
  tramesAvecAcceleration: number;
}

/** Un niveau est ouvert, ou fermé avec le fait qui le ferme. */
export type EtatNiveau = { ouvert: true } | { ouvert: false; compteur: string };

/** Petits nombres en toutes lettres : « 2/3 » se lit comme une jauge, pas eux. */
const MOTS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq'] as const;
function enLettres(n: number): string {
  return n >= 0 && n < MOTS.length ? MOTS[n] : String(n);
}

function tours(n: number): string {
  if (n === 0) return 'Aucun tour chronométré';
  if (n === 1) return 'Un tour chronométré';
  const mot = enLettres(n);
  return `${mot.charAt(0).toUpperCase()}${mot.slice(1)} tours chronométrés`;
}

/**
 * L'état d'un niveau, depuis ce que la séance contient.
 *
 * **Aucune condition ne regarde un autre niveau.** C'est ce qui empêche la
 * lecture en paliers, et `niveaux.test.ts` le vérifie en construisant une
 * séance où un niveau haut est ouvert sous un niveau bas fermé.
 */
export function etatNiveau(cle: CleNiveau, seance: EtatSeance): EtatNiveau {
  switch (cle) {
    case 'chrono':
      return seance.toursChronometres >= 1
        ? { ouvert: true }
        : { ouvert: false, compteur: 'Aucun tour chronométré sur cette séance.' };

    case 'regularite':
      return seance.toursChronometres >= TOURS_POUR_DISPERSION
        ? { ouvert: true }
        : {
            ouvert: false,
            compteur: `${tours(seance.toursChronometres)}. Cette lecture en demande trois.`,
          };

    case 'delta':
      return seance.toursComparables >= 2
        ? { ouvert: true }
        : {
            ouvert: false,
            compteur:
              seance.toursComparables === 1
                ? 'Un seul tour comparable. Cette lecture en demande deux qui couvrent la même distance.'
                : 'Aucun tour comparable. Cette lecture en demande deux qui couvrent la même distance.',
          };

    // Fermé par le BOÎTIER, pas par le pilote — et le compteur le dit.
    case 'phases':
      if (seance.tramesAvecLacet === 0) {
        return { ouvert: false, compteur: 'Vitesse de lacet absente des trames de cette séance.' };
      }
      return seance.tramesAvecLacet >= TRAMES_POUR_NUAGE
        ? { ouvert: true }
        : {
            ouvert: false,
            compteur: 'Trop peu de trames avec vitesse de lacet pour découper le tour.',
          };

    case 'enveloppe':
      if (seance.tramesAvecAcceleration === 0) {
        return { ouvert: false, compteur: 'Accélérations absentes des trames de cette séance.' };
      }
      return seance.tramesAvecAcceleration >= TRAMES_POUR_NUAGE
        ? { ouvert: true }
        : { ouvert: false, compteur: 'Trop peu de trames avec accélérations pour un nuage.' };
  }
}

/** Les cinq états, dans l'ordre d'affichage. */
export function etatsNiveaux(seance: EtatSeance): { niveau: Niveau; etat: EtatNiveau }[] {
  return NIVEAUX.map((n) => ({ niveau: n, etat: etatNiveau(n.cle, seance) }));
}

/** Ce qu'une trame doit porter pour être comptée. Volontairement minimal. */
export interface TrameComptable {
  gLat: number | null;
  gLong: number | null;
  yawRateRadS: number | null;
}

/**
 * Ce qu'un tour doit porter pour être compté.
 *
 * **Un tour de sortie ou de rentrée aux stands n'est pas un tour chronométré.**
 * La base en porte la preuve : son unique ligne `laps` est un `is_outlap` de
 * vingt-deux millisecondes à 1,39 km/h sur zéro mètre. Compter cette ligne
 * ouvrirait le chrono et lui ferait afficher vingt-deux millisecondes en
 * chiffre roi — une valeur réelle au sens où elle est en base, et fausse au
 * sens où ce n'est pas un tour.
 */
export interface TourComptable {
  /** Longueur exploitable, en mètres. `null` si non mesurable. */
  longueurM: number | null;
  /** Tour de sortie de stand — `laps.is_outlap`. */
  estOutlap?: boolean;
  /** Tour de rentrée aux stands — `laps.is_inlap`. */
  estInlap?: boolean;
}

function fini(x: number | null): boolean {
  return x !== null && Number.isFinite(x);
}

/**
 * Combien de tours ont une longueur voisine d'au moins un autre.
 *
 * Un tour isolé — une sortie de stand, un tour d'installation, un tour
 * interrompu — n'est comparable à rien, et le comparer produirait un delta qui
 * diverge. La tolérance est celle d'`adaptation`, pas une seconde copie du
 * même dix pour cent.
 */
export function compteToursComparables(longueurs: readonly (number | null)[]): number {
  const valides = longueurs.filter((l): l is number => l !== null && Number.isFinite(l) && l > 0);
  let n = 0;
  for (let i = 0; i < valides.length; i++) {
    for (let j = 0; j < valides.length; j++) {
      if (i === j) continue;
      const ref = Math.max(valides[i], valides[j]);
      if (Math.abs(valides[i] - valides[j]) / ref <= ECART_LONGUEUR_TOLERE) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Un tour compte-t-il comme chronométré ? */
export function estTourChronometre(t: TourComptable): boolean {
  return t.estOutlap !== true && t.estInlap !== true;
}

/** Ce que les canaux inertiels rendent, une fois comptés. */
export interface ComptesCanaux {
  tramesAvecLacet: number;
  tramesAvecAcceleration: number;
}

/**
 * Compte les canaux présents sur un lot de trames déjà chargées.
 *
 * **Ne compte que le mesuré.** Une trame dont le gyroscope n'a rien rendu ne
 * compte pas, et ne compte pas non plus pour zéro : elle n'entre nulle part.
 */
export function compteCanaux(trames: readonly TrameComptable[]): ComptesCanaux {
  let lacet = 0;
  let accel = 0;
  for (const t of trames) {
    if (fini(t.yawRateRadS)) lacet++;
    // Le nuage demande les DEUX axes : un point à une seule coordonnée n'est
    // pas un point du plan (g_lat, g_long).
    if (fini(t.gLat) && fini(t.gLong)) accel++;
  }
  return { tramesAvecLacet: lacet, tramesAvecAcceleration: accel };
}

/**
 * L'état d'une séance depuis ce qu'elle contient réellement.
 *
 * Les comptes de canaux sont passés SÉPARÉMENT des tours, parce qu'ils
 * s'obtiennent le plus souvent en comptant côté base plutôt qu'en rapatriant
 * les trames : l'écran de séance atteint déjà `loadSessionFrames` cinq fois par
 * ouverture, et une sixième lecture pour compter serait indéfendable.
 *
 * ---
 *
 * COMPTER, JAMAIS LIRE `total_frames`
 *
 * La colonne dénormalisée `telemetry_sessions.total_frames` se trompe dans les
 * deux sens sur la base d'aujourd'hui : dix séances annoncent des trames
 * qu'elles n'ont pas, et la seule qui en porte cinquante-trois affiche zéro.
 * Elle n'est réconciliée qu'au statut `completed`, donc jamais pour une séance
 * interrompue. Un portillon posé dessus ouvrirait un niveau vide, ou fermerait
 * un niveau qui a de quoi s'ouvrir.
 */
export function etatDepuisSeance(
  tours: readonly TourComptable[],
  canaux: ComptesCanaux
): EtatSeance {
  const chronometres = tours.filter(estTourChronometre);
  return {
    toursChronometres: chronometres.length,
    toursComparables: compteToursComparables(chronometres.map((t) => t.longueurM)),
    tramesAvecLacet: Math.max(0, Math.trunc(canaux.tramesAvecLacet)),
    tramesAvecAcceleration: Math.max(0, Math.trunc(canaux.tramesAvecAcceleration)),
  };
}
