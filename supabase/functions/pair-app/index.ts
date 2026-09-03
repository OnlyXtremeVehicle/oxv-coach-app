// =============================================================================
// OXV — Edge Function : pair-app (PR-HUB-04)
// =============================================================================
// Appairage compte site <-> app mobile.
//   action=generate : utilisateur AUTHENTIFIÉ (JWT dans Authorization) -> crée un
//     code court (8 car., alphabet non ambigu), valable 10 min, usage unique.
//     Invalide les codes actifs précédents du même utilisateur.
//   action=redeem : l'app poste { code } (PAS de JWT : l'utilisateur n'est pas
//     encore connecté dans l'app) -> vérifie, marque utilisé, génère un magiclink
//     et renvoie { token_hash } ; l'app appelle verifyOtp({type:'magiclink',
//     token_hash}) et obtient sa session Supabase.
// Sécurité : verify_jwt=false car redeem est pré-auth ; generate valide le JWT
// explicitement via auth.getUser(). Anti-brute-force redeem : 10 tentatives/min/IP
// (table app_pairing_redeem_attempts, service role). Aucun code ni token loggé.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 32 symboles, sans 0/O/1/I/L
function makeCode(len = 8): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = '';
  for (const b of buf) out += ALPHABET[b % ALPHABET.length];
  return out;
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { action?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const action = body?.action;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── GENERATE : réservé à un utilisateur connecté (site) ───
  if (action === 'generate') {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'auth_required' }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'auth_invalid' }, 401);
    const uid = userData.user.id;

    // Invalide les codes actifs précédents (un seul code vivant par utilisateur)
    await admin.from('app_pairing_codes')
      .update({ used_at: new Date().toISOString(), used_user_agent: 'superseded' })
      .eq('user_id', uid).is('used_at', null);

    // Création (retry en cas de collision improbable sur l'index unique)
    for (let i = 0; i < 3; i++) {
      const code = makeCode();
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await admin.from('app_pairing_codes').insert({ user_id: uid, code, expires_at });
      if (!error) return json({ code, expires_at });
      if (!String(error.message).includes('duplicate')) return json({ error: 'insert_failed' }, 500);
    }
    return json({ error: 'collision' }, 500);
  }

  // ─── REDEEM : pré-auth (app), rate-limité ───
  if (action === 'redeem') {
    const raw = (body?.code ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '');
    if (raw.length !== 8) return json({ error: 'invalid_or_expired' }, 400);

    // Rate-limit : 10 tentatives / minute / IP (hashée, jamais stockée en clair)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const ipHash = await sha256Hex(ip);
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from('app_pairing_redeem_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('created_at', oneMinAgo);
    if ((count ?? 0) >= 10) return json({ error: 'rate_limited' }, 429);
    await admin.from('app_pairing_redeem_attempts').insert({ ip_hash: ipHash });
    // Purge opportuniste (>1h)
    admin.from('app_pairing_redeem_attempts').delete().lt('created_at', new Date(Date.now() - 3_600_000).toISOString()).then(() => {});

    // Vérification + consommation atomique du code
    const nowIso = new Date().toISOString();
    const { data: rows } = await admin.from('app_pairing_codes')
      .update({ used_at: nowIso, used_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 200) })
      .eq('code', raw).is('used_at', null).gt('expires_at', nowIso)
      .select('user_id');
    if (!rows || rows.length === 0) return json({ error: 'invalid_or_expired' }, 400);

    // Email du compte -> magiclink -> token_hash (usage unique) pour verifyOtp côté app
    const { data: udata, error: uerr } = await admin.auth.admin.getUserById(rows[0].user_id);
    if (uerr || !udata?.user?.email) return json({ error: 'user_not_found' }, 500);
    const { data: link, error: lerr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: udata.user.email });
    const tokenHash = link?.properties?.hashed_token;
    if (lerr || !tokenHash) return json({ error: 'link_failed' }, 500);

    return json({ token_hash: tokenHash, verify_type: 'magiclink' });
  }

  return json({ error: 'bad_action' }, 400);
});
