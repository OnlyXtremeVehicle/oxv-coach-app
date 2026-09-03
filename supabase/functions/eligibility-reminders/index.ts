// =============================================================================
// OXV — Edge Function : eligibility-reminders (PR-HUB-02)
// =============================================================================
// Appelée chaque matin par pg_cron. Pour chaque réservation active dont la session
// est dans EXACTEMENT 14, 7 ou 2 jours et dont le statut d'éligibilité n'est pas GO :
// email Resend listant les points manquants + lien espace documents.
// Idempotente : une seule relance par (réservation, jalon) via email_log.
// AUTH : x-oxv-invoke-secret. Dormante sans secrets.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const LABELS: Record<string, string> = {
  permis: 'Permis de conduire', cni: 'Pièce d\'identité', assurance_circuit: 'Attestation d\'assurance circuit',
  controle_technique: 'Contrôle technique', pneus_freins: 'État pneus & freins', niveau_sonore: 'Niveau sonore',
  casque: 'Casque', decharge: 'Décharge signée', briefing: 'Briefing sécurité',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return json({ error: 'function_disabled' }, 503);
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

  const marks = [14, 7, 2];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const targets: Record<string, number> = {};
  for (const m of marks) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() + m);
    targets[d.toISOString().slice(0, 10)] = m;
  }

  const { data: regs, error } = await admin.from('registrations')
    .select('id, status, sessions:session_id(date), users:user_id(email, first_name)')
    .in('status', ['pending', 'confirmed']);
  if (error) return json({ error: 'query_failed' }, 500);

  let checked = 0, sent = 0, skipped = 0;
  for (const r of regs ?? []) {
    const rec = r as Record<string, any>;
    const date = rec.sessions?.date as string | undefined;
    if (!date || !(date in targets)) continue;
    checked++;
    const mark = targets[date];

    const { data: agg } = await admin.from('registration_eligibility')
      .select('eligibility_status, ok_count, total_count').eq('registration_id', rec.id).maybeSingle();
    if (!agg || agg.eligibility_status === 'GO') { skipped++; continue; }

    // Idempotence par (registration, jalon)
    const { data: already } = await admin.from('email_log').select('id')
      .eq('email_type', 'eligibility_reminder')
      .eq('metadata->>registration_id', rec.id)
      .eq('metadata->>day_mark', String(mark)).limit(1);
    if (already && already.length) { skipped++; continue; }

    const { data: items } = await admin.from('eligibility_items')
      .select('item_key, status').eq('registration_id', rec.id).in('status', ['pending', 'refused']);
    const missing = (items ?? []).map((i: Record<string, any>) => '• ' + (LABELS[i.item_key] ?? i.item_key) + (i.status === 'refused' ? ' (refusé — à refaire)' : '')).join('\n');
    const email = rec.users?.email;
    if (!email || !RESEND_KEY) { skipped++; continue; }

    const dLbl = new Date(date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `OXV — J-${mark} : votre check-up avant la session du ${dLbl}`;
    const text = `Bonjour ${rec.users?.first_name ?? ''},\n\nVotre session OXV a lieu dans ${mark} jours (${dLbl}) et votre check-up d'éligibilité n'est pas encore complet (${agg.ok_count}/${agg.total_count} points validés).\n\nÀ compléter :\n${missing || '—'}\n\nComplétez vos documents dans votre espace : https://www.oxvehicle.fr/compte-documents\n\nSans dossier complet le jour J, l'accès à la piste ne peut pas être garanti.\n\n— OXV`;

    let ok = false;
    try {
      const res = await fetch(RESEND_API_URL, { method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [email], subject, text }) });
      ok = res.ok;
    } catch (_) { /* best effort */ }
    await admin.from('email_log').insert({ user_id: null, email_type: 'eligibility_reminder', subject, template_used: 'eligibility_reminder_v1', status: ok ? 'sent' : 'bounced', metadata: { registration_id: rec.id, day_mark: String(mark), missing_count: (items ?? []).length } });
    if (ok) sent++;
  }

  return json({ ok: true, checked, sent, skipped });
});
