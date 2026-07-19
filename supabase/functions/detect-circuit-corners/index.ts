// @ts-nocheck — Deno runtime
// Edge Function : detect-circuit-corners (moteur corners-v1)
//
// Body : { circuitId: string }
// Détecte automatiquement les virages d'un circuit à partir de sa géométrie
// (track_svg_path) et écrit `circuits.corners`. Fonctionne pour les circuits
// officiels ET les tracés pilote, dès qu'une géométrie existe.
//
// Pipeline : parse polyligne SVG -> ré-échantillonnage cyclique à pas constant
// -> courbure signée (Menger, le signe donne le sens gauche/droite)
// -> lissage -> groupes au-dessus du seuil -> apex = courbure max
// -> fusion des apex trop proches (double corde d'un même virage).
// Échelle mètres = length_km / longueur d'arc SVG.
//
// IMPORTANT : tant que la géométrie est le schéma dessiné (calibration=schematic_svg),
// rayons et positions sont APPROXIMATIFS. Le calage définitif vient de la
// télémétrie (Valence) : relancer cette fonction sur le centre de piste dérivé
// des vrais tours figera le tracé. Les NOMS de virages sont une couche
// éditoriale, assignée séparément (jamais devinée ici).
//
// verify_jwt = true (déclenché côté admin à la création/maj d'un circuit).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENGINE = 'corners-v1';
const P = { ds: 4, k: 4, smooth: 1, thr: 0.012, merge_gap_pct: 5.5 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function parsePath(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  if (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) pts.pop(); // tracé fermé : retirer le doublon
  }
  return pts;
}
function arcLen(pts) { let L = 0; for (let i = 0; i < pts.length; i++) L += dist(pts[i], pts[(i + 1) % pts.length]); return L; }
function resample(pts, ds) {
  const out = []; let i = 0, acc = 0, cur = { ...pts[0] };
  const n = pts.length, total = arcLen(pts); let travelled = 0, guard = 0;
  out.push({ ...cur });
  while (travelled < total - 1e-6 && guard++ < 200000) {
    const nxt = pts[(i + 1) % n], seg = dist(cur, nxt);
    if (acc + seg >= ds) {
      const t = (ds - acc) / seg;
      cur = { x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t };
      out.push({ ...cur }); travelled += ds; acc = 0;
    } else { acc += seg; travelled += seg; cur = { ...nxt }; i = (i + 1) % n; }
  }
  return out;
}
function curvature(pts, k) {
  const n = pts.length, c = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - k + n) % n], b = pts[i], d = pts[(i + k) % n];
    const ab = dist(a, b), bd = dist(b, d), ad = dist(a, d);
    const cross = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
    const denom = ab * bd * ad;
    c[i] = denom > 1e-9 ? (4 * (cross / 2)) / denom : 0; // signé : sens du virage
  }
  return c;
}
function smooth(a, w) {
  const n = a.length, o = new Array(n);
  for (let i = 0; i < n; i++) { let s = 0, cnt = 0; for (let j = -w; j <= w; j++) { s += a[(i + j + n) % n]; cnt++; } o[i] = s / cnt; }
  return o;
}
function detect(pts, c, thr, scale, gapPct) {
  const n = pts.length, hot = c.map((v) => Math.abs(v) > thr);
  let start = hot.indexOf(false); if (start < 0) start = 0;
  const groups = []; let cur = null;
  for (let s = 0; s < n; s++) { const i = (start + s) % n; if (hot[i]) { if (!cur) cur = []; cur.push(i); } else { if (cur) { groups.push(cur); cur = null; } } }
  if (cur) groups.push(cur);
  let cs = groups.map((g) => {
    let a = g[0]; for (const i of g) if (Math.abs(c[i]) > Math.abs(c[a])) a = i;
    const kap = Math.abs(c[a]); const rSvg = kap > 1e-9 ? 1 / kap : 1e9;
    return { apex: a, dir: c[a] > 0 ? 'left' : 'right', r_m: Number((rSvg * scale).toFixed(1)) };
  });
  const minGap = n * gapPct / 100; cs.sort((a, b) => a.apex - b.apex);
  const m = [];
  for (const v of cs) { const l = m[m.length - 1]; if (l && (v.apex - l.apex) < minGap) { if (v.r_m < l.r_m) m[m.length - 1] = v; } else m.push(v); }
  return m.map((v, i) => ({ corner_index: i + 1, direction: v.dir, apex_s_norm: Number((v.apex / n).toFixed(4)), r_m: v.r_m, name: null, calibration: 'schematic_svg' }));
}

Deno.serve(async (req) => {
  try {
    const { circuitId } = await req.json();
    if (!circuitId) return new Response(JSON.stringify({ error: 'circuitId requis' }), { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );

    const { data: circuit } = await supabase
      .from('circuits').select('id, name, track_svg_path, length_km').eq('id', circuitId).maybeSingle();
    if (!circuit) return new Response(JSON.stringify({ error: 'circuit_not_found' }), { status: 404 });

    // Géométrie absente (ex. tracé pilote non encore dessiné) : retour clair, pas d'échec.
    if (!circuit.track_svg_path) {
      return new Response(JSON.stringify({ ok: false, reason: 'no_geometry', circuitId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const pts = parsePath(circuit.track_svg_path);
    if (pts.length < 8) {
      return new Response(JSON.stringify({ ok: false, reason: 'geometry_too_short', points: pts.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const rs = resample(pts, P.ds);
    const total = arcLen(rs);
    const lengthM = Number(circuit.length_km) > 0 ? Number(circuit.length_km) * 1000 : total; // sans longueur : échelle neutre
    const scale = lengthM / total;
    const c = smooth(curvature(rs, P.k), P.smooth);
    const corners = detect(rs, c, P.thr, scale, P.merge_gap_pct);

    const payload = { engine_version: ENGINE, params: P, n_corners: corners.length, corners };
    const { error } = await supabase.from('circuits')
      .update({ corners: payload, corners_engine_version: ENGINE, corners_computed_at: new Date().toISOString() })
      .eq('id', circuitId);
    if (error) return new Response(JSON.stringify({ error: 'persist_failed', detail: error.message }), { status: 500 });

    return new Response(JSON.stringify({ ok: true, circuitId, name: circuit.name, n_corners: corners.length, engine: ENGINE }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
