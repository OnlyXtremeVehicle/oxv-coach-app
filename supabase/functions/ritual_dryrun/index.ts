// =============================================================================
// supabase/functions/ritual_dryrun/index.ts
// =============================================================================
// Envoie un rituel test à une adresse email, avec des données fictives.
// N'écrit RIEN en base de données. Utilisé par le bouton "Envoi test" de
// la page admin.
//
// Auth : le frontend appelle cette function via supabase.functions.invoke()
// qui propage automatiquement le JWT de l'utilisateur connecté. On vérifie
// que l'utilisateur a le rôle admin via la table `users`. Surtout PAS de
// service_role_key côté client.
//
// Déploiement :
//   supabase functions deploy ritual_dryrun
//   (PAS --no-verify-jwt : on veut le JWT de l'admin, vérifié par Supabase)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.114.0';

// Tentative d'import des handlers depuis ritual_dispatcher (déployé en parallèle).
// Si l'import échoue (handlers absents), on bascule sur un envoi simplifié via Resend.
let handleJMinus7: ((ctx: unknown) => Promise<{ resend_message_id?: string }>) | null = null;
let handleJMinus2: ((ctx: unknown) => Promise<{ resend_message_id?: string }>) | null = null;
let handleJMinus1: ((ctx: unknown) => Promise<{ resend_message_id?: string }>) | null = null;
try {
  const j7 = await import('../ritual_dispatcher/handlers/jminus7.ts');
  const j2 = await import('../ritual_dispatcher/handlers/jminus2.ts');
  const j1 = await import('../ritual_dispatcher/handlers/jminus1.ts');
  handleJMinus7 = j7.handleJMinus7 as typeof handleJMinus7;
  handleJMinus2 = j2.handleJMinus2 as typeof handleJMinus2;
  handleJMinus1 = j1.handleJMinus1 as typeof handleJMinus1;
} catch (e) {
  console.warn('[ritual_dryrun] ritual_dispatcher handlers indisponibles, fallback Resend simple :', (e as Error).message);
}

interface DryrunRequest {
  ritual_type: 'jminus7' | 'jminus2' | 'jminus1';
  to_email: string;
  pilot_first_name?: string;
  vehicle_label?: string;
  session_format?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // -------------------------------------------------------------------------
    // 1) Vérification du JWT et du rôle admin
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization header manquant' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Configuration serveur incomplète (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant)' }, 500);
    }

    // Client admin pour vérifier l'utilisateur appelant
    const sbAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userJwt = authHeader.slice('Bearer '.length);
    const { data: userData, error: userErr } = await sbAdmin.auth.getUser(userJwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'JWT invalide ou expiré' }, 401);
    }

    const { data: profile, error: profileErr } = await sbAdmin
      .from('users')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    if (profileErr || profile?.role !== 'admin') {
      return jsonResponse({ error: 'Accès admin requis' }, 403);
    }

    // -------------------------------------------------------------------------
    // 2) Validation du body
    // -------------------------------------------------------------------------
    const body = (await req.json()) as DryrunRequest;
    if (!body.ritual_type || !body.to_email) {
      return jsonResponse({ error: 'ritual_type et to_email requis' }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.to_email)) {
      return jsonResponse({ error: 'Email invalide' }, 400);
    }
    if (!['jminus7', 'jminus2', 'jminus1'].includes(body.ritual_type)) {
      return jsonResponse({ error: 'ritual_type inconnu' }, 400);
    }

    // -------------------------------------------------------------------------
    // 3) Envoi du rituel
    // -------------------------------------------------------------------------
    const ctx = buildFakeContext(body);
    let result: { resend_message_id?: string } = {};

    if (handleJMinus7 && handleJMinus2 && handleJMinus1) {
      // Branche normale : on appelle les handlers de ritual_dispatcher
      switch (body.ritual_type) {
        case 'jminus7': result = await handleJMinus7(ctx); break;
        case 'jminus2': result = await handleJMinus2(ctx); break;
        case 'jminus1': result = await handleJMinus1(ctx); break;
      }
    } else {
      // Fallback : envoi Resend simplifié (sans audio J-2, sans météo J-1)
      result = await sendFallbackEmail(body);
    }

    return jsonResponse({
      ok: true,
      sent_to: body.to_email,
      ritual_type: body.ritual_type,
      resend_message_id: result.resend_message_id ?? null,
      fallback: !handleJMinus7,
    });
  } catch (e) {
    const msg = (e as Error).message ?? 'erreur inconnue';
    console.error('[ritual_dryrun] error:', e);
    return jsonResponse({ error: msg, stack: (e as Error).stack ?? null }, 500);
  }
});

// -----------------------------------------------------------------------------
// Fallback : envoi minimal via Resend quand ritual_dispatcher n'est pas déployé.
// Permet de valider la chaîne d'envoi avant le déploiement complet du Bloc D.
// -----------------------------------------------------------------------------
async function sendFallbackEmail(body: DryrunRequest): Promise<{ resend_message_id?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const fromAddr = Deno.env.get('RESEND_FROM') ?? 'OXV <no-reply@oxvehicle.fr>';
  if (!resendKey) {
    throw new Error('RESEND_API_KEY non configuré (Supabase Functions secrets)');
  }

  const labels: Record<string, string> = {
    jminus7: 'J-7 — Confirmation + Playlist',
    jminus2: 'J-2 — Audio briefing',
    jminus1: 'J-1 — Dernier mot + Météo',
  };

  const subject = `[TEST] OXV · ${labels[body.ritual_type] ?? body.ritual_type}`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1A1A1A">
      <p style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.18em;color:#6B6B6B;text-transform:uppercase;margin:0 0 16px">RITUEL TEST · ${body.ritual_type.toUpperCase()}</p>
      <h1 style="font-size:24px;font-style:italic;font-weight:300;margin:0 0 16px">Bonjour ${escapeHtml(body.pilot_first_name ?? 'Pilote')},</h1>
      <p style="font-size:15px;line-height:1.7">Ceci est un envoi <strong>de test</strong> du rituel <strong>${labels[body.ritual_type]}</strong>.</p>
      <p style="font-size:13px;color:#6B6B6B;line-height:1.6">Véhicule simulé : ${escapeHtml(body.vehicle_label ?? '—')}<br>Format : ${escapeHtml(body.session_format ?? '—')}</p>
      <hr style="border:none;border-top:0.5px solid #E8E6E0;margin:24px 0">
      <p style="font-size:12px;color:#6B6B6B">Cet email a été déclenché depuis l'admin OXV. Aucune ligne n'a été créée en base. Le rendu complet (audio J-2, météo J-1, playlist J-7) nécessite le déploiement de <code>ritual_dispatcher</code>.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to: body.to_email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status} : ${errBody}`);
  }

  const json = await res.json();
  return { resend_message_id: json.id };
}

// -----------------------------------------------------------------------------
function buildFakeContext(body: DryrunRequest) {
  const firstName = body.pilot_first_name || 'Pilote test';
  const vehicleParts = (body.vehicle_label || 'Porsche 911').split(' ');
  const make = vehicleParts[0];
  const model = vehicleParts.slice(1).join(' ') || 'modèle';

  const sessionDate = new Date(Date.now() + 7 * 86400 * 1000).toISOString().split('T')[0];

  return {
    dispatch: {
      id: `dryrun-${Date.now()}`,
      registration_id: 'dryrun-registration',
      user_id: 'dryrun-user',
      session_id: 'dryrun-session',
      ritual_type: body.ritual_type,
      status: 'generating' as const,
      scheduled_for: new Date().toISOString(),
      attempt_count: 0,
    },
    pilot: {
      id: 'dryrun-user',
      first_name: firstName,
      last_name: 'Test',
      email: body.to_email,
      ritual_jminus7_enabled: true,
      ritual_jminus2_enabled: true,
      ritual_jminus1_enabled: true,
    },
    session: {
      id: 'dryrun-session',
      session_date: sessionDate,
      session_format: body.session_format || 'Access',
    },
    registration: {
      id: 'dryrun-registration',
      ref: 'OXV-DRYRUN01',
    },
    vehicle: {
      make,
      model,
      year: 2024,
    },
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
