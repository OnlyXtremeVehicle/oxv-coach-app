/**
 * Création de tracé par l'utilisateur (specs v4 §08 §5.3 — le point innovant).
 *
 * Réutilise le générateur testé (`circuitGenerator`) : une liste de points
 * {lat,lon} → géométrie débruitée + virages détectés (courbure) + ruban. On
 * dérive ce que la table `circuits` attend : track_svg_path (via geoToSvg, même
 * convention que les tracés existants), bbox, turns_count, length_km, géofence.
 *
 * Visibilité (décision fondateur) : un tracé créé est PRIVÉ par défaut
 * (`review_status='private'`, `is_official=false`), PROPOSABLE à OXV
 * (`review_status='submitted'` → OXV approuve), et partageable via social
 * (action ultérieure). Un utilisateur ne peut pas s'auto-promouvoir officiel.
 */

import { supabase } from '@/lib/supabase';
import { type BoundingBox, geoPolylineToSvg, polylineToPathD } from '@/lib/geoToSvg';

import { generateCircuit, type LatLon } from '@/circuit/circuitGenerator';

const SVG_VIEWBOX = { width: 1000, height: 1000 };
const DEFAULT_FINISH_RADIUS_M = 20;

export type TraceVisibility = 'private' | 'submitted';

export interface UserCircuitInsert {
  user_id: string;
  name: string;
  is_official: false;
  is_default: false;
  review_status: TraceVisibility;
  track_svg_path: string;
  turns_count: number;
  length_km: number;
  bbox_min_lat: number;
  bbox_max_lat: number;
  bbox_min_lon: number;
  bbox_max_lon: number;
  finish_line_lat: number;
  finish_line_lon: number;
  finish_line_radius_m: number;
  finish_line_heading: number;
}

function boundingBox(points: LatLon[]): BoundingBox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return { minLat, maxLat, minLon, maxLon };
}

/** Cap initial (degrés, 0 = Nord) entre les deux premiers points — sert de géofence. */
function initialHeading(points: LatLon[]): number {
  if (points.length < 2) return 0;
  const a = points[0];
  const b = points[1];
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Construit la charge utile d'insertion `circuits` à partir des points bruts.
 * Fonction PURE (aucune I/O) — testable.
 */
export function buildUserCircuitInsert(
  points: LatLon[],
  name: string,
  opts: { userId: string; visibility: TraceVisibility }
): UserCircuitInsert {
  if (points.length < 3) throw new Error('Un tracé nécessite au moins 3 points.');
  const circuit = generateCircuit(points);
  const bbox = boundingBox(points);
  const svgPath = polylineToPathD(geoPolylineToSvg(points, bbox, SVG_VIEWBOX));

  return {
    user_id: opts.userId,
    name: name.trim(),
    is_official: false,
    is_default: false,
    review_status: opts.visibility,
    track_svg_path: svgPath,
    turns_count: circuit.corners.length,
    length_km: +(circuit.length_m / 1000).toFixed(2),
    bbox_min_lat: bbox.minLat,
    bbox_max_lat: bbox.maxLat,
    bbox_min_lon: bbox.minLon,
    bbox_max_lon: bbox.maxLon,
    finish_line_lat: points[0].lat,
    finish_line_lon: points[0].lon,
    finish_line_radius_m: DEFAULT_FINISH_RADIUS_M,
    finish_line_heading: +initialHeading(points).toFixed(1),
  };
}

/** Insère le tracé créé. Renvoie l'id du nouveau circuit, ou null en cas d'échec. */
export async function createUserCircuit(
  points: LatLon[],
  name: string,
  visibility: TraceVisibility
): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const payload = buildUserCircuitInsert(points, name, { userId, visibility });
  const { data, error } = await supabase.from('circuits').insert(payload).select('id').single();
  if (error || !data) return null;
  return data.id;
}
