/**
 * Géométrie trackviz — projection GPS sur tracé, map-matching, phases.
 *
 * Adapté du module partagé par Gabin en sem 11. Logique préservée,
 * vocabulaire et tokens adaptés. Aucun verbe directif ici (module
 * géométrique pur).
 */

import { haversineDistance } from '@/utils/geo';

import type { ScenePoint, SegmentPhase, TrackVizSegmentDefinition } from './types';

export interface TrackGeometry {
  /** Points GPS du tracé. */
  trackPoints: { lat: number; lon: number }[];
  /** Cumulé des distances depuis le départ pour chaque point. */
  cumulativeDistances: number[];
  /** Longueur totale du tracé en mètres. */
  totalLengthM: number;
}

export function buildTrackGeometry(points: { lat: number; lon: number }[]): TrackGeometry {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(
      cum[i - 1] +
        haversineDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
    );
  }
  return {
    trackPoints: points,
    cumulativeDistances: cum,
    totalLengthM: cum[cum.length - 1] ?? 0,
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

  return {
    progress,
    distanceM,
    lateralErrorM: bestDistance,
    nearestSegmentIndex: bestIndex,
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

/**
 * TrackProjection : utilitaire pour projeter un point GPS dans un
 * système de coordonnées local 2D (centré sur le tracé). Utile pour
 * le rendu SVG du composant TrackVizMap.
 */
export class TrackProjection {
  private originLat: number;
  private originLon: number;
  private mPerDegLat: number;
  private mPerDegLon: number;

  constructor(trackPoints: { lat: number; lon: number }[]) {
    const sumLat = trackPoints.reduce((s, p) => s + p.lat, 0);
    const sumLon = trackPoints.reduce((s, p) => s + p.lon, 0);
    this.originLat = sumLat / Math.max(1, trackPoints.length);
    this.originLon = sumLon / Math.max(1, trackPoints.length);
    // À l'échelle d'un circuit (< 5 km), on néglige la courbure terrestre.
    this.mPerDegLat = 111_320; // ≈ constant
    this.mPerDegLon = 111_320 * Math.cos((this.originLat * Math.PI) / 180);
  }

  toScene(point: { lat: number; lon: number }): ScenePoint {
    return {
      x: (point.lon - this.originLon) * this.mPerDegLon,
      // Y inversé pour cohérence SVG (Y vers le bas)
      y: -(point.lat - this.originLat) * this.mPerDegLat,
    };
  }
}
