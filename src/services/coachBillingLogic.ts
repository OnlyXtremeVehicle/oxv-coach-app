/**
 * Facturation coach — logique pure (P2, VISION_COACH_STUDIO.md).
 *
 * L'app AIDE le coach à éditer SA facture (émetteur = le coach ; paiement direct
 * au coach, hors OXV). Ici : calcul HT/TVA/TTC selon le régime du coach et le
 * format du numéro. Pur, testé. ⚠ Gabarit + régime à faire valider par un
 * comptable ; le coach reste responsable de SA facturation.
 */

export type VatRegime = 'franchise' | 'assujetti';

/** Mention légale de franchise en base (micro-entreprise). */
export const VAT_FRANCHISE_NOTE = 'TVA non applicable, art. 293 B du CGI';

export interface InvoiceTotals {
  amountHt: number; // centimes
  vatAmount: number; // centimes (0 en franchise)
  amountTotal: number; // centimes
  vatRate: number | null; // % (null en franchise)
  vatNote: string | null; // mention franchise, sinon null
}

/**
 * Calcule les totaux d'une facture coach à partir du montant HT (centimes) et
 * du régime. Franchise (micro) : pas de TVA + mention 293 B. Assujetti : TVA au
 * taux fourni. Arrondi de la TVA au centime.
 */
export function computeInvoiceTotals(
  amountHtCents: number,
  regime: VatRegime,
  vatRate: number | null
): InvoiceTotals {
  const ht = Math.max(0, Math.round(amountHtCents));
  if (regime === 'franchise') {
    return {
      amountHt: ht,
      vatAmount: 0,
      amountTotal: ht,
      vatRate: null,
      vatNote: VAT_FRANCHISE_NOTE,
    };
  }
  const rate = typeof vatRate === 'number' && Number.isFinite(vatRate) && vatRate > 0 ? vatRate : 0;
  const vat = Math.round((ht * rate) / 100);
  return { amountHt: ht, vatAmount: vat, amountTotal: ht + vat, vatRate: rate, vatNote: null };
}

/** Numéro de facture affiché : « 2027-0001 » (séquence par coach, allouée serveur). */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `${year}-${String(Math.max(1, Math.floor(seq))).padStart(4, '0')}`;
}

/** Le coach peut-il émettre une facture (profil de facturation minimal renseigné) ? */
export function canIssueInvoice(profile: {
  invoicingAssistEnabled: boolean;
  billingName: string | null;
  billingSiret: string | null;
}): boolean {
  return Boolean(
    profile.invoicingAssistEnabled &&
    profile.billingName &&
    profile.billingName.trim() &&
    profile.billingSiret &&
    profile.billingSiret.trim()
  );
}
