import { hasCurrentSignature, isValidSignerName } from '@/services/waiverLogic';

describe('isValidSignerName', () => {
  it('refuse vide, espaces, trop court', () => {
    expect(isValidSignerName('')).toBe(false);
    expect(isValidSignerName('   ')).toBe(false);
    expect(isValidSignerName('A')).toBe(false);
  });
  it('accepte un nom renseigné', () => {
    expect(isValidSignerName('Jean Dupont')).toBe(true);
    expect(isValidSignerName('  Éric  ')).toBe(true);
  });
  it('refuse au-delà de 120 caractères', () => {
    expect(isValidSignerName('x'.repeat(121))).toBe(false);
  });
});

describe('hasCurrentSignature', () => {
  const sigs = [
    { waiverVersion: '0.1', bookingId: 'b1' },
    { waiverVersion: '0.1', bookingId: null },
  ];

  it('vrai si version courante signée (sans filtre réservation)', () => {
    expect(hasCurrentSignature(sigs, '0.1')).toBe(true);
  });
  it('faux si aucune signature de la version courante', () => {
    expect(hasCurrentSignature(sigs, '0.2')).toBe(false);
  });
  it('à la réservation : exige une signature de CETTE réservation', () => {
    expect(hasCurrentSignature(sigs, '0.1', 'b1')).toBe(true);
    expect(hasCurrentSignature(sigs, '0.1', 'b2')).toBe(false);
  });
});
