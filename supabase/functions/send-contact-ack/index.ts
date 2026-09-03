// =============================================================================
// OXV — Edge Function : send-contact-ack (v6)
// =============================================================================
// Accusé de réception d'un message de contact (trigger notify_contact_message_inserted).
// v5 : délai « 48 h ouvrées » annoncé. v6 : surcharge éditoriale via table
// email_templates (module admin-emails) — clés : 'corporate_recu' (si source
// corporate_form) puis 'contact_recu' (générique), si enabled=true.
// Variables substituées : {{first_name}}, {{reference}}, {{subject}}.
// AUTH : x-oxv-invoke-secret. Idempotent via metadata.ack_sent_at.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

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
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV &middot; MESSAGE REÇU</p>
      <div style="width:36px;height:2px;background:${RED};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
      ${inner}
      <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body></html>`;
}

function defaultInner(firstName: string, subject: string | null, reference: string): string {
  const greet = firstName ? `Bonjour ${escapeHtml(firstName)}.` : 'Bonjour.';
  const subjectLine = subject && subject.trim().length > 0
    ? `<p style="margin:0 0 16px 0;color:#888888;font-size:13px;line-height:1.6;">Objet&nbsp;: ${escapeHtml(subject.trim())}</p>` : '';
  return `<h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${greet}</h1>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Nous avons bien reçu votre message.</p>
      ${subjectLine}
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Notre équipe vous répond sous 48 h ouvrées.</p>
      <p style="margin:34px 0 0 0;color:#555555;font-size:11px;letter-spacing:1.5px;">RÉFÉRENCE&nbsp;${escapeHtml(reference)}</p>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503 });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let contactId: string | undefined;
  try { contactId = (await req.json())?.contact_id; } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  if (!contactId) return new Response(JSON.stringify({ error: 'missing_contact_id' }), { status: 400 });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: contact, error: loadErr } = await admin
    .from('contact_messages')
    .select('id, first_name, email, subject, source, metadata')
    .eq('id', contactId)
    .maybeSingle();
  if (loadErr || !contact) return new Response(JSON.stringify({ error: 'contact_not_found' }), { status: 404 });

  const meta = (contact.metadata ?? {}) as Record<string, unknown>;
  if (meta.ack_sent_at) return new Response(JSON.stringify({ ok: true, skipped: 'already_acked' }), { status: 200 });
  if (!contact.email) return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });

  const reference = `OXV-${String(contact.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const vars = { first_name: contact.first_name ?? '', reference, subject: contact.subject ?? '' };

  // Surcharge éditoriale (email_templates) — corporate_recu prioritaire si source corporate
  let override: { template_key: string; subject: string | null; html_body: string | null } | null = null;
  try {
    const keys = contact.source === 'corporate_form' ? ['corporate_recu', 'contact_recu'] : ['contact_recu'];
    const { data: tpl } = await admin.from('email_templates')
      .select('template_key, subject, html_body')
      .in('template_key', keys).eq('enabled', true);
    if (tpl && tpl.length) {
      tpl.sort((a, b) => keys.indexOf(a.template_key) - keys.indexOf(b.template_key));
      override = tpl[0];
    }
  } catch (_) { /* défaut codé si indisponible */ }

  let mailSubject: string, html: string, text: string, templateUsed: string;
  if (override && override.html_body && override.html_body.trim()) {
    const inner = subst(override.html_body, vars);
    mailSubject = (override.subject && override.subject.trim()) ? subst(override.subject, vars) : 'Nous avons bien reçu votre message — OXV';
    html = wrap(inner);
    text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + `\n\nRéférence ${reference}\ncontact@oxvehicle.fr — L'équipe OXV`;
    templateUsed = `admin_override:${override.template_key}`;
  } else {
    mailSubject = 'Nous avons bien reçu votre message — OXV';
    html = wrap(defaultInner(vars.first_name, contact.subject ?? null, reference));
    text = [vars.first_name ? `Bonjour ${vars.first_name}.` : 'Bonjour.', '', 'Nous avons bien reçu votre message.',
      contact.subject ? `Objet : ${contact.subject}` : '', 'Notre équipe vous répond sous 48 h ouvrées.', '',
      `Référence ${reference}`, '', 'Une question ? contact@oxvehicle.fr', '— L’équipe OXV'].filter(l => l !== '').join('\n');
    templateUsed = 'contact_received_v1';
  }

  let sent = false; let resendId: string | null = null; let sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [contact.email], subject: mailSubject, html, text, reply_to: 'contact@oxvehicle.fr', tags: [{ name: 'category', value: 'contact_received' }] }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok; resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) { sendError = String(e); }

  await admin.from('email_log').insert({
    user_id: null, email_type: 'contact_received', subject: mailSubject,
    template_used: templateUsed, status: sent ? 'sent' : 'bounced',
    metadata: { to: contact.email, contact_id: contact.id, resend_message_id: resendId, error: sendError },
  }).then(({ error }) => { if (error) console.warn('[send-contact-ack] email_log:', error.message); });

  if (sent) {
    await admin.from('contact_messages').update({ metadata: { ...meta, ack_sent_at: new Date().toISOString() } }).eq('id', contact.id);
  }

  return new Response(JSON.stringify({ ok: true, email_sent: sent, template_used: templateUsed, email_error: sendError }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
