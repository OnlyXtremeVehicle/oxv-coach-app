// =============================================================================
// OXV — Edge Function : notify-admin-lead
// =============================================================================
// Alerte l'équipe OXV : nouvelle réservation OU nouveau lead (corporate, liste
// d'attente, partenaire, presse). Déclenchée par triggers pg_net :
//   - notify_registration_inserted -> { kind: 'booking',    id: <registration_id> }
//   - notify_corporate_lead        -> { kind: <corporate|waitlist|partner|press>, id: <contact_message_id> }
//   - notify_demande_examen_vehicule -> { kind: 'vehicule', id: <demandes_examen_vehicule_id> }
//
// La nature 'vehicule' envoie DEUX courriels : l'alerte à l'administration et
// un accusé au demandeur (délai de 72 h ouvrées, CGV art. 5.3). Chacun a sa
// propre clé d'idempotence dans email_log.
//
// Charge la donnée côté serveur (service_role). Envoie à ADMIN_NOTIFY_EMAIL
// (défaut contact@oxvehicle.fr). Journalise email_log. Idempotent via email_log.
//
// AUTH : secret partagé. DORMANTE sans EDGE_FUNCTIONS_INVOKE_SECRET.
// Secrets : EDGE_FUNCTIONS_INVOKE_SECRET, RESEND_API_KEY, ADMIN_NOTIFY_EMAIL (optionnel).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';
const RED = '#C8102E';
const VALID_KINDS = ['booking', 'corporate', 'waitlist', 'partner', 'press', 'vehicule'];

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

/**
 * Gabarit tourné vers le PILOTE. Distinct du gabarit admin : pas de bandeau
 * « ADMIN », pas de « à traiter », et un texte d'accompagnement.
 *
 * VERROU LEXICAL — le mot « refus » et ses variantes n'apparaissent nulle part.
 * L'article L121-11 du code de la consommation interdit de refuser une
 * prestation sans motif légitime ; un périmètre publié et appliqué
 * uniformément n'est pas un refus. Toute la valeur juridique du dispositif se
 * perd à la première chaîne qui l'écrit. Voir eligibiliteLogic.ts.
 */
function wrapPilote(title: string, intro: string, rows: Array<[string, string]>, pied: string) {
  const trs = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 0;color:#888888;font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">${escapeHtml(k)}</td><td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${escapeHtml(v)}</td></tr>`,
  ).join('');
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:40px 20px;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:40px 36px;">
      <p style="margin:0 0 10px 0;color:${RED};font-size:11px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">OXV</p>
      <h1 style="margin:0 0 18px 0;color:#ffffff;font-size:22px;font-weight:300;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px 0;color:#cccccc;font-size:14px;line-height:1.65;">${escapeHtml(intro)}</p>
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;">${trs}</table>
      <p style="margin:26px 0 0 0;color:#777777;font-size:12px;line-height:1.6;">${escapeHtml(pied)}</p>
    </td></tr>
  </table>
</body></html>`;
  const text = `${title}\n\n${intro}\n\n` + rows.map(([k, v]) => `${k} : ${v}`).join('\n') + `\n\n${pied}`;
  return { html, text };
}

/** Un entier en typographie française : 1400 -> « 1 400 » (espace fine insécable). */
function entierFr(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });

  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (!SECRET) return new Response(JSON.stringify({ error: 'function_disabled' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  if ((req.headers.get('x-oxv-invoke-secret') ?? '') !== SECRET) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  let body: { kind?: string; id?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 }); }
  const kind = body?.kind, id = body?.id;
  if (!kind || !id || !VALID_KINDS.includes(kind)) return new Response(JSON.stringify({ error: 'bad_params' }), { status: 400 });

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
  const dejaAlerte = !!(already && already.length > 0);
  // 'vehicule' porte DEUX courriels aux clés d'idempotence distinctes : sortir
  // ici priverait l'accusé de tout rejeu. On ne sort tôt que pour les natures
  // à courriel unique, dont l'alerte admin épuise le travail.
  if (dejaAlerte && kind !== 'vehicule') {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_notified' }), { status: 200 });
  }

  let title = '', rows: Array<[string, string]> = [], subject = '';
  // Accusé au demandeur : renseigné par la seule branche « véhicule ».
  let ackEmail: string | null = null;
  let ackUserId: string | null = null;
  let ackRows: Array<[string, string]> = [];
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
  } else if (kind === 'vehicule') {
    const { data: dem } = await admin
      .from('demandes_examen_vehicule')
      .select('id, email, marque, modele, annee, puissance_ch, masse_kg, immatriculation, user_id, cree_le')
      .eq('id', id).maybeSingle();
    if (!dem) return new Response(JSON.stringify({ error: 'demande_not_found' }), { status: 404 });
    const d = dem as Record<string, any>;
    const vehicule = `${d.marque ?? ''} ${d.modele ?? ''}`.trim() + (d.annee ? ` (${d.annee})` : '');

    // ── CE QUE CE COURRIEL NE FAIT PAS ──────────────────────────────
    // Il ne calcule NI le ratio NI la classe. eligibiliteLogic.ts documente que
    // trois règles d'arrondi (Python, Postgres, JS) donnent trois ratios
    // différents, et que la classe se calcule sur le chiffre MONTRÉ au pilote.
    // Une quatrième implémentation ici, en TypeScript Deno, rouvrirait
    // exactement l'écart que le module ferme. Le courriel porte les faits
    // déclarés ; la classification appartient au module, sur la surface admin.
    title = "Demande d'examen de véhicule";
    subject = `OXV — Examen véhicule : ${vehicule || d.email}`;
    rows = [
      ['Véhicule', vehicule || '—'],
      ['Immatriculation', String(d.immatriculation ?? '—')],
      ['Puissance', d.puissance_ch != null ? `${entierFr(Number(d.puissance_ch))} ch` : 'non déclarée'],
      ['Masse', d.masse_kg != null ? `${entierFr(Number(d.masse_kg))} kg` : 'non déclarée'],
      ['Demandeur', String(d.email ?? '—')],
      ['Compte OXV', d.user_id ? 'oui' : 'non (demande hors compte)'],
      ['Reçue le', d.cree_le ? new Date(String(d.cree_le)).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'],
      ['Délai de réponse', '72 h ouvrées (CGV art. 5.3)'],
    ];
    ackEmail = typeof d.email === 'string' && d.email.includes('@') ? d.email : null;
    ackUserId = typeof d.user_id === 'string' ? d.user_id : null;
    ackRows = [
      ['Véhicule', vehicule || '—'],
      ['Immatriculation', String(d.immatriculation ?? '—')],
      ['Puissance déclarée', d.puissance_ch != null ? `${entierFr(Number(d.puissance_ch))} ch` : 'non déclarée'],
      ['Masse déclarée', d.masse_kg != null ? `${entierFr(Number(d.masse_kg))} kg` : 'non déclarée'],
    ];
  } else {
    const { data: msg } = await admin
      .from('contact_messages')
      .select('id, first_name, last_name, email, subject, message, metadata')
      .eq('id', id).maybeSingle();
    if (!msg) return new Response(JSON.stringify({ error: 'contact_not_found' }), { status: 404 });
    const m = ((msg as Record<string, any>).metadata ?? {}) as Record<string, any>;
    const contact = `${msg.first_name ?? ''} ${msg.last_name ?? ''}`.trim() || '—';
    if (kind === 'corporate') {
      title = 'Nouveau lead corporate';
      subject = `OXV — Lead corporate : ${m.company ?? msg.subject ?? ''}`.trim();
      rows = [
        ['Société', String(m.company ?? '—')],
        ['Contact', contact],
        ['Email', msg.email ?? '—'],
        ['Format', String(m.event_type ?? '—')],
        ['Invités', String(m.guest_count ?? '—')],
        ['Période', String(m.preferred_period ?? '—')],
      ];
    } else if (kind === 'waitlist') {
      title = 'Nouvelle inscription — liste d\'attente';
      subject = `OXV — Liste d'attente : ${contact}`;
      rows = [
        ['Contact', contact],
        ['Email', msg.email ?? '—'],
        ['Intérêt', String(m.preference ?? '—')],
        ['Département', String(m.departement ?? '—')],
        ['Véhicule', String(m.vehicule ?? '—')],
      ];
    } else if (kind === 'partner') {
      title = 'Nouveau lead partenaire';
      subject = `OXV — Partenaire : ${m.company ?? contact}`;
      rows = [
        ['Société', String(m.company ?? '—')],
        ['Type', String(m.partner_type ?? '—')],
        ['Contact', contact],
        ['Email', msg.email ?? '—'],
        ['Zone', String(m.zone ?? '—')],
      ];
    } else {
      title = 'Nouvelle demande presse';
      subject = `OXV — Presse : ${m.media_outlet ?? contact}`;
      rows = [
        ['Média', String(m.media_outlet ?? '—')],
        ['Type', String(m.request_type ?? '—')],
        ['Contact', contact],
        ['Email', msg.email ?? '—'],
        ['Échéance', String(m.deadline ?? '—')],
      ];
    }
  }

  const bodyText = `${title}\n` + rows.map(([k, v]) => `${k} : ${v}`).join('\n') + `\n\nÀ traiter dans l'admin OXV.`;
  const mail = wrap(title, rows, bodyText);

  let sent = false, resendId: string | null = null, sendError: string | null = null;
  if (!dejaAlerte) {
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
  }

  // ── L'ACCUSÉ AU DEMANDEUR ─────────────────────────────────
  // Le délai de 72 h ouvrées est un engagement de CGV (art. 5.3). Un engagement
  // que le demandeur ne voit nulle part n'en est pas un : l'accusé est ce qui
  // le rend opposable. Il a sa PROPRE clé d'idempotence — si l'alerte admin est
  // rejouée par pg_net, l'accusé ne part pas deux fois, et un accusé en échec
  // garde sa chance au rejeu suivant, puisque l'alerte déjà partie ne coupe
  // plus l'exécution en amont.
  //
  // Son échec n'invalide pas l'appel : la demande est enregistrée en base, et
  // c'est elle qui fait foi, pas le courriel.
  let ackSent: boolean | null = null;
  if (kind === 'vehicule' && ackEmail) {
    const { data: dejaAck } = await admin
      .from('email_log').select('id').eq('email_type', 'vehicule_ack')
      .eq('metadata->>ref_id', id).limit(1);
    if (dejaAck && dejaAck.length > 0) {
      ackSent = null; // déjà accusé, on ne renvoie pas
    } else {
      const ackSubject = "OXV — Votre demande d'examen de véhicule";
      const ack = wrapPilote(
        'Votre demande est enregistrée',
        "Vous avez sollicité un examen individuel pour le véhicule ci-dessous. Le Club vous répond sous soixante-douze heures ouvrées.",
        ackRows,
        "L'absence d'un véhicule du référentiel publié ne vaut pas décision de non-éligibilité : elle ouvre cet examen. L'examen porte sur le véhicule, jamais sur le pilote.",
      );
      let ackError: string | null = null, ackResendId: string | null = null;
      try {
        const r = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [ackEmail], subject: ackSubject, html: ack.html, text: ack.text, tags: [{ name: 'category', value: 'vehicule_ack' }] }),
        });
        const j = await r.json().catch(() => ({}));
        ackSent = r.ok; ackResendId = j?.id ?? null;
        if (!r.ok) ackError = `resend_${r.status}: ${JSON.stringify(j).slice(0, 200)}`;
      } catch (e) { ackSent = false; ackError = String(e); }

      await admin.from('email_log').insert({
        user_id: ackUserId, email_type: 'vehicule_ack', subject: ackSubject,
        template_used: 'vehicule_ack_v1', status: ackSent ? 'sent' : 'bounced',
        metadata: { to: ackEmail, kind, ref_id: id, resend_message_id: ackResendId, error: ackError },
      }).then(({ error }) => { if (error) console.warn('[notify-admin-lead] email_log ack:', error.message); });
    }
  }

  return new Response(JSON.stringify({ ok: true, email_sent: sent, email_skipped: dejaAlerte, email_error: sendError, ack_sent: ackSent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
