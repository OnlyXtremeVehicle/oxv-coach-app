import {
  VAT_FRANCHISE_NOTE,
  canIssueInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
  isValidSiret,
  linesAmountHtCents,
  normalizeSiret,
  parseEurosToCents,
} from '@/services/coachBillingLogic';

describe('computeInvoiceTotals', () => {
  it('franchise (micro) : pas de TVA + mention 293 B', () => {
    const t = computeInvoiceTotals(10000, 'franchise', null);
    expect(t).toEqual({
      amountHt: 10000,
      vatAmount: 0,
      amountTotal: 10000,
      vatRate: null,
      vatNote: VAT_FRANCHISE_NOTE,
    });
  });

  it('assujetti : TVA au taux, arrondie au centime', () => {
    const t = computeInvoiceTotals(10000, 'assujetti', 20);
    expect(t.vatAmount).toBe(2000);
    expect(t.amountTotal).toBe(12000);
    expect(t.vatRate).toBe(20);
    expect(t.vatNote).toBeNull();
  });

  it('assujetti sans taux valide → 0 % (pas de TVA fantôme)', () => {
    const t = computeInvoiceTotals(10000, 'assujetti', null);
    expect(t.vatAmount).toBe(0);
    expect(t.amountTotal).toBe(10000);
  });

  it('montant négatif ramené à 0 (honnêteté)', () => {
    expect(computeInvoiceTotals(-500, 'franchise', null).amountHt).toBe(0);
  });
});

describe('formatInvoiceNumber', () => {
  it('année + séquence zéro-paddée', () => {
    expect(formatInvoiceNumber(2027, 1)).toBe('2027-0001');
    expect(formatInvoiceNumber(2027, 42)).toBe('2027-0042');
  });
});

describe('canIssueInvoice', () => {
  it('exige assist activée + nom + SIRET', () => {
    expect(
      canIssueInvoice({
        invoicingAssistEnabled: true,
        billingName: 'Coach SARL',
        billingSiret: '123',
      })
    ).toBe(true);
    expect(
      canIssueInvoice({
        invoicingAssistEnabled: false,
        billingName: 'Coach SARL',
        billingSiret: '123',
      })
    ).toBe(false);
    expect(
      canIssueInvoice({ invoicingAssistEnabled: true, billingName: null, billingSiret: '123' })
    ).toBe(false);
  });
});

describe('normalizeSiret', () => {
  it('ne garde que les chiffres', () => {
    expect(normalizeSiret('732 829 320 00074')).toBe('73282932000074');
    expect(normalizeSiret('abc12')).toBe('12');
  });
});

describe('isValidSiret', () => {
  it('accepte un SIRET valide (14 chiffres + Luhn), espaces tolérés', () => {
    expect(isValidSiret('73282932000074')).toBe(true);
    expect(isValidSiret('732 829 320 00074')).toBe(true);
  });
  it('rejette une longueur ou une clé incorrecte', () => {
    expect(isValidSiret('73282932000075')).toBe(false); // clé fausse
    expect(isValidSiret('123')).toBe(false); // trop court
    expect(isValidSiret('')).toBe(false);
  });
});

describe('parseEurosToCents', () => {
  it('parse les formats FR courants', () => {
    expect(parseEurosToCents('120')).toBe(12000);
    expect(parseEurosToCents('120,50')).toBe(12050);
    expect(parseEurosToCents('1 200,5')).toBe(120050);
  });
  it('rejette les saisies illisibles', () => {
    expect(parseEurosToCents('')).toBeNull();
    expect(parseEurosToCents('abc')).toBeNull();
    expect(parseEurosToCents('12,345')).toBeNull(); // 3 décimales
  });
});

describe('linesAmountHtCents', () => {
  it('somme quantité × prix unitaire, négatifs ramenés à 0', () => {
    expect(
      linesAmountHtCents([
        { quantity: 2, unitPriceCents: 5000 },
        { quantity: 1, unitPriceCents: 3000 },
      ])
    ).toBe(13000);
    expect(linesAmountHtCents([{ quantity: -3, unitPriceCents: 5000 }])).toBe(0);
  });
});
