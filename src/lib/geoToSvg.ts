/**
 * Projection d'un point GPS (lat, lon) vers les coordonnées d'un viewBox SVG.
 *
 * Utilisé pour superposer des tracés réels (positions du pilote) sur le
 * SVG du circuit. Approximation cartésienne valide à l'échelle d'un
 * circuit (< 5 km) — on néglige la courbure terrestre pour cette
 * projection 1D × 1D.
 *
 * Convention SVG : y croit vers le bas. On inverse donc l'axe latitude
 * (qui croit vers le nord) pour que le rendu soit orienté correctement.
 */

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface SvgViewBox {
  width: number;
  height: number;
}

export interface SvgPoint {
  x: number;
  y: number;
}

/**
 * Projette (lat, lon) vers (x, y) dans le viewBox SVG.
 *
 * Retourne null si le bbox est dégénéré (largeur ou hauteur nulle).
 * Clamp les coordonnées résultantes dans [0, width] × [0, height] —
 * un point hors-circuit reste affiché sur le bord, pas hors-écran.
 */
export function geoToSvg(
  lat: number,
  lon: number,
  bbox: BoundingBox,
  viewBox: SvgViewBox
): SvgPoint | null {
  const lonRange = bbox.maxLon - bbox.minLon;
  const latRange = bbox.maxLat - bbox.minLat;
  if (lonRange <= 0 || latRange <= 0) return null;

  const xRaw = ((lon - bbox.minLon) / lonRange) * viewBox.width;
  // Latitude inversée : maxLat → y = 0 (haut), minLat → y = height (bas).
  const yRaw = ((bbox.maxLat - lat) / latRange) * viewBox.height;

  return {
    x: clamp(xRaw, 0, viewBox.width),
    y: clamp(yRaw, 0, viewBox.height),
  };
}

/**
 * Projette une polyligne entière (utile pour superposer un tracé du pilote).
 * Les points hors bbox sont projetés clampés mais conservés dans la sortie.
 */
export function geoPolylineToSvg(
  points: { lat: number; lon: number }[],
  bbox: BoundingBox,
  viewBox: SvgViewBox
): SvgPoint[] {
  const out: SvgPoint[] = [];
  for (const p of points) {
    const projected = geoToSvg(p.lat, p.lon, bbox, viewBox);
    if (projected) out.push(projected);
  }
  return out;
}

/** Construit une chaîne `d` SVG (M / L) à partir d'une liste de points. */
export function polylineToPathD(points: SvgPoint[]): string {
  if (points.length === 0) return '';
  const head = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  const tail = points
    .slice(1)
    .map((p) => `L ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  return tail ? `${head} ${tail}` : head;
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
