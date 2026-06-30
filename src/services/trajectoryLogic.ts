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
