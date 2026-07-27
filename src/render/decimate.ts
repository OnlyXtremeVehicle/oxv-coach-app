/**
 * Décimation d'une trace projetée.
 *
 * Socle de rendu T1, module 2. Un tour de circuit à 25 Hz produit des dizaines
 * de milliers de points ; un ruban triangulé sur cette densité coûte cher pour
 * un résultat que l'œil ne distingue pas d'une version dix fois plus légère.
 *
 * ---
 *
 * CE QUE LA DÉCIMATION NE DOIT PAS FAIRE
 *
 * Un simple seuil de distance rabote les VIRAGES. C'est exactement l'inverse de
 * ce qu'il faut : le pilote y ralentit, donc les points s'y resserrent, donc un
 * filtre par distance seule y supprime le plus de matière — précisément là où la
 * courbure porte l'information. Une épingle deviendrait un angle.
 *
 * D'où le second critère, angulaire : un point proche est conservé DÈS QUE la
 * direction change. Ligne droite à pleine vitesse, on décime franchement ;
 * épingle au ralenti, on garde presque tout.
 *
 * Les deux extrémités sont toujours conservées : une trace ne perd pas ses bouts.
 */

import { headingDelta, sceneDistance, sceneHeading, type ScenePoint } from './projection';

export interface DecimateOptions {
  /**
   * Distance minimale, en mètres, au-delà de laquelle un point est gardé sans
   * autre examen. Défaut 1,5 m — sous la précision typique d'un GPS de course,
   * donc rien de perceptible n'est perdu en ligne droite.
   */
  minDistanceM?: number;
  /**
   * Changement de cap, en degrés, à partir duquel un point proche est gardé
   * quand même. Défaut 2° — assez fin pour qu'une courbe reste une courbe.
   */
  minHeadingDeg?: number;
}

const DEFAUT_DISTANCE_M = 1.5;
const DEFAUT_CAP_DEG = 2;

/**
 * Rend un sous-ensemble des points d'entrée, dans l'ordre, extrémités comprises.
 *
 * Pure : l'entrée n'est pas modifiée, et les objets rendus sont ceux d'origine
 * — on filtre, on ne recopie pas. Le type générique laisse passer les charges
 * utiles attachées aux points (vitesse, accélération, horodatage) sans que ce
 * module ait à les connaître.
 */
export function decimate<T extends ScenePoint>(
  points: readonly T[],
  options: DecimateOptions = {}
): T[] {
  const minDistance = options.minDistanceM ?? DEFAUT_DISTANCE_M;
  const minHeading = options.minHeadingDeg ?? DEFAUT_CAP_DEG;

  // Deux points ou moins : il n'y a rien à décimer, et surtout rien à perdre.
  if (points.length <= 2) return [...points];

  const gardes: T[] = [points[0]];
  let dernierGarde = points[0];

  // Direction de référence au dernier point gardé.
  //
  // Elle est AMORCÉE sur le premier segment brut, et non laissée nulle jusqu'au
  // premier point retenu par la distance : sans cet amorçage, un seuil de
  // distance élevé empêchait le critère angulaire de se déclencher une seule
  // fois — la courbure n'était plus vue du tout. Reste `null` uniquement si les
  // premiers points sont confondus, auquel cas il n'y a réellement aucun cap.
  let capCourant: number | null = null;
  for (let i = 1; i < points.length && capCourant === null; i++) {
    capCourant = sceneHeading(points[0], points[i]);
  }

  // La dernière position est traitée à part : elle est gardée quoi qu'il arrive.
  for (let i = 1; i < points.length - 1; i++) {
    const candidat = points[i];
    const d = sceneDistance(dernierGarde, candidat);

    let garder = d >= minDistance;

    if (!garder && capCourant !== null) {
      const cap = sceneHeading(dernierGarde, candidat);
      // `cap` est nul si le candidat est confondu avec le dernier gardé : il
      // n'apporte alors ni distance ni direction, on le laisse tomber.
      if (cap !== null && headingDelta(capCourant, cap) >= minHeading) {
        garder = true;
      }
    }

    if (garder) {
      const cap = sceneHeading(dernierGarde, candidat);
      if (cap !== null) capCourant = cap;
      gardes.push(candidat);
      dernierGarde = candidat;
    }
  }

  gardes.push(points[points.length - 1]);
  return gardes;
}

/**
 * Longueur cumulée d'une trace projetée, en mètres.
 *
 * Sert à mesurer ce que la décimation a coûté : si la longueur s'effondre, c'est
 * que la géométrie a été mutilée, pas allégée.
 */
export function traceLength(points: readonly ScenePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += sceneDistance(points[i - 1], points[i]);
  }
  return total;
}
