/**
 * Projection lat/lon → scène locale 2D (mètres autour de l'origine).
 *
 * Réutilisé par tous les layers du CircuitMap. À l'échelle d'un circuit
 * (< 5 km), on néglige la courbure terrestre.
 *
 * Le calcul du viewBox SVG est aussi centralisé ici pour cohérence entre
 * les layers (sinon les overlays ne s'alignent pas avec la polyline).
 */

import { HAUTE_SAINTONGE_TRACK } from '@/trackviz/hauteSaintonge';

const VIEWBOX_PADDING_PCT = 12;

export interface ScenePoint {
  x: number;
  y: number;
}

/**
 * Projette un point GPS en coordonnées locales 2D en mètres, centré sur
 * le tracé HAUTE_SAINTONGE_TRACK. Y inversé pour cohérence SVG.
 */
export function projectToScene(point: { lat: number; lon: number }): ScenePoint {
  const proj = getProjectionParams();
  return {
    x: (point.lon - proj.originLon) * proj.mPerDegLon,
    y: -(point.lat - proj.originLat) * proj.mPerDegLat,
  };
}

/**
 * Renvoie le viewBox SVG cohérent avec la projection : tous les layers
 * doivent utiliser cette string pour s'aligner pixel-perfect.
 */
export function getCircuitViewBox(): string {
  const cache = getProjectionParams();
  return `${cache.viewBoxX} ${cache.viewBoxY} ${cache.viewBoxW} ${cache.viewBoxH}`;
}

/**
 * Tous les points du tracé projetés (pour les layers qui dessinent la
 * polyline ou cherchent des sommets précis).
 */
export function getScenePoints(): ScenePoint[] {
  return HAUTE_SAINTONGE_TRACK.map((p) => projectToScene(p));
}

// ============================================================================
// Cache interne — recalculé une fois au premier appel
// ============================================================================

interface ProjectionCache {
  originLat: number;
  originLon: number;
  mPerDegLat: number;
  mPerDegLon: number;
  viewBoxX: number;
  viewBoxY: number;
  viewBoxW: number;
  viewBoxH: number;
}

let cache: ProjectionCache | null = null;

function getProjectionParams(): ProjectionCache {
  if (cache) return cache;

  const sumLat = HAUTE_SAINTONGE_TRACK.reduce((s, p) => s + p.lat, 0);
  const sumLon = HAUTE_SAINTONGE_TRACK.reduce((s, p) => s + p.lon, 0);
  const originLat = sumLat / HAUTE_SAINTONGE_TRACK.length;
  const originLon = sumLon / HAUTE_SAINTONGE_TRACK.length;
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((originLat * Math.PI) / 180);

  // Bbox des points projetés
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of HAUTE_SAINTONGE_TRACK) {
    const x = (p.lon - originLon) * mPerDegLon;
    const y = -(p.lat - originLat) * mPerDegLat;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const padX = (w * VIEWBOX_PADDING_PCT) / 100;
  const padY = (h * VIEWBOX_PADDING_PCT) / 100;

  cache = {
    originLat,
    originLon,
    mPerDegLat,
    mPerDegLon,
    viewBoxX: minX - padX,
    viewBoxY: minY - padY,
    viewBoxW: w + 2 * padX,
    viewBoxH: h + 2 * padY,
  };
  return cache;
}
