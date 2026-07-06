import {
  VAT_FRANCHISE_NOTE,
  canIssueInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
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
