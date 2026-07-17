/**
 * pathMath — helpers purs pour préparer un tracé SVG à animer.
 *
 * <DrawInPath> a besoin de deux choses que react-native-svg ne fournit pas
 * (pas de getTotalLength() côté natif) : la chaîne `d` du Path et sa
 * longueur. Quand le tracé vient d'une polyline (points de circuit projetés,
 * courbe échantillonnée), ces deux helpers font le travail.
 *
 * Aucun import react-native ici — testable en logique pure sous ts-jest.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Convertit une polyline en chaîne `d` de Path SVG (M/L).
 *
 * @param points   Points dans le repère de la scène SVG.
 * @param decimals Précision des coordonnées. Par défaut 2.
 * @param close    Ferme le tracé (Z) — utile pour un circuit en boucle.
 */
export function polylineToPathD(points: readonly Point2D[], decimals = 2, close = false): string {
  if (points.length === 0) return '';
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(decimals)} ${p.y.toFixed(decimals)}`)
    .join(' ');
  return close ? `${d} Z` : d;
}

/**
 * Longueur totale d'une polyline (somme des segments euclidiens).
 * Sert de `length` à <DrawInPath> pour le strokeDasharray.
 *
 * @param close Inclut le segment de fermeture dernier → premier point.
 */
export function polylineLength(points: readonly Point2D[], close = false): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += segmentLength(points[i - 1], points[i]);
  }
  if (close) {
    total += segmentLength(points[points.length - 1], points[0]);
  }
  return total;
}

function segmentLength(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
