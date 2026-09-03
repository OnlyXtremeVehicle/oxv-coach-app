// =============================================================================
// OXV — Edge Function : send-payment-confirmed
// =============================================================================
// Confirme au pilote la réception de son virement (paiement validé par l'admin).
// Déclenchée par le trigger `notify_payment_confirmed` (pg_net) à l'UPDATE de
// public.payments quand paid_at passe de NULL à NON NULL.
//
// Body attendu : { payment_id: string }
//   -> charge payment + user + registration + session côté serveur (service_role),
//      envoie via Resend, journalise email_log,
//      marque payments.metadata.confirm_email_sent_at (idempotent).
//
// AUTH : secret partagé. DORMANTE sans EDGE_FUNCTIONS_INVOKE_SECRET.
// Secrets : EDGE_FUNCTIONS_INVOKE_SECRET, RESEND_API_KEY.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const RED = '#C8102E';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmail(firstName: string, amountEuro: string, reference: string) {
  const greet = firstName ? `Bonjour ${escapeHtml(firstName)}.` : 'Bonjour.';
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:44px 40px;">
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV &middot; PAIEMENT CONFIRMÉ</p>
      <div style="width:36px;height:2px;background:${RED};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
      <h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${greet}</h1>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Nous confirmons la réception de votre virement${amountEuro ? ` de <strong style="color:#fff;">${escapeHtml(amountEuro)}</strong>` : ''}. Votre place est <strong style="color:#fff;">confirmée</strong>.</p>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">Vous retrouverez tous les détails de votre journée dans votre espace pilote.</p>
      <p style="margin:34px 0 0 0;color:#555555;font-size:11px;letter-spacing:1.5px;">RÉFÉRENCE&nbsp;${escapeHtml(reference)}</p>
      <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    greet, '',
    `Nous confirmons la réception de votre virement${amountEuro ? ` de ${amountEuro}` : ''}. Votre place est confirmée.`,
    'Vous retrouverez tous les détails dans votre espace pilote.',
    '',
    `Référence ${reference}`, '',
    'Une question ? contact@oxvehicle.fr',
    '— L’équipe OXV',
  ].filter((l) => l !== '').join('\n');
  return { subject: 'Paiement confirmé — votre place OXV est validée', html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let paymentId: string | undefined;
  try { paymentId = (await req.json())?.payment_id; } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  if (!paymentId) return new Response(JSON.stringify({ error: 'missing_payment_id' }), { status: 400 });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: pay, error: loadErr } = await admin
    .from('payments')
    .select('id, user_id, registration_id, amount, reference, metadata, users:user_id(first_name,email)')
    .eq('id', paymentId)
    .maybeSingle();
  if (loadErr || !pay) return new Response(JSON.stringify({ error: 'payment_not_found' }), { status: 404 });

  const meta = ((pay as Record<string, any>).metadata ?? {}) as Record<string, unknown>;
  if (meta.confirm_email_sent_at) return new Response(JSON.stringify({ ok: true, skipped: 'already_sent' }), { status: 200 });

  const user = (pay as Record<string, any>).users ?? {};
  if (!user.email) return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });

  const refBase = pay.reference || (pay.registration_id ? String(pay.registration_id).slice(0, 8) : String(pay.id).slice(0, 8));
  const reference = pay.reference ? String(pay.reference) : `OXV-${String(refBase).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const amountEuro = pay.amount != null ? `${Math.round(Number(pay.amount) / 100)} €` : '';
  const mail = buildEmail(user.first_name ?? '', amountEuro, reference);

  let sent = false, resendId: string | null = null, sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [user.email], subject: mail.subject, html: mail.html, text: mail.text,
        reply_to: 'contact@oxvehicle.fr', tags: [{ name: 'category', value: 'payment_confirmed' }],
      }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok; resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) { sendError = String(e); }

  await admin.from('email_log').insert({
    user_id: pay.user_id, email_type: 'payment_confirmed', subject: mail.subject,
    template_used: 'payment_confirmed_v1', status: sent ? 'sent' : 'bounced',
    metadata: { to: user.email, payment_id: pay.id, resend_message_id: resendId, error: sendError },
  }).then(({ error }) => { if (error) console.warn('[send-payment-confirmed] email_log:', error.message); });

  if (sent) {
    await admin.from('payments').update({ metadata: { ...meta, confirm_email_sent_at: new Date().toISOString() } }).eq('id', pay.id);
  }

  return new Response(JSON.stringify({ ok: true, email_sent: sent, email_error: sendError }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
