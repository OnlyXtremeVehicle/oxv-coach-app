// =============================================================================
// OXV — Edge Function : send-contact-ack
// =============================================================================
// Envoie un accusé de réception OXV à l'auteur d'un message de contact.
// Déclenchée par le trigger `notify_contact_message_inserted` (pg_net) à
// l'INSERT dans public.contact_messages.
//
// Body attendu : { contact_id: string }
//   -> charge la ligne contact_messages côté serveur (service_role),
//      n'utilise JAMAIS un e-mail fourni dans le body (anti-spam),
//      envoie l'accusé via Resend, journalise dans email_log,
//      marque metadata.ack_sent_at (idempotent).
//
// AUTH : secret partagé serveur-à-serveur.
//   En-tête  : x-oxv-invoke-secret: <EDGE_FUNCTIONS_INVOKE_SECRET>
//   DORMANTE : sans le secret -> 503. (Le trigger passe le secret du Vault.)
//
// DÉPLOIEMENT : verify_jwt = false (auth maison par secret).
// Secrets : EDGE_FUNCTIONS_INVOKE_SECRET (absent = dormante), RESEND_API_KEY.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const RED = '#C8102E';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmail(firstName: string, subject: string | null, reference: string) {
  const greet = firstName ? `Bonjour ${escapeHtml(firstName)}.` : 'Bonjour.';
  const subjectLine = subject && subject.trim().length > 0
    ? `<p style="margin:0 0 16px 0;color:#888888;font-size:13px;line-height:1.6;">Objet&nbsp;: ${escapeHtml(subject.trim())}</p>`
    : '';
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:44px 40px;">
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV &middot; MESSAGE REÇU</p>
      <div style="width:36px;height:2px;background:${RED};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
      <h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${greet}</h1>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Nous avons bien reçu votre message.</p>
      ${subjectLine}
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Notre équipe vous répondra dans les meilleurs délais.</p>
      <p style="margin:34px 0 0 0;color:#555555;font-size:11px;letter-spacing:1.5px;">RÉFÉRENCE&nbsp;${escapeHtml(reference)}</p>
      <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    greet,
    '',
    'Nous avons bien reçu votre message.',
    subject && subject.trim() ? `Objet : ${subject.trim()}` : '',
    'Notre équipe vous répondra dans les meilleurs délais.',
    '',
    `Référence ${reference}`,
    '',
    'Une question ? contact@oxvehicle.fr',
    '— L’équipe OXV',
  ].filter((l) => l !== '').join('\n');
  return { subject: 'Nous avons bien reçu votre message — OXV', html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) {
    return new Response(
      JSON.stringify({ error: 'function_disabled', detail: 'EDGE_FUNCTIONS_INVOKE_SECRET absent — dormante.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const provided = req.headers.get('x-oxv-invoke-secret') ?? '';
  if (provided !== SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let contactId: string | undefined;
  try {
    contactId = (await req.json())?.contact_id;
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 });
  }
  if (!contactId) {
    return new Response(JSON.stringify({ error: 'missing_contact_id' }), { status: 400 });
  }

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Charge la ligne côté serveur (l'e-mail vient de la DB, jamais du body)
  const { data: contact, error: loadErr } = await admin
    .from('contact_messages')
    .select('id, first_name, email, subject, metadata')
    .eq('id', contactId)
    .maybeSingle();
  if (loadErr || !contact) {
    return new Response(JSON.stringify({ error: 'contact_not_found' }), { status: 404 });
  }

  // Idempotence : ne renvoie pas un accusé déjà émis
  const meta = (contact.metadata ?? {}) as Record<string, unknown>;
  if (meta.ack_sent_at) {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_acked' }), { status: 200 });
  }
  if (!contact.email) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });
  }

  const reference = `OXV-${String(contact.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const mail = buildEmail(contact.first_name ?? '', contact.subject ?? null, reference);

  let sent = false;
  let resendId: string | null = null;
  let sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [contact.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: 'contact@oxvehicle.fr',
        tags: [{ name: 'category', value: 'contact_received' }],
      }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok;
    resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) {
    sendError = String(e);
  }

  // Journalisation email_log (best-effort)
  await admin
    .from('email_log')
    .insert({
      user_id: null,
      email_type: 'contact_received',
      subject: mail.subject,
      template_used: 'contact_received_v1',
      status: sent ? 'sent' : 'bounced',
      metadata: { to: contact.email, contact_id: contact.id, resend_message_id: resendId, error: sendError },
    })
    .then(({ error }) => {
      if (error) console.warn('[send-contact-ack] email_log:', error.message);
    });

  // Marque la ligne comme acquittée (idempotence)
  if (sent) {
    await admin
      .from('contact_messages')
      .update({ metadata: { ...meta, ack_sent_at: new Date().toISOString() } })
      .eq('id', contact.id);
  }

  return new Response(JSON.stringify({ ok: true, email_sent: sent, email_error: sendError }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
