/**
 * CARTE DES OPPORTUNITÉS — M07 sur le tracé. Logique PURE.
 * Sans React, sans react-native, sans Supabase : testable seule (ts-jest, node).
 *
 * ===========================================================================
 * CE QUE CE MODULE FAIT, ET CE QU'IL REFUSE DE FAIRE
 * ===========================================================================
 *
 * `opportunitesLogic` (lot 2) découpe le tour en segments et donne, pour
 * chacun, l'écart local SIGNÉ réconcilié au delta total. Il dit COMBIEN et OÙ
 * — en mètres le long du tour. `projectionCurviligne` (lot 5) sait poser une
 * abscisse en mètres sur la polyligne du tracé.
 *
 * Ce module est le chaînon de couleur entre les deux : il convertit les
 * segments en PORTIONS DE TRACÉ à peindre, et il écarte tout ce qui ne mérite
 * pas une couleur. Il ne calcule aucun écart, il n'en corrige aucun.
 *
 * ===========================================================================
 * TROIS RAISONS DE NE RIEN PEINDRE — et elles sont comptées, pas tues
 * ===========================================================================
 *
 * 1. **La lecture entière est fragile.** Quand la confiance rendue par le
 *    module amont vaut `faible` — trop de pas écartés par le delta —, la
 *    fonction rend `null`. Une carte de couleurs posée sur une mesure trouée
 *    serait un verdict tiré d'un doute.
 *
 * 2. **La zone est fragile, elle seule.** Les zones en confiance faible du
 *    lot 1 (`confianceLogic`) sont déjà atténuées sur le tracé. Un segment qui
 *    les recoupe n'est PAS peint : on n'écrit pas une couleur d'écart par
 *    dessus un voile qui dit « ici, la mesure tient mal ».
 *
 * 3. **L'écart n'a rien à dire.** Sous `SEUIL_ECART_PEINT_S`, le trait reste
 *    nu. C'est la règle du rôle POLARITÉ de la grammaire de restitution : « le
 *    zéro doit se lire *rien* ». Un dégradé continu autour de zéro ferait d'un
 *    bruit de mesure une nuance.
 *
 * Chaque mise à l'écart est COMPTÉE dans le résultat, pour que l'écran puisse
 * dire pourquoi une portion de tracé reste nue au lieu de laisser croire qu'il
 * ne s'y est rien passé.
 *
 * ===========================================================================
 * LA COULEUR EST EMPRUNTÉE, PAS INVENTÉE
 * ===========================================================================
 *
 * `src/ui/v2/grammaireViz.ts` pose depuis le 15/08/2026 les quatre rôles
 * qu'une couleur peut jouer sur une donnée. Le troisième — POLARITÉ, « un
 * écart signé (delta, gagné/perdu), deux pôles chaud/froid autour d'un NEUTRE
 * GRIS » — a été écrit exactement pour ceci, et n'avait aucun consommateur.
 * On le branche ; on ne recrée pas une échelle à côté.
 *
 * Ce que cela garantit, et qui est demandé au lot :
 *   — le ROUGE DE MARQUE `#C8102E` n'entre pas : le pôle chaud est `#D95926`,
 *     et la grammaire refuse au rouge de marque tout rôle de donnée (invariant
 *     déjà tenu et testé par `grammaireViz.test.ts`) ;
 *   — l'OR n'entre pas : ni `#FFB703` (chrono / record) ni `#C4A459`
 *     (Heritage) ne figurent dans les pôles ;
 *   — les CINQ COULEURS QDI n'entrent pas : elles nomment des branches de
 *     signature, pas un écart de temps.
 *
 * L'écart perçu entre les deux pôles a été mesuré le 14/08/2026 — ΔE 31,8 en
 * vision normale, 26,8 sous protanopie — donc la polarité reste lisible pour
 * un daltonien, ce qu'aucun couple rouge/vert ne garantirait.
 *
 * ===========================================================================
 * POURQUOI ON PASSE PAR LA FRACTION DE TOUR
 * ===========================================================================
 *
 * Les segments sont bornés sur la GRILLE DU DELTA, dont la longueur est
 * dérivée de la vitesse intégrée. Le tracé, lui, a la longueur de sa
 * POLYLIGNE. Les deux ne coïncident jamais exactement — quelques mètres
 * d'écart suffisent à faire sortir la dernière borne du tracé, et
 * `projectionCurviligne` rendrait alors `null` (sa règle n° 1 : hors du tour,
 * rien).
 *
 * On convertit donc par FRACTION DE TOUR, la coordonnée déjà partagée partout
 * dans ce dépôt entre télémétrie et tracé : `segment_analysis` situe ses
 * virages en `startProgress` / `endProgress`, `reperesDepuisSegments` les
 * ramène en mètres sur la grille du delta, `pointAtRatio` les repose sur la
 * polyligne. On reproduit cette convention, on n'en invente pas une seconde.
 *
 * Ce qu'elle suppose est nommé : que les deux parcours couvrent le même tour
 * et le parcourent dans le même sens. C'est déjà l'hypothèse sous les
 * pastilles de virages posées sur ce même tracé.
 */

import type { Confiance } from '@/features/data/progressionLogic';
import type { SegmentEcart } from '@/features/data/opportunitesLogic';
import { couleurDelta, POLES_DELTA } from '@/ui/v2/grammaireViz';

/** Estampille du calcul : toute évolution de méthode est un changement tracé. */
export const VERSION_CARTE_OPPORTUNITES = 'carte-opportunites-1.0.0';

/**
 * Bande morte de la peinture, en secondes — À VALIDER SUR PISTE.
 *
 * Sous cet écart local absolu, la portion reste NUE : le trait du tracé s'y lit
 * tel quel, et le pilote n'y voit aucune couleur à interpréter. Vingt
 * millisecondes sur un segment d'une centaine de mètres tiennent dans le bruit
 * d'un GPS à 25 Hz recalé par distance ; les peindre reviendrait à colorer
 * l'incertitude de la mesure.
 *
 * C'est une CONVENTION DE SEUIL, pas une hypothèse sur le véhicule : elle
 * décide de ce qu'on montre, jamais de ce qu'on calcule.
 */
export const SEUIL_ECART_PEINT_S = 0.02;

/**
 * Étendue minimale d'une portion peinte, en mètres — À VALIDER SUR PISTE.
 *
 * Alignée sur `ETENDUE_MIN_PORTION_M` de `projectionCurviligne` (un
 * millimètre) : en deçà, une portion n'a pas d'étendue et la projection
 * rendrait `null`. La valeur est reprise ici plutôt qu'importée pour que ce
 * module reste sans dépendance géométrique — il ne projette rien, il borne.
 */
export const ETENDUE_MIN_PEINTE_M = 1e-3;

/** Une zone du tracé, bornée en mètres le long de la polyligne. */
export interface ZoneTraceM {
  debutM: number;
  finM: number;
}

/** Une portion de tracé à peindre, et l'écart qu'elle porte. */
export interface PortionEcart {
  /** Entrée de la portion, en mètres le long de la POLYLIGNE du tracé. */
  debutM: number;
  /** Sortie de la portion, en mètres le long de la polyligne. */
  finM: number;
  /**
   * Écart local signé du segment, en secondes — repris tel quel du module
   * amont. Positif = le tour lu y rend du temps.
   */
  ecartLocalS: number;
  /** Couleur du rôle POLARITÉ. Jamais le rouge de marque, jamais l'or. */
  couleur: string;
}

export interface CarteOpportunites {
  version: string;
  /** Portions à peindre, dans l'ORDRE DE LA PISTE (et non du potentiel). */
  portions: PortionEcart[];
  /** Segments laissés nus parce que leur écart tient dans la bande morte. */
  sousSeuil: number;
  /** Segments laissés nus parce qu'ils recoupent une zone en confiance faible. */
  ecartesConfianceZone: number;
  /** Segments laissés nus parce que leurs bornes ne décrivent pas une étendue. */
  ecartesGeometrie: number;
}

/** Deux intervalles se recouvrent-ils sur une longueur non nulle ? */
function chevauche(a: ZoneTraceM, b: ZoneTraceM): boolean {
  return a.debutM < b.finM && a.finM > b.debutM;
}

/**
 * Les portions de tracé à peindre pour un tour comparé.
 *
 * `null` — et AUCUNE portion — dans trois cas où peindre serait mentir :
 * confiance de lecture `faible`, longueur de tour inexploitable, longueur de
 * tracé inexploitable. Un tableau vide dirait « rien à signaler » ; `null` dit
 * « on ne sait pas ».
 */
export function carteOpportunites(entree: {
  /** Segments d'écart local, tels que `calculeOpportunites` les rend. */
  segments: readonly SegmentEcart[];
  /** Longueur du tour sur la grille du delta, en mètres. */
  longueurTourM: number;
  /** Longueur de la polyligne du tracé, en mètres (fermeture incluse). */
  longueurTraceM: number;
  /** Confiance de lecture du delta, reprise du module amont. */
  confiance: Confiance;
  /** Zones du tracé en confiance de mesure faible, en mètres de polyligne. */
  zonesFaiblesM: readonly ZoneTraceM[];
}): CarteOpportunites | null {
  const { segments, longueurTourM, longueurTraceM, confiance, zonesFaiblesM } = entree;

  // Une lecture fragile ne porte pas de verdict de couleur.
  if (confiance === 'faible') return null;
  if (!Number.isFinite(longueurTourM) || longueurTourM <= 0) return null;
  if (!Number.isFinite(longueurTraceM) || longueurTraceM <= 0) return null;

  const portions: PortionEcart[] = [];
  let sousSeuil = 0;
  let ecartesConfianceZone = 0;
  let ecartesGeometrie = 0;

  /** Fraction de tour → mètres de polyligne, serrée sur le tracé. */
  const surLeTrace = (m: number): number =>
    Math.min(Math.max((m / longueurTourM) * longueurTraceM, 0), longueurTraceM);

  for (const segment of segments) {
    const couleur = couleurDelta(segment.ecartLocalS, SEUIL_ECART_PEINT_S);
    if (couleur === POLES_DELTA.neutre) {
      sousSeuil++;
      continue;
    }

    if (!Number.isFinite(segment.debutM) || !Number.isFinite(segment.finM)) {
      ecartesGeometrie++;
      continue;
    }

    // Le serrage ci-dessus empêche qu'une grille du delta un peu plus longue
    // que la polyligne fasse sortir la dernière portion du tracé.
    const debutM = surLeTrace(segment.debutM);
    const finM = surLeTrace(segment.finM);
    if (finM - debutM < ETENDUE_MIN_PEINTE_M) {
      ecartesGeometrie++;
      continue;
    }

    const portion: PortionEcart = { debutM, finM, ecartLocalS: segment.ecartLocalS, couleur };
    if (zonesFaiblesM.some((zone) => chevauche(portion, zone))) {
      ecartesConfianceZone++;
      continue;
    }

    portions.push(portion);
  }

  // Ordre de la PISTE : la carte se lit en roulant, pas en classement. Le
  // module amont trie par potentiel décroissant — c'est son ordre à lui, et il
  // reste juste là où il sert, dans la liste sous la courbe.
  portions.sort((a, b) => a.debutM - b.debutM);

  return {
    version: VERSION_CARTE_OPPORTUNITES,
    portions,
    sousSeuil,
    ecartesConfianceZone,
    ecartesGeometrie,
  };
}
