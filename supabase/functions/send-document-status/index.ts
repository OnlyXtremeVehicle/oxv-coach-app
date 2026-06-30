// =============================================================================
// OXV — Edge Function : send-document-status
// =============================================================================
// Notifie le pilote quand un de ses documents est validé ou refusé par l'admin.
// Déclenchée par le trigger `notify_document_status` (pg_net) à l'UPDATE de
// public.documents quand status passe à 'validated' ou 'rejected'.
//
// Body attendu : { document_id: string }
//   -> charge document + user côté serveur (service_role), envoie via Resend,
//      journalise email_log. Dédup anti-retry via email_log (fenêtre 2 min).
//
// AUTH : secret partagé. DORMANTE sans EDGE_FUNCTIONS_INVOKE_SECRET.
// Secrets : EDGE_FUNCTIONS_INVOKE_SECRET, RESEND_API_KEY.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const RED = '#C8102E';
const GREEN = '#1D9E75';

const DOC_LABEL: Record<string, string> = {
  driving_license: 'Permis de conduire',
  id_card: "Pièce d'identité",
  insurance_road: 'Assurance route',
  insurance_track: 'Assurance circuit',
  bpjeps: 'BPJEPS',
  rc_pro: 'RC Pro',
  medical: 'Certificat médical',
  decharge: 'Décharge de responsabilité',
};

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmail(firstName: string, docLabel: string, validated: boolean, reason: string | null) {
  const greet = firstName ? `Bonjour ${escapeHtml(firstName)}.` : 'Bonjour.';
  const accent = validated ? GREEN : RED;
  const eyebrow = validated ? 'OXV · DOCUMENT VALIDÉ' : 'OXV · DOCUMENT À CORRIGER';
  const lead = validated
    ? `Votre document <strong style="color:#fff;">${escapeHtml(docLabel)}</strong> a été validé.`
    : `Votre document <strong style="color:#fff;">${escapeHtml(docLabel)}</strong> n'a pas pu être validé.`;
  const reasonBlock = (!validated && reason)
    ? `<p style="margin:0 0 16px 0;color:#cccccc;font-size:15px;line-height:1.6;">Motif&nbsp;: ${escapeHtml(reason)}</p><p style="margin:0 0 16px 0;color:#cccccc;font-size:15px;line-height:1.6;">Merci de redéposer un document conforme depuis votre espace pilote.</p>`
    : '';
  const okBlock = validated
    ? `<p style="margin:0 0 16px 0;color:#cccccc;font-size:15px;line-height:1.6;">Aucune action de votre part n'est nécessaire pour ce document.</p>`
    : '';
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:44px 40px;">
      <p style="margin:0 0 10px 0;color:${accent};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">${eyebrow}</p>
      <div style="width:36px;height:2px;background:${accent};margin:0 0 26px 0;line-height:2px;font-size:0;">&nbsp;</div>
      <h1 style="margin:0 0 24px 0;color:#ffffff;font-size:28px;font-weight:200;line-height:1.3;">${greet}</h1>
      <p style="margin:0 0 16px 0;color:#cccccc;font-size:16px;line-height:1.6;">${lead}</p>
      ${reasonBlock}${okBlock}
      <p style="margin:30px 0 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:#777777;font-size:12px;line-height:1.6;">Une question&nbsp;? Écrivez à <a href="mailto:contact@oxvehicle.fr" style="color:#999999;">contact@oxvehicle.fr</a>.</p>
      <p style="margin:8px 0 0 0;color:#555555;font-size:11px;letter-spacing:1px;">— L'équipe OXV</p>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    greet, '',
    validated ? `Votre document ${docLabel} a été validé.` : `Votre document ${docLabel} n'a pas pu être validé.`,
    (!validated && reason) ? `Motif : ${reason}` : '',
    (!validated && reason) ? 'Merci de redéposer un document conforme depuis votre espace pilote.' : '',
    '', 'Une question ? contact@oxvehicle.fr', '— L’équipe OXV',
  ].filter((l) => l !== '').join('\n');
  return { subject: validated ? `Document validé — ${docLabel}` : `Document à corriger — ${docLabel}`, html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let documentId: string | undefined;
  try { documentId = (await req.json())?.document_id; } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  if (!documentId) return new Response(JSON.stringify({ error: 'missing_document_id' }), { status: 400 });

  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: doc, error: loadErr } = await admin
    .from('documents')
    .select('id, user_id, document_type, status, rejection_reason, users:user_id(first_name,email)')
    .eq('id', documentId)
    .maybeSingle();
  if (loadErr || !doc) return new Response(JSON.stringify({ error: 'document_not_found' }), { status: 404 });

  if (doc.status !== 'validated' && doc.status !== 'rejected') {
    return new Response(JSON.stringify({ ok: true, skipped: 'status_not_notifiable' }), { status: 200 });
  }

  // Dédup anti-retry : même document + même statut RÉELLEMENT envoyé dans les 2 dernières
  // minutes. On filtre status='sent' pour qu'un échec (bounced) n'empêche pas un nouvel essai.
  const since = new Date(Date.now() - 120000).toISOString();
  const { data: dupe } = await admin
    .from('email_log').select('id').eq('email_type', 'document_status').eq('status', 'sent')
    .eq('metadata->>document_id', doc.id).eq('metadata->>doc_status', doc.status)
    .gte('sent_at', since).limit(1);
  if (dupe && dupe.length > 0) return new Response(JSON.stringify({ ok: true, skipped: 'recently_sent' }), { status: 200 });

  const user = (doc as Record<string, any>).users ?? {};
  if (!user.email) return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });

  const validated = doc.status === 'validated';
  const docLabel = DOC_LABEL[doc.document_type as string] || String(doc.document_type || 'Document');
  const mail = buildEmail(user.first_name ?? '', docLabel, validated, doc.rejection_reason ?? null);

  let sent = false, resendId: string | null = null, sendError: string | null = null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [user.email], subject: mail.subject, html: mail.html, text: mail.text,
        reply_to: 'contact@oxvehicle.fr', tags: [{ name: 'category', value: validated ? 'document_validated' : 'document_rejected' }],
      }),
    });
    const json = await res.json().catch(() => ({}));
    sent = res.ok; resendId = json?.id ?? null;
    if (!res.ok) sendError = `resend_${res.status}: ${JSON.stringify(json).slice(0, 200)}`;
  } catch (e) { sendError = String(e); }

  await admin.from('email_log').insert({
    user_id: doc.user_id, email_type: 'document_status', subject: mail.subject,
    template_used: validated ? 'document_validated_v1' : 'document_rejected_v1', status: sent ? 'sent' : 'bounced',
    metadata: { to: user.email, document_id: doc.id, doc_status: doc.status, resend_message_id: resendId, error: sendError },
  }).then(({ error }) => { if (error) console.warn('[send-document-status] email_log:', error.message); });

  return new Response(JSON.stringify({ ok: true, email_sent: sent, email_error: sendError }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
