/**
 * Planification d'une « belle route » (sinueuse / panoramique) — doc 09.
 *
 * Provider-agnostique : Kurviger ou GraphHopper (tous deux renvoient le format
 * de réponse GraphHopper : `paths[].points` en GeoJSON quand points_encoded=false).
 * Le provider et les clés viennent de l'environnement — AUCUNE clé en dur.
 *
 * Cadre OXV (doc 09 §1) : tourisme/découverte. `curviness` est une préférence
 * de balade, pas une métrique de performance. Aucune donnée de conduite n'entre
 * ici : la pondération « belle route » vient de la GÉOMÉTRIE renvoyée par l'API.
 *
 * NB : les noms exacts de certains paramètres (sinuosité Kurviger, custom model
 * GraphHopper) sont à confirmer avec une vraie clé — le parsing de réponse est
 * défensif (optional chaining) pour ne pas casser si un champ manque.
 */

import type {
  Curviness,
  GeoPoint,
  RoutingProvider,
  ScenicRoute,
  ScenicRouteRequest,
} from './types';

const PROVIDER = (process.env.EXPO_PUBLIC_ROUTING_PROVIDER as RoutingProvider) || 'kurviger';
const KURVIGER_KEY = process.env.EXPO_PUBLIC_KURVIGER_KEY ?? '';
const GRAPHHOPPER_KEY = process.env.EXPO_PUBLIC_GRAPHHOPPER_KEY ?? '';

// Réponse au format GraphHopper (partagée par Kurviger et GraphHopper).
interface GhPath {
  distance?: number; // mètres
  time?: number; // millisecondes
  ascend?: number; // mètres (dénivelé +)
  points?: { coordinates?: [number, number, number?][] }; // [lon, lat, ele?]
}
interface GhResponse {
  paths?: GhPath[];
}

const EARTH_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Distance Haversine en mètres entre deux points. */
function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Longueur cumulée d'une polyligne (m). */
function polylineLengthM(coords: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

/** Sinuosité = longueur tracé / distance à vol d'oiseau (départ→arrivée). ≥ 1. */
function computeSinuosity(coords: GeoPoint[]): number {
  if (coords.length < 2) return 1;
  const straight = haversineM(coords[0], coords[coords.length - 1]);
  if (straight < 1) return 1; // boucle : départ ≈ arrivée → pas de ratio pertinent
  return polylineLengthM(coords) / straight;
}

// Kurviger : niveau de sinuosité natif (best-effort, à confirmer avec la doc).
const KURVIGER_CURVINESS: Record<Curviness, string> = {
  douce: '1',
  sinueuse: '2',
  tres_sinueuse: '3',
};

function pointParam(p: GeoPoint): string {
  return `${p.lat},${p.lon}`;
}

function orderedPoints(req: ScenicRouteRequest): GeoPoint[] {
  const pts: GeoPoint[] = [req.start, ...(req.waypoints ?? [])];
  if (req.end) pts.push(req.end);
  return pts;
}

function buildKurvigerUrl(req: ScenicRouteRequest): string {
  const parts: string[] = orderedPoints(req).map(
    (p) => `point=${encodeURIComponent(pointParam(p))}`
  );
  parts.push('vehicle=motorcycle', 'points_encoded=false', 'elevation=true');
  parts.push(`curvature=${KURVIGER_CURVINESS[req.curviness ?? 'sinueuse']}`);
  if (req.avoidMotorways !== false) parts.push('avoid=motorway');
  if (KURVIGER_KEY) parts.push(`key=${encodeURIComponent(KURVIGER_KEY)}`);
  return `https://api.kurviger.de/v1/route?${parts.join('&')}`;
}

function buildGraphHopperUrl(req: ScenicRouteRequest): string {
  // Sinuosité fine = custom model (POST) → phase 2. Ici : routes secondaires.
  const parts: string[] = orderedPoints(req).map(
    (p) => `point=${encodeURIComponent(pointParam(p))}`
  );
  parts.push('vehicle=car', 'points_encoded=false', 'elevation=true');
  if (req.avoidMotorways !== false) parts.push('ch.disable=true');
  if (GRAPHHOPPER_KEY) parts.push(`key=${encodeURIComponent(GRAPHHOPPER_KEY)}`);
  return `https://graphhopper.com/api/1/route?${parts.join('&')}`;
}

function parseGhResponse(json: GhResponse, provider: RoutingProvider): ScenicRoute | null {
  const path = json.paths?.[0];
  const raw = path?.points?.coordinates;
  if (!path || !raw || raw.length < 2) return null;
  const coordinates: GeoPoint[] = raw.map(([lon, lat]) => ({ lat, lon }));
  return {
    coordinates,
    distanceKm: (path.distance ?? polylineLengthM(coordinates)) / 1000,
    durationMin: (path.time ?? 0) / 60000,
    ascentM: typeof path.ascend === 'number' ? path.ascend : undefined,
    sinuosity: computeSinuosity(coordinates),
    provider,
  };
}

/**
 * Planifie une belle route. Renvoie `null` si pas de clé configurée, si l'appel
 * échoue, ou si aucun tracé n'est renvoyé (l'UI affiche alors un état vide/erreur).
 */
export async function planScenicRoute(req: ScenicRouteRequest): Promise<ScenicRoute | null> {
  const provider = PROVIDER;
  const key = provider === 'kurviger' ? KURVIGER_KEY : GRAPHHOPPER_KEY;
  if (!key) {
    console.warn(`[routing] clé ${provider} absente (EXPO_PUBLIC_*_KEY) — routing indisponible.`);
    return null;
  }
  const url = provider === 'kurviger' ? buildKurvigerUrl(req) : buildGraphHopperUrl(req);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[routing] ${provider} HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as GhResponse;
    return parseGhResponse(json, provider);
  } catch (e) {
    console.warn('[routing] échec planScenicRoute', e);
    return null;
  }
}
