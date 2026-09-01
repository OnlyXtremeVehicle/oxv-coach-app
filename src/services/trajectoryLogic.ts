/**
 * Mapping pur des trames télémétrie → points de trajectoire {lat, lon, speed}.
 *
 * Source unique du filtrage (lat/lon non nuls) et de la conversion numérique,
 * partagée par la carte (`carte.tsx`), la Vue unifiée (`data-lab-canvas.tsx`) et
 * le service de chargement (`loadSessionTrajectory`). Pur → testé, pour
 * verrouiller l'invariant : aucun point sans coordonnées GPS valides.
 *
 * La forme retournée est structurellement compatible avec `TrajectoryPoint`
 * (CircuitMap) et `CanvasTrajectoryPoint` (DataLabCanvas) — pas de couplage.
 */

export interface TrajectoryFrameRow {
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
}

export interface TrajectoryFramePoint {
  lat: number;
  lon: number;
  speed: number | null;
}

export function mapFramesToTrajectory(rows: TrajectoryFrameRow[]): TrajectoryFramePoint[] {
  return rows
    .filter((r) => r.latitude !== null && r.longitude !== null)
    .map((r) => ({
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      speed: r.speed_kmh !== null ? Number(r.speed_kmh) : null,
    }));
}

/**
 * Un point sur k, à pas constant, premier et dernier conservés.
 *
 * La carte n'a rien à gagner à recevoir vingt-sept mille positions : à l'échelle
 * d'un écran, la moitié retombe sur le même pixel. Mais elle a tout à perdre à
 * n'en recevoir que les mille premières — c'est la différence entre une trace
 * DENSE et une trace AMPUTÉE. On lit donc toute la séance, et on allège le
 * DESSIN.
 *
 * Le dernier point est ajouté explicitement : un pas de neuf sur vingt-sept
 * mille points s'arrêterait sinon huit positions avant la ligne, et une trace
 * qui n'atteint pas sa fin est exactement le défaut qu'on répare.
 */
export function echantillonne<T>(points: T[], maximum: number): T[] {
  if (maximum <= 0 || points.length <= maximum) return points;
  const pas = Math.ceil(points.length / maximum);
  const sortie: T[] = [];
  for (let i = 0; i < points.length; i += pas) sortie.push(points[i]);
  const dernier = points[points.length - 1];
  if (sortie[sortie.length - 1] !== dernier) sortie.push(dernier);
  return sortie;
}
