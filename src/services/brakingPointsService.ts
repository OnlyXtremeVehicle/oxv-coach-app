/**
 * Détection des points de freinage notables sur une trajectoire GPS.
 *
 * Complète le pilier §3.4 (carte de chaleur) : le cahier demande
 * « vitesse, trajectoires ET points de freinage projetés en couleurs ».
 *
 * Approche descriptive et factuelle : on repère les zones où la vitesse
 * chute fortement (freinage) et on marque le point de plus forte
 * décélération de chaque zone. Aucune interprétation — juste « ici, vous
 * avez ralenti franchement ».
 *
 * Logique PURE (pas de Supabase) → testable unitairement.
 */

export interface TrajPoint {
  lat: number;
  lon: number;
  speed?: number | null;
}

export interface BrakingPoint {
  lat: number;
  lon: number;
  /** Intensité 0..1 : chute de vitesse normalisée sur la zone. */
  intensity: number;
  /** Vitesse d'entrée de la zone de freinage (km/h). */
  entrySpeed: number;
  /** Vitesse de sortie de la zone (km/h). */
  exitSpeed: number;
}

/**
 * Détecte les points de freinage notables.
 *
 * @param points          trajectoire ordonnée chronologiquement
 * @param minDropKmh      chute de vitesse minimale pour qu'une zone compte (défaut 15)
 * @param minSeparationM  distance min entre 2 points de freinage retenus (défaut 30 m)
 */
export function detectBrakingPoints(
  points: TrajPoint[],
  minDropKmh = 15,
  minSeparationM = 30
): BrakingPoint[] {
  if (points.length < 3) return [];

  // 1. Repère les segments descendants continus (vitesse qui baisse).
  const zones: { startIdx: number; endIdx: number; drop: number }[] = [];
  let i = 0;
  while (i < points.length - 1) {
    const s0 = speedAt(points, i);
    if (s0 === null) {
      i += 1;
      continue;
    }
    // Étend tant que la vitesse décroît (tolérance d'1 km/h de bruit).
    let j = i;
    while (j < points.length - 1) {
      const a = speedAt(points, j);
      const b = speedAt(points, j + 1);
      if (a === null || b === null) break;
      if (b > a + 1) break; // remonte = fin de la zone de freinage
      j += 1;
    }
    const sStart = speedAt(points, i);
    const sEnd = speedAt(points, j);
    if (sStart !== null && sEnd !== null) {
      const drop = sStart - sEnd;
      if (j > i && drop >= minDropKmh) {
        zones.push({ startIdx: i, endIdx: j, drop });
      }
    }
    i = Math.max(j, i + 1);
  }

  if (zones.length === 0) return [];

  // 2. Pour chaque zone, le point de freinage = milieu géométrique de la
  //    zone (là où la décélération est la plus représentative).
  const maxDrop = Math.max(...zones.map((z) => z.drop));
  const raw: BrakingPoint[] = zones.map((z) => {
    const midIdx = Math.floor((z.startIdx + z.endIdx) / 2);
    const p = points[midIdx];
    return {
      lat: p.lat,
      lon: p.lon,
      intensity: maxDrop > 0 ? z.drop / maxDrop : 0,
      entrySpeed: speedAt(points, z.startIdx) ?? 0,
      exitSpeed: speedAt(points, z.endIdx) ?? 0,
    };
  });

  // 3. Déduplique les points trop proches (garde le plus intense).
  const kept: BrakingPoint[] = [];
  for (const bp of raw.sort((a, b) => b.intensity - a.intensity)) {
    const tooClose = kept.some((k) => haversineM(k, bp) < minSeparationM);
    if (!tooClose) kept.push(bp);
  }
  return kept;
}

function speedAt(points: TrajPoint[], idx: number): number | null {
  const s = points[idx]?.speed;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
}

/** Distance approximative entre 2 points GPS, en mètres (Haversine). */
function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
