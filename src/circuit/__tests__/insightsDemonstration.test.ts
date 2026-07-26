import { DEMO_SESSION_INSIGHTS, insightsSontDeDemonstration } from '@/circuit/sessionInsights';

/**
 * Une lecture alimentée par un moteur de démonstration doit se déclarer comme
 * telle. Le contraire — des chiffres fabriqués présentés comme des mesures —
 * est la faute que la doctrine interdit explicitement.
 *
 * Ce test verrouille la RÈGLE, pas une valeur d'écran : il échoue si quelqu'un
 * rend la détection permissive, ou s'il oublie le cas d'une version absente.
 */
describe('insightsSontDeDemonstration', () => {
  it('reconnaît la ligne de démonstration livrée avec le dépôt', () => {
    expect(insightsSontDeDemonstration(DEMO_SESSION_INSIGHTS)).toBe(true);
  });

  it('reconnaît le moteur de démonstration tel qu’il est en production', () => {
    expect(insightsSontDeDemonstration({ engine_version: 'mirror-insights-demo' })).toBe(true);
  });

  it('laisse passer un moteur de mesure réel', () => {
    expect(insightsSontDeDemonstration({ engine_version: 'mirror-insights-v1' })).toBe(false);
    expect(insightsSontDeDemonstration({ engine_version: 'qdi-1.1.0' })).toBe(false);
  });

  it('traite toute version absente ou vide comme suspecte (fail-safe)', () => {
    expect(insightsSontDeDemonstration({ engine_version: '' })).toBe(true);
    expect(insightsSontDeDemonstration({ engine_version: null as unknown as string })).toBe(true);
  });

  it('attrape un futur moteur de démonstration nommé autrement', () => {
    expect(insightsSontDeDemonstration({ engine_version: 'mirror-demo-v2' })).toBe(true);
    expect(insightsSontDeDemonstration({ engine_version: 'insights-demo-valence' })).toBe(true);
  });

  it('ne dit rien quand il n’y a aucune ligne : absence n’est pas démonstration', () => {
    // Sans ligne, l'écran montre un état vide honnête — pas un bandeau de démo.
    expect(insightsSontDeDemonstration(null)).toBe(false);
  });
});
