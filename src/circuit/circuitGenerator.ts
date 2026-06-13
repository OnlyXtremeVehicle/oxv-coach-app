/**
 * Générateur de circuits 3D — OXV Mirror
 *
 * Port TypeScript FIDÈLE de `docs/specs-bundle-v4/circuit-tool/circuit-generator.mjs`
 * (doctrine : reproduire, ne pas réinventer). Entrée : un way OpenStreetMap ou un
 * tableau de {lat, lon}. Sortie : tracé débruité, virages détectés (analyse des
 * changements de cap), géométrie de ruban prête pour le rendu 3D.
 *
 * Aucune dépendance externe. La logique est identique au module de référence ;
 * seuls les types ont été ajoutés.
 *
 * Attribution OSM obligatoire à l'affichage : « © contributeurs OpenStreetMap ».
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Point {
  x: number;
  y: number;
}

export type CornerDirection = 'left' | 'right' | 'unknown';

export interface Corner {
  index: number;
  apexIdx: number;
  startIdx: number;
  endIdx: number;
  radius_m: number;
  direction: CornerDirection;
}

export interface RibbonSection {
  center: [number, number];
  left: [number, number];
  right: [number, number];
}

export interface CircuitParams {
  smoothWin: number;
  resampleStep: number;
  cornerRadius: number;
  trackWidth: number;
  closed: boolean;
}

export interface Circuit {
  centerline: Point[];
  corners: Corner[];
  ribbon: RibbonSection[];
  length_m: number;
  closed: boolean;
  params: CircuitParams;
}

export type GenerateCircuitOptions = Partial<CircuitParams>;

export interface OsmWayParsed {
  name: string | null;
  points: LatLon[];
  closed: boolean;
  osmWayId: number;
}

// --- Réponse OSM (typage minimal, sans `any`) --------------------------------
interface OsmNode {
  type: 'node';
  id: number;
  lat?: number;
  lon?: number;
}

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay | { type: string; id: number };

interface OsmResponse {
  elements: OsmElement[];
}

// --- 1. Récupération d'un tracé depuis OpenStreetMap -------------------------
export async function fetchOsmWay(wayId: number, fetchImpl?: typeof fetch): Promise<OsmWayParsed> {
  const f = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('Aucune implémentation fetch disponible.');
  const url = `https://api.openstreetmap.org/api/0.6/way/${wayId}/full.json`;
  const res = await f(url);
  if (!res.ok) throw new Error(`OSM a répondu ${res.status} pour le way ${wayId}.`);
  const osm = (await res.json()) as OsmResponse;
  return parseOsmWay(osm);
}

// Parse la réponse OSM /full.json en {name, points:[{lat,lon}], closed}
export function parseOsmWay(osm: OsmResponse): OsmWayParsed {
  const ways = osm.elements.filter((e): e is OsmWay => e.type === 'way');
  if (!ways.length) throw new Error('Aucun way dans la réponse OSM.');
  const way = ways[0];
  const nodesById: Record<number, OsmNode> = {};
  osm.elements
    .filter((e): e is OsmNode => e.type === 'node')
    .forEach((n) => {
      nodesById[n.id] = n;
    });
  const points: LatLon[] = way.nodes
    .map((id) => nodesById[id])
    .filter((n): n is OsmNode => n != null && n.lat != null)
    .map((n) => ({ lat: n.lat as number, lon: n.lon as number }));
  const closed = way.nodes[0] === way.nodes[way.nodes.length - 1];
  return { name: way.tags?.name ?? null, points, closed, osmWayId: way.id };
}

// --- 2. Projection géographique → mètres (plan tangent local) ----------------
export function projectToMeters(points: LatLon[]): Point[] {
  if (!points.length) return [];
  const lat0 = (points[0].lat * Math.PI) / 180;
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos(lat0);
  // origine au premier point pour des coordonnées petites et centrées
  const x0 = points[0].lon * mPerLon;
  const y0 = points[0].lat * mPerLat;
  return points.map((p) => ({ x: p.lon * mPerLon - x0, y: p.lat * mPerLat - y0 }));
}

// --- 3. Débruitage : moyenne glissante (passe-bas) ---------------------------
// win = demi-fenêtre. Sur tracé OSM propre : 1. Sur GPS RaceBox brut : 6 à 10.
export function smooth(pts: Point[], win: number, closed: boolean): Point[] {
  const n = pts.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let j = i - win; j <= i + win; j++) {
      let k = j;
      if (closed)
        k = ((j % n) + n) % n; // boucle : on enroule
      else k = Math.max(0, Math.min(n - 1, j)); // ouvert : on borne
      sx += pts[k].x;
      sy += pts[k].y;
      c++;
    }
    out.push({ x: sx / c, y: sy / c });
  }
  return out;
}

// --- 4. Rééchantillonnage spatial : un point tous les `step` mètres ----------
export function resampleByDistance(pts: Point[], step: number): Point[] {
  if (!pts.length) return [];
  const out: Point[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc >= step) {
      out.push(pts[i]);
      acc = 0;
    }
  }
  return out;
}

// --- 5. Courbure en chaque point via variation de cap ------------------------
// κ ≈ |Δcap| / distance (rad/m). Le rayon vaut R = 1/κ.
export function curvature(pts: Point[]): number[] {
  const k = new Array<number>(pts.length).fill(0);
  for (let i = 1; i < pts.length - 1; i++) {
    const h1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    const h2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    let dh = h2 - h1;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const d =
      (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) +
        Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)) /
      2;
    k[i] = d > 0 ? Math.abs(dh) / d : 0;
  }
  return k;
}

function cornerDirection(pts: Point[], i: number): CornerDirection {
  if (i <= 0 || i >= pts.length - 1) return 'unknown';
  const ax = pts[i].x - pts[i - 1].x;
  const ay = pts[i].y - pts[i - 1].y;
  const bx = pts[i + 1].x - pts[i].x;
  const by = pts[i + 1].y - pts[i].y;
  const cross = ax * by - ay * bx;
  return cross > 0 ? 'left' : 'right';
}

// --- 6. Détection des virages : zones contiguës de forte courbure ------------
// rThresh = rayon seuil (m) en dessous duquel on est « en virage ».
// Hystérésis à 0,5×seuil pour ne pas hacher un virage en plusieurs.
export function detectCorners(pts: Point[], k: number[], rThresh: number): Corner[] {
  const kT = 1 / rThresh;
  const corners: Corner[] = [];
  let inC = false;
  let start = 0;
  for (let i = 0; i < k.length; i++) {
    if (k[i] > kT && !inC) {
      inC = true;
      start = i;
    } else if (k[i] <= kT * 0.5 && inC) {
      inC = false;
      let apex = start;
      let kmax = 0;
      for (let j = start; j < i; j++) {
        if (k[j] > kmax) {
          kmax = k[j];
          apex = j;
        }
      }
      if (i - start >= 1) {
        corners.push({
          index: corners.length + 1,
          apexIdx: apex,
          startIdx: start,
          endIdx: i,
          radius_m: Math.round(1 / kmax),
          // sens du virage : signe du produit vectoriel des tangentes
          direction: cornerDirection(pts, apex),
        });
      }
    }
  }
  return corners;
}

// --- 7. Géométrie du ruban 3D (deux bords parallèles) ------------------------
// width = largeur de piste en mètres. Renvoie sommets gauche/droite + centre.
export function buildRibbon(pts: Point[], width: number, closed: boolean): RibbonSection[] {
  const half = width / 2;
  const n = pts.length;
  const ribbon: RibbonSection[] = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(((i - 1) % n) + n) % n] : pts[Math.max(0, i - 1)];
    const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len; // normale
    ribbon.push({
      center: [pts[i].x, pts[i].y],
      left: [pts[i].x + nx * half, pts[i].y + ny * half],
      right: [pts[i].x - nx * half, pts[i].y - ny * half],
    });
  }
  return ribbon;
}

// --- 8. Pipeline complet -----------------------------------------------------
export function generateCircuit(rawPoints: LatLon[], opts: GenerateCircuitOptions = {}): Circuit {
  const {
    smoothWin = 1, // débruitage (OSM propre = 1 ; GPS brut = 6-10)
    resampleStep = 10, // mètres entre points rééchantillonnés
    cornerRadius = 100, // seuil de rayon (m) pour qu'une courbe soit un virage
    trackWidth = 12, // largeur de piste (m) pour le ruban 3D
    closed = true,
  } = opts;

  const projected = projectToMeters(rawPoints);
  const smoothed = smooth(projected, smoothWin, closed);
  const resampled = resampleByDistance(smoothed, resampleStep);
  const k = curvature(resampled);
  const corners = detectCorners(resampled, k, cornerRadius);
  const ribbon = buildRibbon(resampled, trackWidth, closed);

  let length_m = 0;
  for (let i = 1; i < resampled.length; i++) {
    length_m += Math.hypot(
      resampled[i].x - resampled[i - 1].x,
      resampled[i].y - resampled[i - 1].y
    );
  }
  if (closed && resampled.length > 1) {
    length_m += Math.hypot(
      resampled[0].x - resampled[resampled.length - 1].x,
      resampled[0].y - resampled[resampled.length - 1].y
    );
  }

  return {
    centerline: resampled, // [{x,y}] débruité, en mètres
    corners, // virages détectés
    ribbon, // géométrie 3D
    length_m: Math.round(length_m),
    closed,
    params: { smoothWin, resampleStep, cornerRadius, trackWidth, closed },
  };
}
