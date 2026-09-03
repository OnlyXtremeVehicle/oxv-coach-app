// =============================================================================
// OXV — Edge Function : admin-review-inscription  (RÉELLE)
// =============================================================================
// Revue d'une demande d'inscription (public.demandes_inscription) PAR UN ADMIN
// AUTHENTIFIÉ, depuis l'app. Couvre le cas que la RPC SQL ne peut pas traiter :
// la création d'un compte Auth pour une nouvelle inscription (pilote/coach sans
// compte), avec e-mail d'activation.
//
// AUTH : verify_jwt = true (le gateway valide le JWT de l'appelant). En plus, la
// fonction vérifie que l'appelant est administrateur (public.users.role='admin'
// ou is_admin=true). Un non-admin -> 403.
//
// ARCHITECTURE : fonction MINCE. Elle ne réimplmente pas la création de compte
// ni les e-mails : elle délègue à validate-inscription (source unique de vérité)
// via le secret serveur VALIDATE_INSCRIPTION_SECRET — le même qui arme le flux du
// site. Si le secret est absent, renvoie 503 (service non armé) avec consigne.
//
// Env requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//              (présents d'office) + VALIDATE_INSCRIPTION_SECRET (à poser).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const FORWARD_SECRET = Deno.env.get('VALIDATE_INSCRIPTION_SECRET');

  // --- 1) Auth : JWT valide (gateway) + rôle admin -----------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const caller = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: gu, error: guErr } = await caller.auth.getUser();
  if (guErr || !gu?.user) return json({ error: 'unauthorized' }, 401);
  const callerId = gu.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: prof } = await admin
    .from('users')
    .select('role, is_admin')
    .eq('id', callerId)
    .maybeSingle();
  const isAdmin = !!prof && (((prof as Record<string, unknown>).role === 'admin') || ((prof as Record<string, unknown>).is_admin === true));
  if (!isAdmin) return json({ error: 'forbidden' }, 403);

  // --- 2) Corps ----------------------------------------------------------------
  let payload: { demande_id?: string; action?: string; admin_note?: string | null; dry_run?: boolean };
  try { payload = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { demande_id, action = 'accept', admin_note = null, dry_run = false } = payload ?? {};
  if (!demande_id) return json({ error: 'missing_demande_id' }, 400);
  if (!['accept', 'reject', 'acknowledge'].includes(action)) {
    return json({ error: 'invalid_action', detail: action }, 400);
  }

  // --- 3) Service d'inscription armé ? -----------------------------------------
  if (!FORWARD_SECRET) {
    return json({
      error: 'inscription_service_unarmed',
      detail: 'Posez le secret VALIDATE_INSCRIPTION_SECRET pour activer la création de compte.',
    }, 503);
  }

  // --- 4) Délégation à validate-inscription ------------------------------------
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/validate-inscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-oxv-admin-secret': FORWARD_SECRET,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'apikey': SERVICE_ROLE,
      },
      body: JSON.stringify({ demande_id, action, admin_note, reviewed_by: callerId, dry_run }),
    });
  } catch (e) {
    return json({ error: 'forward_failed', detail: String(e) }, 502);
  }

  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return new Response(JSON.stringify(body), {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
