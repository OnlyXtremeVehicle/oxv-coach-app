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
  const rate = tauxTvaUtilisable(vatRate);
  if (rate === null) {
    // Coach assujetti sans taux exploitable. Imprimer « TVA (0 %) 0,00 € » sur un
    // document légal serait une valeur FABRIQUÉE, et le coach remettrait à son
    // client une facture amputée sans le savoir. On renvoie donc un taux NUL au
    // sens de « inconnu » — l'émission doit refuser (voir issueInvoice).
    return {
      amountHt: ht,
      vatAmount: 0,
      amountTotal: ht,
      vatRate: null,
      vatNote: null,
    };
  }
  const vat = Math.round((ht * rate) / 100);
  return { amountHt: ht, vatAmount: vat, amountTotal: ht + vat, vatRate: rate, vatNote: null };
}

/**
 * Le taux de TVA exploitable, ou null.
 *
 * PostgREST rend les colonnes `numeric` en CHAÎNE au runtime, alors que le type
 * TypeScript annonce `number` : `typeof vatRate === 'number'` était donc faux
 * pour un coach ayant renseigné 20 %, et le taux retombait silencieusement à 0.
 * On coerce ici plutôt que de faire confiance au type.
 */
export function tauxTvaUtilisable(brut: unknown): number | null {
  if (brut === null || brut === undefined || brut === '') return null;
  const n = typeof brut === 'number' ? brut : Number(brut);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
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

/** Forme générale d'un IBAN (2 lettres pays + 2 chiffres de clé + 10-30 alphanum). */
const IBAN_LIKE = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

/**
 * Garde SEC-1 : un lien de paiement acceptable est une URL http(s) — JAMAIS un
 * IBAN. `coach_profiles.payment_link` est lisible par tous via la policy
 * `coach_profiles_read_published` : des coordonnées bancaires n'y ont pas leur
 * place (elles vivent dans `coach_payout_details`, RLS owner + admin). Une
 * saisie vide reste acceptée (effacement du lien).
 */
export function isAcceptablePaymentLink(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim();
  if (v === '') return true;
  if (IBAN_LIKE.test(v.replace(/\s+/g, '').toUpperCase())) return false;
  return /^https?:\/\/\S+$/i.test(v);
}
