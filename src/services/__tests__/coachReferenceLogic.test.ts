import {
  compareSpeedToReference,
  countCornersWithReference,
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

describe('countCornersWithReference — compteur réel par circuit', () => {
  const listed = [1, 2, 3, 4, 5, 6, 7];

  it('zéro repère → 0', () => {
    expect(countCornersWithReference([], listed)).toBe(0);
  });

  it('ne compte que les repères qui portent une information', () => {
    expect(
      countCornersWithReference(
        [
          { cornerIndex: 1, brakingPointM: 110 },
          { cornerIndex: 2 }, // vide : ne compte pas
          { cornerIndex: 3, trajectoryNote: '   ' }, // blanc : ne compte pas
        ],
        listed
      )
    ).toBe(1);
  });

  it('exclut un repère orphelin d’un virage non listé sur ce tracé', () => {
    // Un repère posé sur un « virage 12 » n'entre pas dans le compte d'un
    // circuit qui n'en liste que 7 : le compteur reste honnête.
    expect(
      countCornersWithReference(
        [
          { cornerIndex: 12, targetSpeedKmh: 90 },
          { cornerIndex: 4, targetSpeedKmh: 88 },
        ],
        listed
      )
    ).toBe(1);
  });

  it('un virage ne compte qu’une fois, même avec des doublons', () => {
    expect(
      countCornersWithReference(
        [
          { cornerIndex: 5, brakingPointM: 100 },
          { cornerIndex: 5, targetSpeedKmh: 95 },
        ],
        listed
      )
    ).toBe(1);
  });

  it('tous posés → le total des virages listés', () => {
    expect(
      countCornersWithReference(
        listed.map((cornerIndex) => ({ cornerIndex, brakingPointM: 100 })),
        listed
      )
    ).toBe(7);
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
