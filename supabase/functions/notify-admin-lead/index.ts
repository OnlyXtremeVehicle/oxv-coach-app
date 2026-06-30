// =============================================================================
// OXV — Edge Function : notify-admin-lead
// =============================================================================
// Alerte l'équipe OXV : nouvelle réservation OU nouveau lead corporate.
// Déclenchée par triggers pg_net :
//   - notify_registration_inserted   -> { kind: 'booking',   id: <registration_id> }
//   - notify_corporate_lead          -> { kind: 'corporate', id: <contact_message_id> }
//
// Charge la donnée côté serveur (service_role). Envoie à ADMIN_NOTIFY_EMAIL
// (défaut contact@oxvehicle.fr). Journalise email_log. Idempotent via email_log.
//
// AUTH : secret partagé. DORMANTE sans EDGE_FUNCTIONS_INVOKE_SECRET.
// Secrets : EDGE_FUNCTIONS_INVOKE_SECRET, RESEND_API_KEY, ADMIN_NOTIFY_EMAIL (optionnel).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const RED = '#C8102E';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function wrap(title: string, rows: Array<[string, string]>, bodyText: string) {
  const trs = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 0;color:#888888;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">${escapeHtml(k)}</td><td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${escapeHtml(v)}</td></tr>`,
  ).join('');
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:40px 36px;">
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV &middot; ADMIN</p>
      <h1 style="margin:0 0 20px 0;color:#ffffff;font-size:22px;font-weight:300;">${escapeHtml(title)}</h1>
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;">${trs}</table>
      <p style="margin:24px 0 0 0;color:#777777;font-size:12px;">À traiter dans l'admin OXV.</p>
    </td></tr>
  </table>
</body></html>`;
  return { html, text: bodyText };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let body: { kind?: string; id?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  const kind = body?.kind, id = body?.id;
  if (!kind || !id || (kind !== 'booking' && kind !== 'corporate')) return new Response(JSON.stringify({ error: 'bad_params' }), { status: 400 });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });
  const TO = Deno.env.get('ADMIN_NOTIFY_EMAIL') || 'contact@oxvehicle.fr';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Idempotence : ne pas renvoyer 2x la même alerte (retries pg_net)
  const { data: already } = await admin
    .from('email_log').select('id').eq('email_type', 'admin_lead')
    .eq('metadata->>ref_id', id).eq('metadata->>kind', kind).limit(1);
  if (already && already.length > 0) return new Response(JSON.stringify({ ok: true, skipped: 'already_notified' }), { status: 200 });

  let title = '', rows: Array<[string, string]> = [], subject = '';
  if (kind === 'booking') {
    const { data: reg } = await admin
      .from('registrations')
      .select('id, offer_type, price_total, users:user_id(first_name,last_name,email), sessions:session_id(date,start_time)')
      .eq('id', id).maybeSingle();
    if (!reg) return new Response(JSON.stringify({ error: 'registration_not_found' }), { status: 404 });
    const u = (reg as Record<string, any>).users ?? {}, s = (reg as Record<string, any>).sessions ?? {};
    const amount = reg.price_total != null ? `${Math.round(Number(reg.price_total) / 100)} €` : '—';
    title = 'Nouvelle réservation';
    subject = `OXV — Nouvelle réservation (${u.last_name ?? ''} ${u.first_name ?? ''})`.trim();
    rows = [
      ['Pilote', `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'],
      ['Email', u.email ?? '—'],
      ['Formule', String(reg.offer_type ?? '—')],
      ['Date', s.date ? `${s.date}${s.start_time ? ' ' + String(s.start_time).slice(0, 5) : ''}` : '—'],
      ['Montant', amount],
    ];
  } else {
    const { data: msg } = await admin
      .from('contact_messages')
      .select('id, first_name, last_name, email, subject, message, metadata')
      .eq('id', id).maybeSingle();
    if (!msg) return new Response(JSON.stringify({ error: 'contact_not_found' }), { status: 404 });
    const m = ((msg as Record<string, any>).metadata ?? {}) as Record<string, any>;
    title = 'Nouveau lead corporate';
    subject = `OXV — Lead corporate : ${m.company ?? msg.subject ?? ''}`.trim();
    rows = [
      ['Société', String(m.company ?? '—')],
      ['Contact', `${msg.first_name ?? ''} ${msg.last_name ?? ''}`.trim() || '—'],
      ['Email', msg.email ?? '—'],
      ['Format', String(m.event_type ?? '—')],
      ['Invités', String(m.guest_count ?? '—')],
      ['Période', String(m.preferred_period ?? '—')],
    ];
  }

  const bodyText = `${title}\n` + rows.map(([k, v]) => `${k} : ${v}`).join('\n') + `\n\nÀ traiter dans l'admin OXV.`;
  const mail = wrap(title, rows, bodyText);

  let sent = false, resendId: string | null = null, sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html: mail.html, text: mail.text, tags: [{ name: 'category', value: `admin_${kind}` }] }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok; resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) { sendError = String(e); }

  await admin.from('email_log').insert({
    user_id: null, email_type: 'admin_lead', subject,
    template_used: `admin_${kind}_v1`, status: sent ? 'sent' : 'bounced',
    metadata: { to: TO, kind, ref_id: id, resend_message_id: resendId, error: sendError },
  }).then(({ error }) => { if (error) console.warn('[notify-admin-lead] email_log:', error.message); });

  return new Response(JSON.stringify({ ok: true, email_sent: sent, email_error: sendError }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
