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

// --- 1 bis. Récupération d'un tracé porté par une RELATION -------------------
//
// POURQUOI CE CHEMIN EXISTE, mesuré le 30/08/2026 sur les deux circuits qui
// restaient à mettre en base.
//
//   Albi passe par `fetchOsmWay` : le way 95802415 « Circuit d'Albi » est un
//   anneau FERMÉ de 137 points, 3 562 m. Un seul way suffit.
//
//   Le Bugatti, non. Ses cinq ways nommés « Circuit Bugatti » totalisent
//   1 690 m — le circuit en fait 4 185. Le reste de la boucle porte les noms
//   des virages (Chicane Dunlop, Virage du Musée, Le « S » du Garage Bleu…) et
//   se partage avec le circuit des 24 Heures. Ce qui tient le tracé complet est
//   la RELATION 2725877 : dix-huit ways, 4 164 m cumulés, et zéro extrémité
//   impaire — donc une boucle qui se referme réellement.
//
// Une relation ne donne AUCUN ordre : ses membres sont dans le désordre et
// certains sont orientés à l'envers. Le chaînage se fait donc par les nœuds
// partagés, pas par la position dans la liste.

interface OsmRelationMember {
  type: string;
  ref: number;
  role?: string;
}

interface OsmRelation {
  type: 'relation';
  id: number;
  members: OsmRelationMember[];
  tags?: Record<string, string>;
}

export async function fetchOsmRelation(
  relationId: number,
  fetchImpl?: typeof fetch
): Promise<OsmWayParsed> {
  const f = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('Aucune implémentation fetch disponible.');
  const url = `https://api.openstreetmap.org/api/0.6/relation/${relationId}/full.json`;
  const res = await f(url);
  if (!res.ok) throw new Error(`OSM a répondu ${res.status} pour la relation ${relationId}.`);
  const osm = (await res.json()) as OsmResponse;
  return parseOsmRelation(osm);
}

/**
 * Assemble les ways d'une relation en un tracé continu.
 *
 * L'algorithme suit les NŒUDS PARTAGÉS : on part d'un segment, on cherche
 * celui dont une extrémité rejoint la fin du chemin en cours, on le retourne
 * s'il faut, on l'ajoute, et on recommence.
 *
 * S'IL RESTE DES SEGMENTS ORPHELINS, ON REFUSE. Rendre le morceau chaîné
 * serait rendre un circuit amputé qui a l'air complet — et le générateur en
 * tirerait des virages, une longueur et des positions curvilignes fausses, sans
 * que rien ne le signale. L'erreur nomme le compte : c'est ce qui permet de
 * savoir qu'il manque une bretelle plutôt que de croire à un bug.
 */
export function parseOsmRelation(osm: OsmResponse): OsmWayParsed {
  const relation = osm.elements.find((e): e is OsmRelation => e.type === 'relation');
  if (!relation) throw new Error('Aucune relation dans la réponse OSM.');

  const parWayId = new Map<number, OsmWay>();
  for (const e of osm.elements) if (e.type === 'way') parWayId.set(e.id, e as OsmWay);

  const nodesById = new Map<number, OsmNode>();
  for (const e of osm.elements) if (e.type === 'node') nodesById.set(e.id, e as OsmNode);

  const segments = relation.members
    .filter((m) => m.type === 'way')
    .map((m) => parWayId.get(m.ref))
    .filter((w): w is OsmWay => w !== undefined && Array.isArray(w.nodes) && w.nodes.length >= 2)
    .map((w) => w.nodes.slice());

  if (segments.length === 0) throw new Error('La relation ne porte aucun way exploitable.');

  const restants = segments.slice();
  let chaine = restants.shift() as number[];

  // Chaque tour ajoute un segment ; à défaut on sort et le compte parlera.
  for (let garde = 0; garde < segments.length + 1 && restants.length > 0; garde++) {
    const fin = chaine[chaine.length - 1];
    const i = restants.findIndex((s) => s[0] === fin || s[s.length - 1] === fin);
    if (i === -1) break;
    const s = restants.splice(i, 1)[0];
    const suite = s[0] === fin ? s.slice(1) : s.slice(0, -1).reverse();
    chaine = chaine.concat(suite);
  }

  if (restants.length > 0) {
    throw new Error(
      `Relation ${relation.id} : ${restants.length} segment(s) sur ${segments.length} ne se raccordent pas au tracé. Le circuit ne serait pas complet.`
    );
  }

  const points: LatLon[] = chaine
    .map((id) => nodesById.get(id))
    .filter((n): n is OsmNode => n != null && n.lat != null && n.lon != null)
    .map((n) => ({ lat: n.lat as number, lon: n.lon as number }));

  return {
    name: relation.tags?.name ?? null,
    points,
    closed: chaine.length > 1 && chaine[0] === chaine[chaine.length - 1],
    // L'identifiant rendu est celui de la RELATION. Le champ s'appelle
    // `osmWayId` par héritage ; le renommer casserait les tracés déjà
    // enregistrés, qui le portent.
    osmWayId: relation.id,
  };
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

/**
 * L'inverse de `projectToMeters` — retour d'un point projeté en lat/lon.
 *
 * La projection est équirectangulaire et son origine est le PREMIER point du
 * tracé : l'inverse est donc exact, à condition de lui redonner ce même
 * premier point. On le passe explicitement plutôt que de mémoriser un état :
 * une origine implicite se perdrait au premier appel dans le désordre.
 *
 * Sert à rendre les cordes détectées — `detectCorners` travaille en mètres,
 * et la résolution d'un marqueur travaille en lat/lon.
 */
export function unprojectFromMeters(points: Point[], origin: LatLon): LatLon[] {
  const lat0 = (origin.lat * Math.PI) / 180;
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos(lat0);
  const x0 = origin.lon * mPerLon;
  const y0 = origin.lat * mPerLat;
  return points.map((p) => ({ lat: (p.y + y0) / mPerLat, lon: (p.x + x0) / mPerLon }));
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

/*
 * --- 7. LE RUBAN 3D A ÉTÉ RETIRÉ LE 03/08/2026 -------------------------------
 *
 * `buildRibbon` produisait deux bords parallèles au tracé, et `generateCircuit`
 * les posait dans `Circuit.ribbon`. Personne ne les lisait : hors ce fichier et
 * son test, le mot n'apparaissait nulle part dans le dépôt.
 *
 * Ce n'était pas gratuit. `generateCircuit` est vivant — la carte-trophée
 * l'appelle, et depuis le 03/08 la fonction serveur `detect-circuit-corners`
 * aussi, pour chaque circuit. Chaque appel construisait donc un ruban de la
 * longueur du tracé, pour le jeter aussitôt.
 *
 * `src/render/ribbon.ts` n'est PAS son remplaçant, et il ne faut pas le croire :
 * il ne prend pas de paramètre `closed`, donc il ne sait pas refermer un tour.
 * Ceci est une suppression de code mort, pas une migration.
 */

/**
 * Réglage de dérivation des virages depuis une centerline lat/lon en base.
 *
 * IL VIT ICI, ET PAS AILLEURS, POUR UNE RAISON PRÉCISE.
 *
 * Deux appelants dérivent les virages d'un même circuit :
 *
 *   - l'application, pour les repères affichés au coach
 *     (`src/circuit/circuitCorners.ts`) ;
 *   - la fonction serveur `detect-circuit-corners`, qui écrit `circuits.corners`.
 *
 * S'ils partaient de réglages distincts, le même circuit porterait deux
 * vérités : quatorze virages à l'écran, un autre compte en base, et un coach
 * annotant « le virage 9 » désignerait deux endroits différents selon qui
 * regarde. Ce module n'importe rien — il est donc lisible par le moteur Deno
 * comme par Metro, et ce réglage est le seul.
 *
 * `smoothWin: 0` est mesuré, pas supposé : voir l'en-tête de `circuitCorners.ts`.
 */
export const PARAMS_CENTERLINE = {
  smoothWin: 0,
  resampleStep: 10,
  cornerRadius: 100,
} as const;

// --- 8. Pipeline complet -----------------------------------------------------
export function generateCircuit(rawPoints: LatLon[], opts: GenerateCircuitOptions = {}): Circuit {
  const {
    smoothWin = 1, // débruitage (OSM propre = 1 ; GPS brut = 6-10)
    resampleStep = 10, // mètres entre points rééchantillonnés
    cornerRadius = 100, // seuil de rayon (m) pour qu'une courbe soit un virage
    // `trackWidth` NE PILOTE PLUS RIEN depuis le retrait du ruban (03/08/2026).
    // Conservé dans `params` parce qu'il fait partie du type public, et pour
    // que les tracés déjà enregistrés gardent la trace du réglage qui les a
    // produits. Aucun calcul ne le lit.
    trackWidth = 12,
    closed = true,
  } = opts;

  const projected = projectToMeters(rawPoints);
  const smoothed = smooth(projected, smoothWin, closed);
  const resampled = resampleByDistance(smoothed, resampleStep);
  const k = curvature(resampled);
  const corners = detectCorners(resampled, k, cornerRadius);

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
    length_m: Math.round(length_m),
    closed,
    params: { smoothWin, resampleStep, cornerRadius, trackWidth, closed },
  };
}
