// =============================================================================
// OXV — Edge Function : validate-inscription  (RÉELLE) — v10
// =============================================================================
// Traite une demande d'inscription (table public.demandes_inscription) :
//
//   action = "accept"      -> crée le compte Supabase Auth (service_role) avec
//                             le bon rôle, crée/complète la ligne public.users,
//                             génère un lien "définir mon mot de passe",
//                             envoie l'e-mail d'acceptation, journalise,
//                             passe la demande en 'acceptee'.
//                             v9  : COACH accepté = opérationnel immédiatement
//                                   (coach_permissions + fiche brouillon).
//                             v10 : PARTENAIRE accepté = compte entreprise
//                                   partner_accounts créé 'validated' (la
//                                   candidature vient d'être validée par
//                                   l'admin, infos société comprises).
//   action = "reject"      -> e-mail de refus, passe en 'refusee'.
//   action = "acknowledge" -> accusé de réception (statut inchangé).
//
// AUTH : serveur-à-serveur par secret partagé (x-oxv-admin-secret).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';
import {
  renderApproval,
  renderRejection,
  renderAcknowledgement,
} from './emails.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-oxv-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// type_demande (pilote | pilote_pro | coach | partenaire) -> user_role (pilot | coach | partner)
function mapRole(typeDemande: string): 'pilot' | 'coach' | 'partner' {
  if (typeDemande === 'coach') return 'coach';
  if (typeDemande === 'partenaire') return 'partner';
  return 'pilot';
}

interface ResendResult {
  ok: boolean;
  resend_message_id: string | null;
  error: string | null;
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  category: string,
): Promise<ResendResult> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        text,
        reply_to: 'contact@oxvehicle.fr',
        tags: [{ name: 'category', value: category }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        resend_message_id: null,
        error: `resend_${res.status}: ${JSON.stringify(data).slice(0, 200)}`,
      };
    }
    return { ok: true, resend_message_id: data?.id ?? null, error: null };
  } catch (e) {
    return { ok: false, resend_message_id: null, error: String(e) };
  }
}

async function logEmail(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    emailType: string;
    subject: string;
    template: string;
    result: ResendResult;
    to: string;
    demandeId: string;
  },
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('email_log')
      .insert({
        user_id: params.userId,
        email_type: params.emailType,
        subject: params.subject,
        template_used: params.template,
        status: params.result.ok ? 'sent' : 'bounced',
        metadata: {
          to: params.to,
          demande_id: params.demandeId,
          resend_message_id: params.result.resend_message_id,
          error: params.result.error,
        },
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[validate-inscription] email_log insert:', error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.warn('[validate-inscription] email_log threw:', String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SECRET = Deno.env.get('VALIDATE_INSCRIPTION_SECRET');
  if (!SECRET) {
    return json(
      {
        error: 'function_disabled',
        detail:
          'VALIDATE_INSCRIPTION_SECRET non configuré — fonction dormante. ' +
          'Posez le secret pour l’armer.',
      },
      503,
    );
  }
  const provided = req.headers.get('x-oxv-admin-secret') ?? '';
  if (provided !== SECRET) return json({ error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.oxvehicle.fr';

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: {
    demande_id?: string;
    action?: string;
    admin_note?: string | null;
    reviewed_by?: string | null;
    dry_run?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const {
    demande_id,
    action = 'accept',
    admin_note = null,
    reviewed_by = null,
    dry_run = false,
  } = payload;
  if (!demande_id) return json({ error: 'missing_demande_id' }, 400);
  if (!['accept', 'reject', 'acknowledge'].includes(action)) {
    return json({ error: 'invalid_action', detail: action }, 400);
  }
  const reviewerId = reviewed_by && UUID_RE.test(reviewed_by) ? reviewed_by : null;

  const { data: demande, error: demErr } = await admin
    .from('demandes_inscription')
    .select('*')
    .eq('id', demande_id)
    .single();
  if (demErr || !demande) return json({ error: 'demande_not_found' }, 404);

  if (action !== 'acknowledge' && demande.statut !== 'en_attente') {
    return json(
      { error: 'demande_already_processed', statut: demande.statut },
      409,
    );
  }

  const reference = `OXV-${String(demande.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const firstName = demande.first_name ?? '';

  if (!RESEND_KEY) {
    return json(
      { error: 'resend_not_configured', detail: 'RESEND_API_KEY manquante.' },
      500,
    );
  }

  if (action === 'acknowledge') {
    const mail = renderAcknowledgement({ firstName, reference });
    if (dry_run) {
      return json({
        ok: true,
        dry_run: true,
        action,
        would_send: 'inscription_received',
        to: demande.email,
        subject: mail.subject,
      });
    }
    const result = await sendViaResend(
      RESEND_KEY,
      demande.email,
      mail.subject,
      mail.html,
      mail.text,
      'inscription_received',
    );
    const logId = await logEmail(admin, {
      userId: demande.created_user_id ?? null,
      emailType: 'inscription_received',
      subject: mail.subject,
      template: 'inscription_received_v1',
      result,
      to: demande.email,
      demandeId: demande_id,
    });
    return json({
      ok: true,
      action,
      email_sent: result.ok,
      email_error: result.error,
      email_log_id: logId,
    });
  }

  if (action === 'reject') {
    const mail = renderRejection({ firstName, reference, adminNote: admin_note });
    if (dry_run) {
      return json({
        ok: true,
        dry_run: true,
        action,
        would_set_statut: 'refusee',
        would_send: 'inscription_rejected',
        to: demande.email,
        subject: mail.subject,
      });
    }
    const { error: upErr } = await admin
      .from('demandes_inscription')
      .update({
        statut: 'refusee',
        admin_note,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', demande_id);
    if (upErr) return json({ error: 'update_failed', detail: upErr.message }, 500);

    const result = await sendViaResend(
      RESEND_KEY,
      demande.email,
      mail.subject,
      mail.html,
      mail.text,
      'inscription_rejected',
    );
    const logId = await logEmail(admin, {
      userId: null,
      emailType: 'inscription_rejected',
      subject: mail.subject,
      template: 'inscription_rejected_v1',
      result,
      to: demande.email,
      demandeId: demande_id,
    });
    return json({
      ok: true,
      action,
      statut: 'refusee',
      email_sent: result.ok,
      email_error: result.error,
      email_log_id: logId,
    });
  }

  // ACCEPT
  const role = mapRole(demande.type_demande);

  if (dry_run) {
    return json({
      ok: true,
      dry_run: true,
      action: 'accept',
      would_create_user: demande.email,
      role,
      would_grant_coach_permissions: role === 'coach',
      would_create_partner_account: role === 'partner',
      would_set_statut: 'acceptee',
      would_send: 'inscription_approved',
    });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: demande.email,
    email_confirm: true,
    user_metadata: {
      first_name: demande.first_name,
      last_name: demande.last_name,
      source: 'demande_inscription',
    },
  });

  let newUserId: string | null = created?.user?.id ?? null;

  if (createErr) {
    const already = /already registered|already been registered|exists/i.test(
      createErr.message,
    );
    if (!already) {
      return json(
        { error: 'create_user_failed', detail: createErr.message },
        500,
      );
    }
    const { data: list } = await admin.auth.admin.listUsers();
    const found = list?.users?.find(
      (u) => (u.email ?? '').toLowerCase() === demande.email.toLowerCase(),
    );
    newUserId = found?.id ?? null;
    if (!newUserId) return json({ error: 'existing_user_not_found' }, 500);
  }

  const profileRow: Record<string, unknown> = {
    id: newUserId,
    email: demande.email,
    first_name: demande.first_name,
    last_name: demande.last_name,
    role,
    email_verified: true,
  };
  if (demande.phone) profileRow.phone = demande.phone;
  if (demande.birth_date) profileRow.birth_date = demande.birth_date;
  if (demande.city) profileRow.city = demande.city;

  const { error: upsertErr } = await admin
    .from('users')
    .upsert(profileRow, { onConflict: 'id' });
  if (upsertErr) {
    const { error: minErr } = await admin.from('users').upsert(
      {
        id: newUserId,
        email: demande.email,
        first_name: demande.first_name,
        last_name: demande.last_name,
        role,
      },
      { onConflict: 'id' },
    );
    if (minErr) {
      return json({ error: 'profile_upsert_failed', detail: minErr.message }, 500);
    }
  }

  // 2bis) Droits opérationnels selon le rôle (best-effort, journalisé + renvoyé).
  const grants: Record<string, string> = {};

  // COACH (v9) : opérationnel dès validation — arbitrage fondateur 2026-07-19.
  if (role === 'coach' && newUserId) {
    const { error: permErr } = await admin.from('coach_permissions').upsert(
      {
        user_id: newUserId,
        can_view_pilots: true,
        can_manage_own_sessions: true,
        granted_by: reviewerId,
      },
      { onConflict: 'user_id' },
    );
    grants.coach_permissions = permErr ? `erreur: ${permErr.message}` : 'ok';
    if (permErr) console.warn('[validate-inscription] coach_permissions:', permErr.message);

    const { data: prof } = await admin
      .from('coach_profiles')
      .select('coach_id')
      .eq('coach_id', newUserId)
      .maybeSingle();
    if (!prof) {
      const { error: profErr } = await admin.from('coach_profiles').insert({
        coach_id: newUserId,
        headline: `${demande.first_name ?? ''} ${demande.last_name ?? ''}`.trim() || null,
        specialties: demande.coaching_tracks ? [String(demande.coaching_tracks)] : null,
        is_published: false,
      });
      grants.coach_profiles = profErr ? `erreur: ${profErr.message}` : 'brouillon créé';
      if (profErr) console.warn('[validate-inscription] coach_profiles:', profErr.message);
    } else {
      grants.coach_profiles = 'déjà existante';
    }
  }

  // PARTENAIRE (v10) : compte entreprise prêt dès validation — demande fondateur
  // 2026-07-19 (« candidature partenaire aussi »). Statut 'validated' assumé :
  // l'admin vient de valider la candidature, infos société comprises. Les offres
  // et événements restent validés ÉLÉMENT PAR ÉLÉMENT (arbitrage 2026-07-18).
  if (role === 'partner' && newUserId) {
    const { data: acc } = await admin
      .from('partner_accounts')
      .select('id')
      .eq('profile_id', newUserId)
      .maybeSingle();
    if (!acc) {
      const { error: accErr } = await admin.from('partner_accounts').insert({
        profile_id: newUserId,
        display_name:
          (demande.company_name ??
            `${demande.first_name ?? ''} ${demande.last_name ?? ''}`.trim()) ||
          'Partenaire OXV',
        type: 'autre',
        contact_email: demande.email,
        status: 'validated',
      });
      grants.partner_account = accErr ? `erreur: ${accErr.message}` : 'compte entreprise créé (validated)';
      if (accErr) console.warn('[validate-inscription] partner_accounts:', accErr.message);
    } else {
      grants.partner_account = 'déjà existant';
    }
  }

  let actionLink: string | null = null;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: demande.email,
    options: { redirectTo: `${SITE_URL}/?p=reset-password` },
  });
  if (linkErr) {
    console.warn('[validate-inscription] generateLink:', linkErr.message);
  } else {
    actionLink =
      (linkData?.properties as { action_link?: string } | undefined)
        ?.action_link ?? null;
  }

  const mail = renderApproval({ firstName, reference, actionLink });
  const result = await sendViaResend(
    RESEND_KEY,
    demande.email,
    mail.subject,
    mail.html,
    mail.text,
    'inscription_approved',
  );
  const logId = await logEmail(admin, {
    userId: newUserId,
    emailType: 'inscription_approved',
    subject: mail.subject,
    template: 'inscription_approved_v1',
    result,
    to: demande.email,
    demandeId: demande_id,
  });

  const { error: finErr } = await admin
    .from('demandes_inscription')
    .update({
      statut: 'acceptee',
      admin_note,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      created_user_id: newUserId,
    })
    .eq('id', demande_id);
  if (finErr) {
    return json({ error: 'finalize_failed', detail: finErr.message }, 500);
  }

  return json({
    ok: true,
    action: 'accept',
    statut: 'acceptee',
    user_id: newUserId,
    role,
    grants,
    email_sent: result.ok,
    email_error: result.error,
    email_log_id: logId,
    action_link: actionLink,
  });
});
