import {
  type MarginBreakdown,
  computeCoachReading,
  validateReadingWeights,
} from '../coachReadingLogic';

const BREAKDOWN: MarginBreakdown = {
  vehicle: 80,
  pilot: 60,
  regularity: 100,
  smoothness: 40,
};

describe('computeCoachReading', () => {
  it('équipondération = moyenne simple', () => {
    // (80+60+100+40)/4 = 70
    expect(
      computeCoachReading(BREAKDOWN, {
        wVehicle: 25,
        wPilot: 25,
        wRegularity: 25,
        wSmoothness: 25,
      })
    ).toBe(70);
  });

  it('normalise les poids (pas besoin de sommer à 100)', () => {
    // poids 1/1/1/1 → même résultat que 25/25/25/25
    expect(
      computeCoachReading(BREAKDOWN, { wVehicle: 1, wPilot: 1, wRegularity: 1, wSmoothness: 1 })
    ).toBe(70);
  });

  it('un seul poids → renvoie cette sous-composante', () => {
    expect(
      computeCoachReading(BREAKDOWN, {
        wVehicle: 0,
        wPilot: 0,
        wRegularity: 1,
        wSmoothness: 0,
      })
    ).toBe(100);
  });

  it('pondère réellement', () => {
    // tout sur le pilote (60) et la fluidité (40), 50/50 → 50
    expect(
      computeCoachReading(BREAKDOWN, {
        wVehicle: 0,
        wPilot: 1,
        wRegularity: 0,
        wSmoothness: 1,
      })
    ).toBe(50);
  });

  it('poids totaux nuls → null', () => {
    expect(
      computeCoachReading(BREAKDOWN, {
        wVehicle: 0,
        wPilot: 0,
        wRegularity: 0,
        wSmoothness: 0,
      })
    ).toBeNull();
  });
});

describe('validateReadingWeights', () => {
  it('accepte des poids valides', () => {
    expect(
      validateReadingWeights({ wVehicle: 30, wPilot: 30, wRegularity: 20, wSmoothness: 20 })
    ).toBeNull();
  });

  it('refuse un poids négatif', () => {
    expect(
      validateReadingWeights({ wVehicle: -1, wPilot: 30, wRegularity: 20, wSmoothness: 20 })
    ).toMatch(/positives/i);
  });

  it('refuse des poids tous nuls', () => {
    expect(
      validateReadingWeights({ wVehicle: 0, wPilot: 0, wRegularity: 0, wSmoothness: 0 })
    ).toMatch(/sup/i);
  });

  it('refuse une note trop longue', () => {
    expect(
      validateReadingWeights({
        wVehicle: 25,
        wPilot: 25,
        wRegularity: 25,
        wSmoothness: 25,
        note: 'a'.repeat(281),
      })
    ).toMatch(/trop longue/i);
  });
});
