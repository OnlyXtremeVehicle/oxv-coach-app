/**
 * Géométrie trackviz — projection GPS sur tracé, map-matching, phases.
 *
 * Adapté du module partagé par Gabin en sem 11. Logique préservée,
 * vocabulaire et tokens adaptés. Aucun verbe directif ici (module
 * géométrique pur).
 */

import { haversineDistance } from '@/utils/geo';

import type { SegmentPhase, TrackVizSegmentDefinition } from './types';

export interface TrackGeometry {
  /** Points GPS du tracé. */
  trackPoints: { lat: number; lon: number }[];
  /** Cumulé des distances depuis le départ pour chaque point. */
  cumulativeDistances: number[];
  /** Longueur totale du tracé en mètres. */
  totalLengthM: number;
  /**
   * Distance entre le PREMIER et le DERNIER point du tracé, en mètres.
   *
   * Un circuit est un anneau : le tour se referme. Quatre des six tracés en
   * base portent ce bouclage explicitement — leur dernier point est le premier,
   * à 0,0 m. Deux ne le portent pas, mesuré le 01/09/2026 :
   *
   *     Bouteville        85,3 m     Haute Saintonge   17,1 m
   *     Albi · Bugatti · Ricardo Tormo · Charente      0,0 m
   *
   * Cet écart n'est pas un détail de représentation : la polyligne s'ARRÊTE, et
   * `mapMatchPoint` n'a plus rien sur quoi projeter les points qui tombent
   * dedans. Voir `horsTrace` pour ce que cela fabriquait.
   */
  ecartBouclageM: number;
}

export function buildTrackGeometry(points: { lat: number; lon: number }[]): TrackGeometry {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(
      cum[i - 1] +
        haversineDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
    );
  }
  const premier = points[0];
  const dernier = points[points.length - 1];
  return {
    trackPoints: points,
    cumulativeDistances: cum,
    totalLengthM: cum[cum.length - 1] ?? 0,
    ecartBouclageM:
      points.length >= 2
        ? haversineDistance(premier.lat, premier.lon, dernier.lat, dernier.lon)
        : 0,
  };
}

export interface MapMatchResult {
  /** Position projetée sur le tracé, 0..1. */
  progress: number;
  /** Distance cumulée depuis le départ (m). */
  distanceM: number;
  /** Distance latérale entre le point et la projection (m). */
  lateralErrorM: number;
  /** Index du segment de référence le plus proche. */
  nearestSegmentIndex: number;
  /**
   * La projection est tombée sur une EXTRÉMITÉ de la polyligne — le point est
   * au-delà de ce que le tracé décrit.
   *
   * ===========================================================================
   * CE QUE LE TROU DE BOUCLAGE FABRIQUAIT
   * ===========================================================================
   *
   * `t` est borné à [0, 1] sur chaque segment. Quand un point tombe dans le
   * trou entre le dernier point du tracé et le premier, aucun segment ne le
   * porte : il se projette sur le sommet le plus proche, et `lateralErrorM`
   * devient la distance à ce SOMMET — la moitié du trou, pas un écart de
   * trajectoire.
   *
   * Sur la séance de référence, mesuré : 143 trames dans le trou de 85,3 m de
   * Bouteville, à 9,67 m d'écart médian, jusqu'à 25,3 m.
   *
   * Ce n'était pas une imprécision, c'était une marge fausse. `analyzeSegment`
   * lit le MAXIMUM d'écart latéral et le divise par 4 m : UNE seule trame de
   * trou sature `trajectoryUsage` à 1 et retire cinquante points de marge au
   * virage entier. Le garde de recalage, lui, mesure la MÉDIANE — 1,49 m sur
   * cette séance — et ne peut pas voir une queue de 0,5 %.
   *
   * On ne referme pas le trou : tracer une corde de 85 m à travers un bitume
   * qu'aucun relevé ne décrit inventerait la géométrie contre laquelle on
   * mesure. On le NOMME, et l'écart latéral de ces points ne compte pas.
   */
  horsTrace: boolean;
}

/**
 * Projette un point GPS sur la polyline du tracé.
 *
 * Algo simple : pour chaque segment [P_i, P_{i+1}], on calcule la
 * projection orthogonale du point sur le segment, on garde la plus
 * proche. Suffisant pour un circuit de 1.1 km avec ~42 points
 * (mesure de précision attendue : ±5 m).
 */
export function mapMatchPoint(
  point: { lat: number; lon: number },
  geometry: TrackGeometry
): MapMatchResult {
  const { trackPoints, cumulativeDistances, totalLengthM } = geometry;
  let bestIndex = 0;
  let bestDistance = Infinity;
  let bestRatio = 0;

  for (let i = 0; i < trackPoints.length - 1; i++) {
    const a = trackPoints[i];
    const b = trackPoints[i + 1];
    const ax = a.lon;
    const ay = a.lat;
    const bx = b.lon;
    const by = b.lat;
    const px = point.lon;
    const py = point.lat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const projLon = ax + t * dx;
    const projLat = ay + t * dy;
    const distM = haversineDistance(point.lat, point.lon, projLat, projLon);
    if (distM < bestDistance) {
      bestDistance = distM;
      bestIndex = i;
      bestRatio = t;
    }
  }

  const segmentLength =
    bestIndex < cumulativeDistances.length - 1
      ? cumulativeDistances[bestIndex + 1] - cumulativeDistances[bestIndex]
      : 0;
  const distanceM = cumulativeDistances[bestIndex] + bestRatio * segmentLength;
  const progress = totalLengthM > 0 ? Math.max(0, Math.min(1, distanceM / totalLengthM)) : 0;

  // Le point est au-delà du tracé quand sa projection s'arrête net sur l'un des
  // deux bouts : au tout début du premier segment, ou au tout bout du dernier.
  // C'est le seul cas où `lateralErrorM` mesure une distance à un SOMMET plutôt
  // qu'à une trajectoire — et donc le seul où elle ne veut rien dire.
  const dernierSegment = trackPoints.length - 2;
  const horsTrace =
    (bestIndex === 0 && bestRatio === 0) || (bestIndex === dernierSegment && bestRatio === 1);

  return {
    progress,
    distanceM,
    lateralErrorM: bestDistance,
    nearestSegmentIndex: bestIndex,
    horsTrace,
  };
}

/** Renvoie le segment correspondant à un progress 0..1. */
export function segmentForProgress(
  progress: number,
  segments: readonly TrackVizSegmentDefinition[]
): TrackVizSegmentDefinition {
  for (const s of segments) {
    if (progress >= s.progressStart && progress <= s.progressEnd) return s;
  }
  return segments[segments.length - 1];
}

/**
 * Détermine la phase (entry/apex/exit) à l'intérieur d'un segment.
 * Pour les segments non-virages, retourne 'straight'.
 */
export function phaseForProgress(
  progress: number,
  segment: TrackVizSegmentDefinition
): SegmentPhase {
  if (segment.kind === 'straight' || segment.apexProgress === null) {
    return 'straight';
  }
  const span = segment.progressEnd - segment.progressStart;
  if (span <= 0) return 'straight';
  const relativeApex = segment.apexProgress;
  const relativeProgress = progress;
  const apexBand = span * 0.18;
  if (Math.abs(relativeProgress - relativeApex) <= apexBand) return 'apex';
  if (relativeProgress < relativeApex) return 'entry';
  return 'exit';
}

/*
 * `TrackProjection` VIVAIT ICI. Retirée le 03/08/2026.
 *
 * Elle projetait un point GPS dans un repère local, pour « le rendu SVG du
 * composant TrackVizMap ». Ce composant ne l'a jamais appelée : ses seules
 * références dans tout le dépôt étaient sa propre déclaration et son propre
 * test.
 *
 * C'était par ailleurs un doublon exact de `buildProjection`
 * (`src/render/projection.ts`) — même barycentre, même 111 320, même correction
 * par cos(latitude), même Y inversé — en faisant strictement moins : ni bornes,
 * ni viewBox, et une liste vide y fabriquait une origine NaN au lieu de rendre
 * l'absence.
 *
 * Retirée comme code mort, PAS migrée : `src/render/projection.ts` reste sans
 * consommateur après cette suppression. Voir docs/DETTE.md D-40.
 */
