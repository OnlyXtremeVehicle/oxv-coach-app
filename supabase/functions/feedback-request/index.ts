// =============================================================================
// OXV — Edge Function : feedback-request (PR-HUB-07)
// =============================================================================
// Cron quotidien : pour chaque réservation EFFECTUÉE dont la session était HIER,
// email J+1 invitant à laisser un retour (note, NPS, verbatim, autorisation de
// publication) dans l'espace pilote. Idempotent (email_log). AUTH : secret interne.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return json({ error: 'function_disabled' }, 503);
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);

  const { data: regs, error } = await admin.from('registrations')
    .select('id, user_id, sessions:session_id(date), users:user_id(email, first_name)')
    .eq('status', 'attended');
  if (error) return json({ error: 'query_failed' }, 500);

  let sent = 0, skipped = 0;
  for (const r of regs ?? []) {
    const rec = r as Record<string, any>;
    if (rec.sessions?.date !== yesterday) continue;

    const { data: already } = await admin.from('email_log').select('id')
      .eq('email_type', 'feedback_request').eq('metadata->>registration_id', rec.id).limit(1);
    if (already && already.length) { skipped++; continue; }
    const { data: existing } = await admin.from('session_feedback').select('id').eq('registration_id', rec.id).limit(1);
    if (existing && existing.length) { skipped++; continue; }

    const email = rec.users?.email;
    if (!email || !RESEND_KEY) { skipped++; continue; }
    const subject = 'OXV — Comment s\'est passée votre journée ?';
    const text = `Bonjour ${rec.users?.first_name ?? ''},\n\nMerci d'avoir roulé avec OXV hier. Deux minutes pour nous dire comment ça s'est passé ?\n\nVotre retour (note, remarque libre) se laisse depuis votre espace pilote :\nhttps://www.oxvehicle.fr/compte-sessions\n\nSi vous l'autorisez, votre témoignage pourra apparaître sur notre page Preuves — avec votre prénom, jamais sans votre accord.\n\n— OXV`;
    let ok = false;
    try {
      const res = await fetch(RESEND_API_URL, { method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [email], subject, text }) });
      ok = res.ok;
    } catch (_) {}
    await admin.from('email_log').insert({ user_id: rec.user_id, email_type: 'feedback_request', subject, template_used: 'feedback_request_v1', status: ok ? 'sent' : 'bounced', metadata: { registration_id: rec.id } });
    if (ok) sent++;
  }
  return json({ ok: true, sent, skipped });
});
