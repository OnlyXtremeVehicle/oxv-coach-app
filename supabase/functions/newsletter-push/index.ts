// =============================================================================
// OXV — Edge Function : newsletter-push (PR-SITE-12)
// =============================================================================
// Diffuse un article publié en campagne email via Brevo (ex-Sendinblue).
// DORMANTE tant que BREVO_API_KEY + BREVO_LIST_ID ne sont pas configurés :
// répond {ok:false, code:'brevo_not_configured'} et n'envoie rien (aucun faux succès).
// AUTH : JWT admin (bouton admin du site) OU header x-oxv-invoke-secret.
// Idempotence : email_log (email_type='newsletter', metadata.article_id) — body.force=true pour re-diffuser.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const BREVO_API = 'https://api.brevo.com/v3';
const SITE = 'https://www.oxvehicle.fr';
const SENDER = { name: 'OXV — Only Xtreme Vehicle', email: 'contact@oxvehicle.fr' };

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-oxv-invoke-secret' } });

const esc = (t: string) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildHtml(a: Record<string, any>, url: string): string {
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#050505;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <p style="margin:0 0 24px;font-size:20px;font-weight:bold;letter-spacing:2px;color:#D80F1F;">OXV</p>
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8a8a;">${esc(a.category || 'Actualité')}${a.date_label ? ' · ' + esc(a.date_label) : ''}</p>
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#F5F2EA;">${esc(a.title)}</h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#c9c6bd;">${esc(a.lead)}</p>
    <a href="${url}" style="display:inline-block;padding:13px 28px;background:#D80F1F;color:#F5F2EA;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Lire l'article</a>
    <p style="margin:40px 0 0;font-size:11px;line-height:1.6;color:#6a6a6a;">OXV — Track days premium, Circuit de Haute Saintonge.<br/>Vous recevez cet email car vous êtes inscrit à la newsletter OXV. <a href="{{ unsubscribe }}" style="color:#8a8a8a;">Se désinscrire</a></p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });

  // ─── Auth : secret interne OU admin (même pattern que generate-invoice) ───
  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  const gotSecret = SECRET && (req.headers.get('x-oxv-invoke-secret') ?? '') === SECRET;
  if (!gotSecret) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const { data: row } = await admin.from('users').select('is_admin, role').eq('id', u.user.id).maybeSingle();
    if (!row || (row.is_admin !== true && row.role !== 'admin')) return json({ error: 'forbidden' }, 403);
  }

  let body: { article_id?: string; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body.article_id) return json({ error: 'article_id_required' }, 400);

  // ─── Article source (lu en base, on ne fait pas confiance au payload client) ───
  const { data: article } = await admin.from('articles').select('id, title, lead, category, date_label, published').eq('id', body.article_id).maybeSingle();
  if (!article) return json({ ok: false, code: 'article_not_found' }, 404);
  if (!article.published) return json({ ok: false, code: 'article_not_published' }, 400);

  // ─── Idempotence : une diffusion par article, sauf force ───
  const { data: prev } = await admin.from('email_log')
    .select('id, sent_at').eq('email_type', 'newsletter')
    .eq('metadata->>article_id', String(article.id))
    .order('sent_at', { ascending: false }).limit(1);
  if (prev && prev.length && !body.force) {
    return json({ ok: false, code: 'already_sent', sent_at: prev[0].sent_at });
  }

  // ─── Dormance honnête tant que Brevo n'est pas configuré ───
  const BREVO_KEY = Deno.env.get('BREVO_API_KEY');
  const LIST_ID = Number(Deno.env.get('BREVO_LIST_ID') || '0');
  if (!BREVO_KEY || !LIST_ID) return json({ ok: false, code: 'brevo_not_configured' });

  // ─── Création + envoi de la campagne Brevo ───
  const url = `${SITE}/actualites/${encodeURIComponent(article.id)}`;
  const headers = { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };
  const createRes = await fetch(`${BREVO_API}/emailCampaigns`, {
    method: 'POST', headers,
    body: JSON.stringify({
      name: `OXV — ${article.title}`.slice(0, 128),
      subject: String(article.title).slice(0, 200),
      sender: SENDER,
      htmlContent: buildHtml(article, url),
      recipients: { listIds: [LIST_ID] },
    }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => '');
    return json({ ok: false, code: 'brevo_create_failed', detail: detail.slice(0, 300) }, 502);
  }
  const { id: campaignId } = await createRes.json();
  const sendRes = await fetch(`${BREVO_API}/emailCampaigns/${campaignId}/sendNow`, { method: 'POST', headers });
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '');
    // Campagne créée mais pas envoyée : elle reste en brouillon côté Brevo, on le dit clairement
    return json({ ok: false, code: 'brevo_send_failed', campaign_id: campaignId, detail: detail.slice(0, 300) }, 502);
  }

  // ─── Journalisation (idempotence) ───
  await admin.from('email_log').insert({
    user_id: null, email_type: 'newsletter', subject: article.title,
    template_used: 'newsletter_v1', status: 'sent',
    metadata: { article_id: article.id, brevo_campaign_id: campaignId },
  });

  return json({ ok: true, campaign_id: campaignId });
});
