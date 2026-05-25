/**
 * Projection lat/lon → scène locale 2D — pack web.
 *
 * CODE IDENTIQUE à src/components/CircuitMap/projection.ts du repo app.
 * Aucune dépendance React Native, transposable tel quel côté web.
 *
 * À l'échelle d'un circuit (< 5 km), on néglige la courbure terrestre.
 */

import { HAUTE_SAINTONGE_TRACK } from '@/data/hauteSaintonge';

const VIEWBOX_PADDING_PCT = 12;

export interface ScenePoint {
  x: number;
  y: number;
}

export function projectToScene(point: { lat: number; lon: number }): ScenePoint {
  const proj = getProjectionParams();
  return {
    x: (point.lon - proj.originLon) * proj.mPerDegLon,
    y: -(point.lat - proj.originLat) * proj.mPerDegLat,
  };
}

export function getCircuitViewBox(): string {
  const cache = getProjectionParams();
  return `${cache.viewBoxX} ${cache.viewBoxY} ${cache.viewBoxW} ${cache.viewBoxH}`;
}

export function getScenePoints(): ScenePoint[] {
  return HAUTE_SAINTONGE_TRACK.map((p) => projectToScene(p));
}

// ============================================================================
// Cache interne
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
