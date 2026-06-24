/**
 * Planification d'une « belle route » (sinueuse / panoramique) — doc 09.
 *
 * Provider par défaut : GraphHopper (en direct, hosting EU). Provider-agnostique :
 * GraphHopper ou Kurviger (tous deux renvoient le format de réponse GraphHopper :
 * `paths[].points` en GeoJSON quand points_encoded=false). Le provider et les clés
 * viennent de l'environnement — AUCUNE clé en dur.
 *
 * GraphHopper : la sinuosité RÉELLE vient d'un POST avec `custom_model` (pénalise
 * les grands axes selon la préférence). Le GET basique ignore cette pondération,
 * d'où le passage en POST ici. Kurviger reste en GET (fallback si on repointe le
 * provider dessus).
 *
 * Cadre OXV (doc 09 §1) : tourisme/découverte. `curviness` est une préférence
 * de balade, pas une métrique de performance. Aucune donnée de conduite n'entre
 * ici : la pondération « belle route » vient de la GÉOMÉTRIE renvoyée par l'API.
 *
 * NB : les multiplicateurs exacts du custom model GraphHopper (et la sinuosité
 * native Kurviger) sont à confirmer avec une vraie clé — le parsing de réponse est
 * défensif (optional chaining) pour ne pas casser si un champ manque.
 */

import type {
  Curviness,
  GeoPoint,
  RoutingProvider,
  ScenicRoute,
  ScenicRouteRequest,
} from './types';

const PROVIDER = (process.env.EXPO_PUBLIC_ROUTING_PROVIDER as RoutingProvider) || 'graphhopper';
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

// GraphHopper custom model : pénalise les grands axes de plus en plus selon la
// sinuosité voulue (multiplicateurs ≤ 1 → priorité abaissée, donc évités). C'est
// ce qui produit une sinuosité RÉELLE côté GraphHopper (POST). À confirmer avec
// une vraie clé.
const GH_CURVY_PRIORITY: Record<Curviness, { if: string; multiply_by: string }[]> = {
  douce: [
    { if: 'road_class == MOTORWAY', multiply_by: '0.2' },
    { if: 'road_class == TRUNK', multiply_by: '0.6' },
  ],
  sinueuse: [
    { if: 'road_class == MOTORWAY', multiply_by: '0.05' },
    { if: 'road_class == TRUNK', multiply_by: '0.3' },
    { if: 'road_class == PRIMARY', multiply_by: '0.7' },
  ],
  tres_sinueuse: [
    { if: 'road_class == MOTORWAY', multiply_by: '0.02' },
    { if: 'road_class == TRUNK', multiply_by: '0.1' },
    { if: 'road_class == PRIMARY', multiply_by: '0.4' },
    { if: 'road_class == SECONDARY', multiply_by: '0.8' },
  ],
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

/** Corps POST GraphHopper (points_encoded=false → réponse au format GraphHopper). */
interface GraphHopperBody {
  /** Points en [lon, lat] (ordre attendu par GraphHopper en POST). */
  points: [number, number][];
  profile: 'car';
  points_encoded: false;
  elevation: true;
  'ch.disable': true;
  custom_model: { priority: { if: string; multiply_by: string }[] };
}

/**
 * Corps de la requête POST GraphHopper (fonction PURE, testable). La sinuosité
 * réelle vient du `custom_model.priority`. NB : en POST, GraphHopper attend les
 * points en [lon, lat]. Défaut de sinuosité : 'sinueuse'.
 */
export function buildGraphHopperBody(req: ScenicRouteRequest): GraphHopperBody {
  const curviness: Curviness = req.curviness ?? 'sinueuse';
  return {
    points: orderedPoints(req).map((p) => [p.lon, p.lat]),
    profile: 'car',
    points_encoded: false,
    elevation: true,
    'ch.disable': true,
    custom_model: { priority: GH_CURVY_PRIORITY[curviness] },
  };
}

/** URL GraphHopper (la pondération « belle route » passe par le corps POST). */
function buildGraphHopperUrl(): string {
  return `https://graphhopper.com/api/1/route?key=${encodeURIComponent(GRAPHHOPPER_KEY)}`;
}

export function parseGhResponse(json: GhResponse, provider: RoutingProvider): ScenicRoute | null {
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
  try {
    const res =
      provider === 'kurviger'
        ? await fetch(buildKurvigerUrl(req))
        : await fetch(buildGraphHopperUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildGraphHopperBody(req)),
          });
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
