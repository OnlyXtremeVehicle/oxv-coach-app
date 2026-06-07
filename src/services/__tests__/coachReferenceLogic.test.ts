import {
  compareSpeedToReference,
  referenceHasContent,
  validateCornerReference,
} from '../coachReferenceLogic';

describe('referenceHasContent', () => {
  it('faux si vide', () => {
    expect(referenceHasContent({})).toBe(false);
    expect(referenceHasContent({ trajectoryNote: '   ' })).toBe(false);
  });

  it('vrai dès qu’un champ est posé', () => {
    expect(referenceHasContent({ brakingPointM: 110 })).toBe(true);
    expect(referenceHasContent({ targetSpeedKmh: 90 })).toBe(true);
    expect(referenceHasContent({ trajectoryNote: 'Corde tardive' })).toBe(true);
  });
});

describe('validateCornerReference', () => {
  it('accepte une saisie valide', () => {
    expect(
      validateCornerReference({ brakingPointM: 110, targetSpeedKmh: 90, trajectoryNote: 'x' })
    ).toBeNull();
  });

  it('refuse un point de freinage négatif', () => {
    expect(validateCornerReference({ brakingPointM: -5 })).toMatch(/freinage/i);
  });

  it('refuse une vitesse négative', () => {
    expect(validateCornerReference({ targetSpeedKmh: -1 })).toMatch(/vitesse/i);
  });

  it('refuse une note trop longue', () => {
    expect(validateCornerReference({ trajectoryNote: 'a'.repeat(281) })).toMatch(/trop longue/i);
  });
});

describe('compareSpeedToReference', () => {
  it('retourne null si une valeur manque', () => {
    expect(compareSpeedToReference(null, 90)).toBeNull();
    expect(compareSpeedToReference(95, null)).toBeNull();
  });

  it('pilote plus rapide → above', () => {
    expect(compareSpeedToReference(95, 90)).toEqual({ deltaKmh: 5, direction: 'above' });
  });

  it('pilote plus lent → below', () => {
    expect(compareSpeedToReference(86, 90)).toEqual({ deltaKmh: -4, direction: 'below' });
  });

  it('identique → equal', () => {
    expect(compareSpeedToReference(90, 90)).toEqual({ deltaKmh: 0, direction: 'equal' });
  });

  it('arrondit au dixième', () => {
    expect(compareSpeedToReference(90.36, 90)?.deltaKmh).toBe(0.4);
  });
});
