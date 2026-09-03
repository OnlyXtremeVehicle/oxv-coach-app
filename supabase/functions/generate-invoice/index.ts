// =============================================================================
// OXV — Edge Function : generate-invoice (v2)
// =============================================================================
// Génère une facture (ou un avoir) : numéro séquentiel, snapshot immuable,
// PDF (pdf-lib) uploadé dans le bucket privé 'invoices', ligne `invoices`,
// maj payments.invoice_pdf_url, email Resend avec PDF joint.
// AUTH : header x-oxv-invoke-secret (trigger pg_net) OU JWT admin (bouton admin).
// Idempotente : si une facture existe déjà pour ce paiement, la renvoie.
// v2 (audit lancement 2026-07-04) : GARDE-FOU LÉGAL — aucune facture ne peut
// être émise tant que le secret OXV_SIRET n'est pas configuré (interdiction
// d'émettre une facture sans numéro d'immatriculation, C. com. R123-237).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'OXV <contact@oxvehicle.fr>';

const SELLER = {
  name: 'OXV — Only Xtreme Vehicle',
  legal: '',
  address: 'Circuit de Haute Saintonge — 17360 La Génétouze, France',
  email: 'contact@oxvehicle.fr',
  vat_note: 'TVA non applicable, art. 293 B du CGI',
};

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-oxv-invoke-secret' } });
const eur = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

async function buildPdf(inv: Record<string, any>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.04, 0.04, 0.04), mute = rgb(0.45, 0.45, 0.45), red = rgb(0.847, 0.059, 0.122);
  let y = 790;
  const text = (t: string, x: number, size = 10, font = helv, color = dark) => page.drawText(t, { x, y, size, font, color });

  text('OXV', 50, 26, bold, red); text(inv.type === 'credit_note' ? 'AVOIR' : 'FACTURE', 440, 20, bold, dark);
  y -= 18; text(SELLER.name, 50, 9, helv, mute); text(String(inv.number), 440, 11, bold, mute);
  y -= 14; text(SELLER.address, 50, 9, helv, mute); text('Date : ' + inv.issued_at, 440, 9, helv, mute);
  y -= 14; text(SELLER.legal, 50, 9, helv, mute);
  y -= 14; text(SELLER.email, 50, 9, helv, mute);
  y -= 30; text('Facturé à', 50, 9, bold, mute);
  y -= 14; text(String(inv.customer.name || '—'), 50, 11, bold, dark);
  if (inv.customer.address) { y -= 13; text(String(inv.customer.address), 50, 9, helv, mute); }
  y -= 13; text(String(inv.customer.email || ''), 50, 9, helv, mute);
  if (inv.type === 'credit_note' && inv.credit_ref) { y -= 13; text('Avoir sur facture ' + inv.credit_ref, 50, 9, helv, mute); }

  y -= 34;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.7, color: mute });
  y -= 16; text('Désignation', 50, 9, bold, mute); text('Qté', 400, 9, bold, mute); text('Montant', 470, 9, bold, mute);
  for (const l of inv.lines) {
    y -= 18;
    text(String(l.designation).slice(0, 70), 50, 10, helv, dark);
    text(String(l.quantity), 400, 10, helv, dark);
    text(eur(l.total), 470, 10, helv, dark);
  }
  y -= 14; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.7, color: mute });
  y -= 20; text('Total', 400, 12, bold, dark); text(eur(inv.amount_total), 470, 12, bold, dark);
  y -= 16; text(SELLER.vat_note, 400, 8, helv, mute);
  page.drawText('Facture générée par oxvehicle.fr — ' + SELLER.email, { x: 50, y: 40, size: 8, font: helv, color: mute });
  return await doc.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ─── GARDE-FOU LÉGAL : pas de SIRET configuré => aucune facture émise ───
  const SIRET = Deno.env.get('OXV_SIRET');
  if (!SIRET || !SIRET.trim()) {
    return json({ error: 'siret_missing', detail: 'Immatriculation requise : aucune facture ne peut être émise avant configuration du secret OXV_SIRET.' }, 503);
  }
  SELLER.legal = 'SIRET : ' + SIRET.trim();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });

  // ─── Auth : secret interne OU admin ───
  const SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  const gotSecret = SECRET && (req.headers.get('x-oxv-invoke-secret') ?? '') === SECRET;
  let isAdminCall = false;
  if (!gotSecret) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const { data: row } = await admin.from('users').select('is_admin, role').eq('id', u.user.id).maybeSingle();
    isAdminCall = !!row && (row.is_admin === true || row.role === 'admin');
    if (!isAdminCall) return json({ error: 'forbidden' }, 403);
  }

  let body: { payment_id?: string; credit_note_for?: string; reason?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  // ─── Données sources ───
  let invoiceRow: Record<string, any>;
  if (body.credit_note_for) {
    const { data: orig } = await admin.from('invoices').select('*').eq('id', body.credit_note_for).maybeSingle();
    if (!orig) return json({ error: 'invoice_not_found' }, 404);
    const { data: numData, error: numErr } = await admin.rpc('oxv_next_invoice_number');
    if (numErr) return json({ error: 'numbering_failed' }, 500);
    invoiceRow = {
      number: numData, type: 'credit_note', credit_note_for: orig.id,
      user_id: orig.user_id, payment_id: orig.payment_id, registration_id: orig.registration_id,
      issued_at: new Date().toISOString().slice(0, 10), currency: orig.currency,
      amount_total: -Math.abs(orig.amount_total), vat_note: SELLER.vat_note,
      seller: SELLER, customer: orig.customer,
      lines: [{ designation: `Avoir sur ${orig.number}${body.reason ? ' — ' + body.reason : ''}`, quantity: 1, unit_price: -Math.abs(orig.amount_total), total: -Math.abs(orig.amount_total) }],
    };
  } else {
    if (!body.payment_id) return json({ error: 'payment_id_required' }, 400);
    // Idempotence
    const { data: existing } = await admin.from('invoices').select('id, number, pdf_path').eq('payment_id', body.payment_id).eq('type', 'invoice').maybeSingle();
    if (existing) return json({ ok: true, existing: true, id: existing.id, number: existing.number, pdf_path: existing.pdf_path });

    const { data: pay } = await admin.from('payments')
      .select('id, user_id, registration_id, amount, currency, status, reference, registrations:registration_id(offer_type, insurance_option, sessions:session_id(date))')
      .eq('id', body.payment_id).maybeSingle();
    if (!pay) return json({ error: 'payment_not_found' }, 404);
    if (pay.status !== 'succeeded' && !isAdminCall) return json({ error: 'payment_not_succeeded' }, 400);

    const { data: usr } = await admin.from('users').select('first_name, last_name, email, address_line, address_zip, address_city, address_country').eq('id', pay.user_id).maybeSingle();
    if (!usr) return json({ error: 'user_not_found' }, 404);
    const reg = (pay as Record<string, any>).registrations ?? {};
    const sess = reg?.sessions ?? {};
    const offer = String(reg?.offer_type ?? 'session');
    const desi = `Journée circuit OXV — offre ${offer.charAt(0).toUpperCase() + offer.slice(1)}${sess?.date ? ' — session du ' + sess.date : ''}${pay.reference ? ' — réf. ' + pay.reference : ''}`;
    const { data: numData, error: numErr } = await admin.rpc('oxv_next_invoice_number');
    if (numErr) return json({ error: 'numbering_failed' }, 500);
    const addr = [usr.address_line, [usr.address_zip, usr.address_city].filter(Boolean).join(' '), usr.address_country].filter(Boolean).join(', ');
    invoiceRow = {
      number: numData, type: 'invoice', credit_note_for: null,
      user_id: pay.user_id, payment_id: pay.id, registration_id: pay.registration_id,
      issued_at: new Date().toISOString().slice(0, 10), currency: pay.currency || 'EUR',
      amount_total: pay.amount, vat_note: SELLER.vat_note,
      seller: SELLER,
      customer: { name: `${usr.first_name ?? ''} ${usr.last_name ?? ''}`.trim(), email: usr.email, address: addr || null },
      lines: [{ designation: desi, quantity: 1, unit_price: pay.amount, total: pay.amount }],
    };
  }

  // ─── PDF + upload + insert ───
  const pdfBytes = await buildPdf({ ...invoiceRow, credit_ref: body.credit_note_for ? (await admin.from('invoices').select('number').eq('id', body.credit_note_for).maybeSingle()).data?.number : null });
  const pdfPath = `${invoiceRow.user_id}/${invoiceRow.number}.pdf`;
  const { error: upErr } = await admin.storage.from('invoices').upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (upErr) return json({ error: 'upload_failed', detail: upErr.message }, 500);
  invoiceRow.pdf_path = pdfPath;
  const { data: inserted, error: insErr } = await admin.from('invoices').insert(invoiceRow).select('id, number').single();
  if (insErr) return json({ error: 'insert_failed', detail: insErr.message }, 500);
  if (invoiceRow.payment_id) {
    await admin.from('payments').update({ invoice_pdf_url: pdfPath }).eq('id', invoiceRow.payment_id);
  }

  // ─── Email (best-effort, n'échoue jamais la facture) ───
  let emailSent = false;
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (RESEND_KEY && invoiceRow.customer?.email) {
    try {
      const b64 = btoa(String.fromCharCode(...pdfBytes));
      const subj = invoiceRow.type === 'credit_note' ? `OXV — Avoir ${invoiceRow.number}` : `OXV — Votre facture ${invoiceRow.number}`;
      const res = await fetch(RESEND_API_URL, {
        method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [invoiceRow.customer.email], subject: subj,
          text: `Bonjour,\n\nVous trouverez ci-joint ${invoiceRow.type === 'credit_note' ? 'votre avoir' : 'votre facture'} ${invoiceRow.number} (${eur(invoiceRow.amount_total)}).\nElle reste disponible à tout moment dans votre espace pilote sur oxvehicle.fr.\n\n— OXV`,
          attachments: [{ filename: `${invoiceRow.number}.pdf`, content: b64 }] }),
      });
      emailSent = res.ok;
      await admin.from('email_log').insert({ user_id: invoiceRow.user_id, email_type: 'invoice', subject: subj, template_used: 'invoice_v2', status: emailSent ? 'sent' : 'bounced', metadata: { number: invoiceRow.number, invoice_id: inserted.id } });
    } catch (_) { /* best effort */ }
  }

  return json({ ok: true, id: inserted.id, number: inserted.number, pdf_path: pdfPath, email_sent: emailSent });
});
