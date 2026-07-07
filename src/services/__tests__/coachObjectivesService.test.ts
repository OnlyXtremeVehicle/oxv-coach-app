import { objectiveTargetLabel } from '@/services/coachObjectivesLogic';

describe('objectiveTargetLabel', () => {
  it('sans cible : seule la métrique est nommée', () => {
    expect(
      objectiveTargetLabel({ metric: 'regularity', targetDirection: 'below', targetValue: null })
    ).toBe('Régularité');
  });

  it('direction below → « sous »', () => {
    expect(
      objectiveTargetLabel({ metric: 'regularity', targetDirection: 'below', targetValue: 0.5 })
    ).toBe('Régularité · sous 0.5');
  });

  it('direction above → « au-dessus de »', () => {
    expect(
      objectiveTargetLabel({ metric: 'corner_speed', targetDirection: 'above', targetValue: 90 })
    ).toBe('Vitesse en virage · au-dessus de 90');
  });

  it('direction reach → « atteindre »', () => {
    expect(
      objectiveTargetLabel({ metric: 'lap_count', targetDirection: 'reach', targetValue: 30 })
    ).toBe('Nombre de tours · atteindre 30');
  });
});
