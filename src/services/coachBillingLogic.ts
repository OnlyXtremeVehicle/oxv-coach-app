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

/** Formes juridiques courantes d'un coach indépendant (aide à la saisie). */
export const COACH_LEGAL_FORMS = [
  'Auto-entrepreneur',
  'EI',
  'EURL',
  'SASU',
  'SARL',
  'SAS',
  'Autre',
] as const;

/** Ne garde que les chiffres d'un SIRET saisi (retire espaces et séparateurs). */
export function normalizeSiret(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Valide un SIRET français : 14 chiffres + clé de Luhn. C'est un GARDE-FOU d'aide
 * à la saisie (indice doux), PAS un bloquant : `canIssueInvoice` n'exige qu'un
 * SIRET non vide (un coach peut relever d'une structure étrangère). On n'invente
 * rien — on signale seulement une saisie probablement erronée.
 */
export function isValidSiret(input: string): boolean {
  const s = normalizeSiret(input);
  if (s.length !== 14) return false;
  // Luhn canonique, en partant du chiffre de droite.
  let sum = 0;
  let double = false;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let d = s.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Calcule le montant HT total (centimes) d'un jeu de lignes de facture. Chaque
 * ligne = quantité × prix unitaire (centimes). Négatifs ramenés à 0 (honnêteté).
 */
export function linesAmountHtCents(lines: { quantity: number; unitPriceCents: number }[]): number {
  return lines.reduce((sum, l) => {
    const q = Math.max(0, l.quantity);
    const pu = Math.max(0, Math.round(l.unitPriceCents));
    return sum + q * pu;
  }, 0);
}

/**
 * Parse une saisie d'euros en français (« 120 », « 120,50 », « 1 200,5 ») en
 * centimes. Renvoie null si la saisie n'est pas un montant lisible.
 */
export function parseEurosToCents(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}
