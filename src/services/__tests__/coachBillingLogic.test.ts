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

  it('assujetti sans taux exploitable → taux INCONNU, jamais un 0 % affiché', () => {
    const t = computeInvoiceTotals(10000, 'assujetti', null);
    // `null` signifie « inconnu », pas « zéro ». C'est ce qui permet à
    // issueInvoice de REFUSER l'émission au lieu d'imprimer « TVA (0 %) » sur un
    // document légal.
    expect(t.vatRate).toBeNull();
    expect(t.vatAmount).toBe(0);
    expect(t.amountTotal).toBe(10000);
  });

  it('le taux venu de la base en CHAÎNE est bien pris en compte (piège PostgREST)', () => {
    // `coach_profiles.vat_rate` est une colonne `numeric` : PostgREST la rend en
    // chaîne au runtime. L'ancien test `typeof vatRate === 'number'` échouait
    // donc, et une facture de 1 000 € sortait à 0 € de TVA.
    const t = computeInvoiceTotals(100000, 'assujetti', '20.00' as unknown as number);
    expect(t.vatRate).toBe(20);
    expect(t.vatAmount).toBe(20000);
    expect(t.amountTotal).toBe(120000);
  });

  it('un taux aberrant est refusé plutôt qu’appliqué', () => {
    expect(computeInvoiceTotals(10000, 'assujetti', 0).vatRate).toBeNull();
    expect(computeInvoiceTotals(10000, 'assujetti', -5).vatRate).toBeNull();
    expect(computeInvoiceTotals(10000, 'assujetti', 250).vatRate).toBeNull();
    expect(computeInvoiceTotals(10000, 'assujetti', 'abc' as unknown as number).vatRate).toBeNull();
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
