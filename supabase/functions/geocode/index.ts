import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Géocodage adresse -> coordonnées, au moment de publier un lieu.
// Fournisseur : LocationIQ si GEOCODER_KEY est posé (fiable, compatible Nominatim) ;
// repli sur Nominatim public (OSM) sinon. Même forme de réponse dans les deux cas.
// Politique : 1 req/s, User-Agent identifiant OXV. Ne pas géocoder en masse.

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ found: false, error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide toléré */ }
  const q = String(body?.q ?? '').trim();
  const viewbox = typeof body?.viewbox === 'string' ? (body.viewbox as string) : '';
  if (q.length < 3) return json({ found: false, error: 'query_too_short' }, 400);

  const key = Deno.env.get('GEOCODER_KEY') ?? '';
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '1', addressdetails: '0', countrycodes: 'fr' });
  if (viewbox) { params.set('viewbox', viewbox); params.set('bounded', '0'); }

  let url: string;
  if (key) { params.set('key', key); url = `https://us1.locationiq.com/v1/search?${params.toString()}`; }
  else { url = `https://nominatim.openstreetmap.org/search?${params.toString()}`; }

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'OXV-Mirror/1.0 (https://oxvehicle.fr; contact@oxvehicle.fr)',
        'Accept-Language': 'fr',
        'Accept': 'application/json',
      },
    });
    if (!r.ok) return json({ found: false, error: 'provider_error', status: r.status }, 502);
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return json({ found: false });
    const top = arr[0] as Record<string, unknown>;
    const lat = Number(top.lat), lon = Number(top.lon);
    if (!isFinite(lat) || !isFinite(lon)) return json({ found: false });
    return json({ found: true, lat, lon, display_name: (top.display_name as string) ?? null });
  } catch (e) {
    return json({ found: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
