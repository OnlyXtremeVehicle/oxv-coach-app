/**
 * Facture coach — génération PDF (P2, aide à la facture · émetteur = le coach).
 *
 * Rendu via expo-print (même patron technique que coachReportPdfService), partagé
 * via la share sheet native. IMPORTANT : contrairement aux documents INTERNES de
 * l'app (thème sombre = loi UI), une facture est un DOCUMENT EXTERNE remis à un
 * client — on la rend donc en BLANC professionnel, imprimable et lisible, comme
 * l'attend un tiers. C'est un choix délibéré, pas un écart de charte.
 *
 * Doctrine / honnêteté : l'émetteur est le COACH. OXV Mirror est un OUTIL d'aide
 * et n'intervient NI dans l'émission NI dans l'encaissement ; le coach demeure
 * seul responsable de la conformité de SA facturation. Aucun montant inventé :
 * les totaux viennent de coachBillingLogic (HT/TVA/TTC selon le régime déclaré).
 */

// eslint-disable-next-line import/no-unresolved -- expo-print installé au build (cf. coachReportPdfService)
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { CoachInvoiceDetail } from '@/services/coachBillingService';
import { formatDateLong } from '@/utils/format';

export interface InvoicePdfResult {
  ok: boolean;
  error?: string;
}

/** Centimes → euros « 1 200,00 € » (format facture, 2 décimales, espaces milliers). */
function euros(cents: number): string {
  const fixed = (cents / 100).toFixed(2).replace('.', ',');
  const [int, dec] = fixed.split(',');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped},${dec} €`;
}

/**
 * Génère et partage le PDF d'une facture coach.
 *
 * LE BLOC « RÈGLEMENT » A DISPARU LE 12/08/2026, avec la colonne
 * `coach_profiles.payment_link` que le plan V3 supprime. Le pied de la facture
 * porte déjà l'essentiel : OXV « n'intervient ni dans son émission, ni dans
 * l'encaissement du règlement ». Les coordonnées de règlement se transmettent
 * hors application, comme le règlement lui-même.
 */
export async function exportAndShareCoachInvoice(
  invoice: CoachInvoiceDetail
): Promise<InvoicePdfResult> {
  try {
    const html = buildInvoiceHtml(invoice);
    const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Facture ${invoice.number}`,
        UTI: 'com.adobe.pdf',
      });
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[OXV][pdf] facture coach :', message);
    return { ok: false, error: message };
  }
}

function buildInvoiceHtml(inv: CoachInvoiceDetail): string {
  const s = inv.seller;
  const issued = formatDateLong(inv.issuedAt);
  const service = inv.serviceDate ? formatDateLong(inv.serviceDate) : null;

  const lineRows = inv.lines
    .map((l) => {
      const lineHt = Math.max(0, l.quantity) * Math.max(0, l.unitPriceCents);
      return `
      <tr>
        <td class="l-label">${escapeHtml(l.label)}</td>
        <td class="l-num">${l.quantity}</td>
        <td class="l-num">${euros(l.unitPriceCents)}</td>
        <td class="l-num">${euros(lineHt)}</td>
      </tr>`;
    })
    .join('');

  const vatLine =
    inv.vatNote != null
      ? `<div class="tot-row"><span>TVA</span><span>${escapeHtml(inv.vatNote)}</span></div>`
      : `<div class="tot-row"><span>TVA${inv.vatRate != null ? ` (${inv.vatRate} %)` : ''}</span><span>${euros(inv.vatAmountCents)}</span></div>`;

  const sellerLines = [
    s.name ? `<strong>${escapeHtml(s.name)}</strong>` : '',
    s.legalForm ? escapeHtml(s.legalForm) : '',
    s.address ? escapeHtml(s.address).replace(/\n/g, '<br/>') : '',
    s.siret ? `SIRET ${escapeHtml(s.siret)}` : '',
  ]
    .filter(Boolean)
    .join('<br/>');

  return `
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; size: A4 portrait; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; padding: 48px 56px; background: #ffffff; color: #14140F;
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px; line-height: 1.5;
  }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .doc-title { font-size: 26px; font-weight: 700; letter-spacing: -0.4px; margin: 0; }
  .doc-meta { text-align: right; font-size: 12px; color: #444; }
  .doc-meta .num { font-weight: 700; color: #14140F; font-size: 14px; }
  .parties { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 36px; }
  .party { flex: 1; }
  .party .cap { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #8A8A80; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #8A8A80; border-bottom: 1.5px solid #14140F; padding: 0 8px 8px; }
  thead th.l-num, tbody td.l-num { text-align: right; }
  tbody td { padding: 10px 8px; border-bottom: 0.5px solid #E4E4DC; vertical-align: top; }
  .l-label { width: 55%; }
  .l-num { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 52%; }
  .tot-row { display: flex; justify-content: space-between; padding: 6px 0; color: #444; }
  .tot-row.grand { border-top: 1.5px solid #14140F; margin-top: 6px; padding-top: 12px; color: #14140F; font-weight: 700; font-size: 15px; }
  .pay { margin-top: 32px; padding: 14px 16px; background: #F6F6F0; border-radius: 6px; font-size: 12px; }
  .pay .cap { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #8A8A80; margin-bottom: 4px; }
  .legal { margin-top: 40px; padding-top: 16px; border-top: 0.5px solid #E4E4DC; font-size: 9.5px; line-height: 1.6; color: #8A8A80; }
</style>
</head>
<body>
  <div class="top">
    <h1 class="doc-title">Facture</h1>
    <div class="doc-meta">
      <div class="num">${escapeHtml(inv.number)}</div>
      <div>Émise le ${issued}</div>
      ${service ? `<div>Prestation du ${service}</div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="cap">Émetteur</div>
      <div>${sellerLines || '—'}</div>
    </div>
    <div class="party">
      <div class="cap">Client</div>
      <div>${inv.buyerName ? escapeHtml(inv.buyerName) : '—'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="l-label">Prestation</th>
        <th class="l-num">Qté</th>
        <th class="l-num">P.U. HT</th>
        <th class="l-num">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || '<tr><td class="l-label">—</td><td class="l-num"></td><td class="l-num"></td><td class="l-num"></td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="tot-row"><span>Total HT</span><span>${euros(inv.amountHtCents)}</span></div>
    ${vatLine}
    <div class="tot-row grand"><span>Total à régler</span><span>${euros(inv.amountTotalCents)}</span></div>
  </div>

  <div class="legal">
    Facture établie par l'émetteur ci-dessus, seul responsable de sa conformité (mentions,
    régime de TVA, numérotation). OXV Mirror est un outil d'aide à l'établissement de cette
    facture et n'intervient ni dans son émission, ni dans l'encaissement du règlement, qui est
    dû directement à l'émetteur. Le régime de TVA indiqué est celui déclaré par l'émetteur.
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
