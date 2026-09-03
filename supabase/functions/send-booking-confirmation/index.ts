// =============================================================================
// OXV — Edge Function : send-booking-confirmation
// =============================================================================
// Envoie la confirmation de réservation au pilote.
// Déclenchée par le trigger `notify_registration_inserted` (pg_net) à
// l'INSERT dans public.registrations.
//
// Body attendu : { registration_id: string }
//   -> charge la registration + user + session côté serveur (service_role),
//      n'utilise JAMAIS un e-mail fourni dans le body (anti-spam),
//      envoie via Resend, journalise dans email_log,
//      marque registrations.confirmation_email_sent_at (idempotent).
//
// AUTH : secret partagé serveur-à-serveur (x-oxv-invoke-secret).
// DÉPLOIEMENT : verify_jwt = false. DORMANTE sans EDGE_FUNCTIONS_INVOKE_SECRET.
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

function fmtDate(dateStr: string | null, startTime: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(`${dateStr}T${(startTime ?? '09:00:00')}`);
    const out = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const cap = out.charAt(0).toUpperCase() + out.slice(1);
    return startTime ? `${cap} · ${startTime.slice(0, 5)}` : cap;
  } catch {
    return dateStr;
  }
}

function prettyOffer(offer: string | null): string {
  if (!offer) return 'Réservation';
  return String(offer).charAt(0).toUpperCase() + String(offer).slice(1).replace(/_/g, ' ');
}

function buildEmail(firstName: string, offer: string | null, when: string, amountEuro: string, reference: string) {
  const greet = firstName ? `Bonjour ${escapeHtml(firstName)}.` : 'Bonjour.';
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:44px 40px;">
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV &middot; RÉSERVATION REÇUE</p>
      <div style="width:36px;height:2px;background:${RED};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
      <h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${greet}</h1>
      <p style="margin:0 0 20px 0;color:#cccccc;font-size:16px;line-height:1.6;">Votre réservation est enregistrée. Voici le récapitulatif&nbsp;:</p>
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:0 0 24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#888888;font-size:13px;">Formule</td><td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${escapeHtml(prettyOffer(offer))}</td></tr>
        <tr><td style="padding:8px 0;color:#888888;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Date</td><td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${escapeHtml(when)}</td></tr>
        <tr><td style="padding:8px 0;color:#888888;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Montant</td><td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${escapeHtml(amountEuro)}</td></tr>
      </table>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:15px;line-height:1.6;">Le règlement se fait <strong style="color:#fff;">par virement</strong>. Votre place est confirmée dès réception du virement&nbsp;; vous recevrez alors un e-mail de confirmation de paiement.</p>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:15px;line-height:1.6;">Les coordonnées bancaires et le détail figurent dans votre espace pilote.</p>
      <p style="margin:34px 0 0 0;color:#555555;font-size:11px;letter-spacing:1.5px;">RÉFÉRENCE&nbsp;${escapeHtml(reference)}</p>
      <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    greet, '',
    'Votre réservation est enregistrée.',
    `Formule : ${prettyOffer(offer)}`,
    `Date : ${when}`,
    `Montant : ${amountEuro}`,
    '',
    'Le règlement se fait par virement. Votre place est confirmée dès réception ; vous recevrez alors un e-mail de confirmation de paiement.',
    '',
    `Référence ${reference}`, '',
    'Une question ? contact@oxvehicle.fr',
    '— L’équipe OXV',
  ].filter((l) => l !== '').join('\n');
  return { subject: 'Votre réservation OXV est enregistrée', html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let registrationId: string | undefined;
  try { registrationId = (await req.json())?.registration_id; } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  if (!registrationId) return new Response(JSON.stringify({ error: 'missing_registration_id' }), { status: 400 });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: reg, error: loadErr } = await admin
    .from('registrations')
    .select('id, user_id, session_id, offer_type, price_total, confirmation_email_sent_at, users:user_id(first_name,email), sessions:session_id(date,start_time)')
    .eq('id', registrationId)
    .maybeSingle();
  if (loadErr || !reg) return new Response(JSON.stringify({ error: 'registration_not_found' }), { status: 404 });

  if (reg.confirmation_email_sent_at) return new Response(JSON.stringify({ ok: true, skipped: 'already_sent' }), { status: 200 });

  const user = (reg as Record<string, any>).users ?? {};
  const session = (reg as Record<string, any>).sessions ?? {};
  if (!user.email) return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });

  const reference = `OXV-${String(reg.id).slice(0, 8).toUpperCase()}`;
  const amountEuro = reg.price_total != null ? `${Math.round(Number(reg.price_total) / 100)} €` : 'à confirmer';
  const when = fmtDate(session.date ?? null, session.start_time ?? null);
  const mail = buildEmail(user.first_name ?? '', reg.offer_type ?? null, when, amountEuro, reference);

  let sent = false, resendId: string | null = null, sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [user.email], subject: mail.subject, html: mail.html, text: mail.text,
        reply_to: 'contact@oxvehicle.fr', tags: [{ name: 'category', value: 'booking_confirmation' }],
      }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok; resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) { sendError = String(e); }

  await admin.from('email_log').insert({
    user_id: reg.user_id, email_type: 'booking_confirmation', subject: mail.subject,
    template_used: 'booking_confirmation_v1', status: sent ? 'sent' : 'bounced',
    metadata: { to: user.email, registration_id: reg.id, resend_message_id: resendId, error: sendError },
  }).then(({ error }) => { if (error) console.warn('[send-booking-confirmation] email_log:', error.message); });

  if (sent) {
    await admin.from('registrations').update({ confirmation_email_sent_at: new Date().toISOString() }).eq('id', reg.id);
  }

  return new Response(JSON.stringify({ ok: true, email_sent: sent, email_error: sendError }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
