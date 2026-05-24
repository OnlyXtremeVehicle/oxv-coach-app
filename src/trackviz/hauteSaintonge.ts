/**
 * Données statiques du circuit Haute Saintonge (tracé Beltoise).
 *
 * Inspiré du module trackviz partagé par Gabin en sem 11, adapté à notre
 * topologie 14 virages (`src/lib/circuitTopology.ts`). Les coordonnées GPS
 * de la polyline sont interpolées depuis les apex des virages — V1 pour
 * permettre le map-matching. Calibration topométrique précise renvoyée
 * en sem 13+.
 */

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';

import type { TrackVizSegmentDefinition } from './types';

export interface TrackPoint {
  lat: number;
  lon: number;
}

/**
 * Polyline du tracé Beltoise : pour chaque virage, on intercale 3 points
 * (entrée, apex, sortie) interpolés autour de l'apex GPS connu, ce qui
 * donne ~42 points le long du tracé.
 */
function buildTrack(): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (let i = 0; i < BELTOISE_CORNERS.length; i++) {
    const corner = BELTOISE_CORNERS[i];
    const next = BELTOISE_CORNERS[(i + 1) % BELTOISE_CORNERS.length];
    // Entrée (légèrement avant l'apex, vers le virage précédent)
    const prev = BELTOISE_CORNERS[(i - 1 + BELTOISE_CORNERS.length) % BELTOISE_CORNERS.length];
    points.push({
      lat: corner.apexLat * 0.7 + prev.apexLat * 0.3,
      lon: corner.apexLon * 0.7 + prev.apexLon * 0.3,
    });
    // Apex exact
    points.push({ lat: corner.apexLat, lon: corner.apexLon });
    // Sortie (légèrement après, vers le suivant)
    points.push({
      lat: corner.apexLat * 0.6 + next.apexLat * 0.4,
      lon: corner.apexLon * 0.6 + next.apexLon * 0.4,
    });
  }
  return points;
}

export const HAUTE_SAINTONGE_TRACK: TrackPoint[] = buildTrack();

/**
 * Segments du circuit : un par virage (kind='turn') + interstices
 * (kind='straight') quand 2 virages sont éloignés. V1 : on définit
 * uniquement les 14 virages, les lignes droites étant implicites.
 */
export const HAUTE_SAINTONGE_SEGMENTS: TrackVizSegmentDefinition[] = BELTOISE_CORNERS.map(
  (corner, i) => {
    const segmentSpan = 1 / BELTOISE_CORNERS.length;
    const start = i * segmentSpan;
    const end = (i + 1) * segmentSpan;
    return {
      id: `corner-${corner.index}`,
      order: corner.index,
      name: corner.name,
      kind: 'turn' as const,
      progressStart: Number(start.toFixed(4)),
      progressEnd: Number(end.toFixed(4)),
      apexProgress: Number((start + segmentSpan / 2).toFixed(4)),
      coachingFocus:
        corner.pace === 'fast'
          ? 'Patience à la corde, ouverture progressive.'
          : corner.pace === 'slow'
            ? 'Repère de freinage stable, point de corde clair.'
            : 'Lecture du virage en continu, transitions douces.',
    };
  }
);

export const HAUTE_SAINTONGE_CIRCUIT = {
  id: 'beltoise',
  name: 'Circuit de Haute Saintonge',
  totalLengthM: 1130,
  cornerCount: BELTOISE_CORNERS.length,
};
