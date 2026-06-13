// =============================================================================
// OXV — Générateur de circuits 3D
// Entrée : un way OpenStreetMap (ou un tableau de {lat, lon})
// Sortie : tracé débruité, virages détectés (analyse des changements de cap),
//          géométrie de ruban prête pour Three.js.
// Aucune dépendance externe. Fonctionne dans Node et dans le navigateur.
//
// Attribution OSM obligatoire à l'affichage : « © contributeurs OpenStreetMap ».
// =============================================================================

// --- 1. Récupération d'un tracé depuis OpenStreetMap -------------------------
export async function fetchOsmWay(wayId, fetchImpl) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error("Aucune implémentation fetch disponible.");
  const url = `https://api.openstreetmap.org/api/0.6/way/${wayId}/full.json`;
  const res = await f(url);
  if (!res.ok) throw new Error(`OSM a répondu ${res.status} pour le way ${wayId}.`);
  const osm = await res.json();
  return parseOsmWay(osm);
}

// Parse la réponse OSM /full.json en {name, points:[{lat,lon}], closed}
export function parseOsmWay(osm) {
  const ways = osm.elements.filter(e => e.type === 'way');
  if (!ways.length) throw new Error("Aucun way dans la réponse OSM.");
  const way = ways[0];
  const nodesById = {};
  osm.elements.filter(e => e.type === 'node').forEach(n => { nodesById[n.id] = n; });
  const points = way.nodes
    .map(id => nodesById[id])
    .filter(n => n && n.lat != null)
    .map(n => ({ lat: n.lat, lon: n.lon }));
  const closed = way.nodes[0] === way.nodes[way.nodes.length - 1];
  return { name: way.tags?.name || null, points, closed, osmWayId: way.id };
}

// --- 2. Projection géographique → mètres (plan tangent local) ----------------
export function projectToMeters(points) {
  if (!points.length) return [];
  const lat0 = points[0].lat * Math.PI / 180;
  const mPerLat = 111320, mPerLon = 111320 * Math.cos(lat0);
  // origine au premier point pour des coordonnées petites et centrées
  const x0 = points[0].lon * mPerLon, y0 = points[0].lat * mPerLat;
  return points.map(p => ({ x: p.lon * mPerLon - x0, y: p.lat * mPerLat - y0 }));
}

// --- 3. Débruitage : moyenne glissante (passe-bas) ---------------------------
// win = demi-fenêtre. Sur tracé OSM propre : 1. Sur GPS RaceBox brut : 6 à 10.
export function smooth(pts, win, closed) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, c = 0;
    for (let j = i - win; j <= i + win; j++) {
      let k = j;
      if (closed) k = ((j % n) + n) % n;          // boucle : on enroule
      else k = Math.max(0, Math.min(n - 1, j));    // ouvert : on borne
      sx += pts[k].x; sy += pts[k].y; c++;
    }
    out.push({ x: sx / c, y: sy / c });
  }
  return out;
}

// --- 4. Rééchantillonnage spatial : un point tous les `step` mètres ----------
export function resampleByDistance(pts, step) {
  if (!pts.length) return [];
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc >= step) { out.push(pts[i]); acc = 0; }
  }
  return out;
}

// --- 5. Courbure en chaque point via variation de cap ------------------------
// κ ≈ |Δcap| / distance  (rad/m). Le rayon vaut R = 1/κ.
export function curvature(pts) {
  const k = new Array(pts.length).fill(0);
  for (let i = 1; i < pts.length - 1; i++) {
    const h1 = Math.atan2(pts[i].y - pts[i-1].y, pts[i].x - pts[i-1].x);
    const h2 = Math.atan2(pts[i+1].y - pts[i].y, pts[i+1].x - pts[i].x);
    let dh = h2 - h1;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const d = (Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y)
             + Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y)) / 2;
    k[i] = d > 0 ? Math.abs(dh) / d : 0;
  }
  return k;
}

// --- 6. Détection des virages : zones contiguës de forte courbure ------------
// rThresh = rayon seuil (m) en dessous duquel on est "en virage".
// Hystérésis à 0,5×seuil pour ne pas hacher un virage en plusieurs.
export function detectCorners(pts, k, rThresh) {
  const kT = 1 / rThresh;
  const corners = [];
  let inC = false, start = 0;
  for (let i = 0; i < k.length; i++) {
    if (k[i] > kT && !inC) { inC = true; start = i; }
    else if (k[i] <= kT * 0.5 && inC) {
      inC = false;
      let apex = start, kmax = 0;
      for (let j = start; j < i; j++) if (k[j] > kmax) { kmax = k[j]; apex = j; }
      if (i - start >= 1) {
        corners.push({
          index: corners.length + 1,
          apexIdx: apex,
          startIdx: start,
          endIdx: i,
          radius_m: Math.round(1 / kmax),
          // sens du virage : signe du produit vectoriel tangentes
          direction: cornerDirection(pts, apex),
        });
      }
    }
  }
  return corners;
}

function cornerDirection(pts, i) {
  if (i <= 0 || i >= pts.length - 1) return 'unknown';
  const ax = pts[i].x - pts[i-1].x, ay = pts[i].y - pts[i-1].y;
  const bx = pts[i+1].x - pts[i].x, by = pts[i+1].y - pts[i].y;
  const cross = ax * by - ay * bx;
  return cross > 0 ? 'left' : 'right';
}

// --- 7. Géométrie du ruban 3D (deux bords parallèles) ------------------------
// width = largeur de piste en mètres. Renvoie sommets gauche/droite + tangente.
export function buildRibbon(pts, width, closed) {
  const half = width / 2, n = pts.length, ribbon = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[((i-1)%n+n)%n] : pts[Math.max(0, i-1)];
    const next = closed ? pts[(i+1)%n] : pts[Math.min(n-1, i+1)];
    const tx = next.x - prev.x, ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;  // normale
    ribbon.push({
      center: [pts[i].x, pts[i].y],
      left:  [pts[i].x + nx * half, pts[i].y + ny * half],
      right: [pts[i].x - nx * half, pts[i].y - ny * half],
    });
  }
  return ribbon;
}

// --- 8. Pipeline complet -----------------------------------------------------
export function generateCircuit(rawPoints, opts = {}) {
  const {
    smoothWin = 1,      // débruitage (OSM propre = 1 ; GPS brut = 6-10)
    resampleStep = 10,  // mètres entre points rééchantillonnés
    cornerRadius = 100, // seuil de rayon (m) pour qu'une courbe soit un virage
    trackWidth = 12,    // largeur de piste (m) pour le ruban 3D
    closed = true,
  } = opts;

  const projected = projectToMeters(rawPoints);
  const smoothed = smooth(projected, smoothWin, closed);
  const resampled = resampleByDistance(smoothed, resampleStep);
  const k = curvature(resampled);
  const corners = detectCorners(resampled, k, cornerRadius);
  const ribbon = buildRibbon(resampled, trackWidth, closed);

  let length_m = 0;
  for (let i = 1; i < resampled.length; i++)
    length_m += Math.hypot(resampled[i].x - resampled[i-1].x, resampled[i].y - resampled[i-1].y);
  if (closed && resampled.length > 1)
    length_m += Math.hypot(resampled[0].x - resampled[resampled.length-1].x,
                           resampled[0].y - resampled[resampled.length-1].y);

  return {
    centerline: resampled,   // [{x,y}] débruité, en mètres
    corners,                 // virages détectés
    ribbon,                  // géométrie 3D
    length_m: Math.round(length_m),
    closed,
    params: { smoothWin, resampleStep, cornerRadius, trackWidth },
  };
}
