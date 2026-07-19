// =============================================================================
// OXV — Edge Function : send-application-ack (v2)
// =============================================================================
// Accusé de réception d'une candidature (trigger trg_application_ack).
// v2 : surcharge éditoriale via email_templates, clé 'candidature_recue'
// (enabled=true). Variables : {{first_name}}, {{reference}}.
// AUTH : x-oxv-invoke-secret. Idempotent via demandes_inscription.ack_sent_at.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const RED = '#C8102E';

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function subst(t: string, vars: Record<string, string>): string {
  return String(t ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}
function wrap(inner: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:44px 40px;">
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV &middot; CANDIDATURE REÇUE</p>
      <div style="width:36px;height:2px;background:${RED};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
      ${inner}
      <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503 });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let applicationId: string | undefined;
  try { applicationId = (await req.json())?.application_id; } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  if (!applicationId) return new Response(JSON.stringify({ error: 'missing_application_id' }), { status: 400 });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: app, error: loadErr } = await admin
    .from('demandes_inscription')
    .select('id, first_name, email, ack_sent_at')
    .eq('id', applicationId)
    .maybeSingle();
  if (loadErr || !app) return new Response(JSON.stringify({ error: 'application_not_found' }), { status: 404 });

  if (app.ack_sent_at) return new Response(JSON.stringify({ ok: true, skipped: 'already_acked' }), { status: 200 });
  if (!app.email) return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });

  const reference = `OXV-${String(app.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const vars = { first_name: app.first_name ?? '', reference };

  let override: { subject: string | null; html_body: string | null } | null = null;
  try {
    const { data: tpl } = await admin.from('email_templates')
      .select('subject, html_body').eq('template_key', 'candidature_recue').eq('enabled', true).maybeSingle();
    if (tpl) override = tpl;
  } catch (_) { /* défaut codé */ }

  const greet = vars.first_name ? `Bonjour ${escapeHtml(vars.first_name)}.` : 'Bonjour.';
  let mailSubject: string, html: string, text: string, templateUsed: string;
  if (override && override.html_body && override.html_body.trim()) {
    const inner = subst(override.html_body, vars);
    mailSubject = (override.subject && override.subject.trim()) ? subst(override.subject, vars) : 'Votre candidature est bien reçue — OXV';
    html = wrap(inner);
    text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + `\n\nRéférence ${reference}\ncontact@oxvehicle.fr — L'équipe OXV`;
    templateUsed = 'admin_override:candidature_recue';
  } else {
    mailSubject = 'Votre candidature est bien reçue — OXV';
    html = wrap(`<h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${greet}</h1>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Votre candidature pour rejoindre le cercle OXV est bien reçue.</p>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Chaque demande est étudiée individuellement. Vous recevrez notre réponse par email.</p>
      <p style="margin:34px 0 0 0;color:#555555;font-size:11px;letter-spacing:1.5px;">RÉFÉRENCE&nbsp;${escapeHtml(reference)}</p>`);
    text = [greet, '', 'Votre candidature pour rejoindre le cercle OXV est bien reçue.',
      'Chaque demande est étudiée individuellement. Vous recevrez notre réponse par email.', '',
      `Référence ${reference}`, '', 'Une question ? contact@oxvehicle.fr', '— L’équipe OXV'].join('\n');
    templateUsed = 'application_received_v1';
  }

  let sent = false; let resendId: string | null = null; let sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [app.email], subject: mailSubject, html, text, reply_to: 'contact@oxvehicle.fr', tags: [{ name: 'category', value: 'application_received' }] }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok; resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) { sendError = String(e); }

  await admin.from('email_log').insert({
    user_id: null, email_type: 'application_received', subject: mailSubject,
    template_used: templateUsed, status: sent ? 'sent' : 'bounced',
    metadata: { to: app.email, application_id: app.id, resend_message_id: resendId, error: sendError },
  }).then(({ error }) => { if (error) console.warn('[send-application-ack] email_log:', error.message); });

  if (sent) {
    await admin.from('demandes_inscription').update({ ack_sent_at: new Date().toISOString() }).eq('id', app.id);
  }

  return new Response(JSON.stringify({ ok: true, email_sent: sent, template_used: templateUsed, email_error: sendError }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
