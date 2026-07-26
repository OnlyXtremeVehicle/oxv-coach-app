import { insightsMesures, MOTEURS_INSIGHTS_REELS } from '@/circuit/sessionInsights';
import { INSIGHTS_ENGINE_VERSION } from '@/services/sessionInsightsEngine';

/**
 * Le service d'insights ne rend que des MESURES.
 *
 * La production porte encore une ligne `mirror-insights-demo` dont les chiffres
 * sont fabriqués. Sans ce filtre, quatre lectures approfondies affichaient une
 * invention comme une mesure — exactement la faute que la doctrine interdit.
 *
 * Ces tests verrouillent la RÈGLE, pas une valeur d'écran. Ils échouent si la
 * reconnaissance devient permissive, ou si un moteur entre dans la liste sans
 * qu'on l'ait voulu.
 */
describe('insightsMesures', () => {
  it('accepte les moteurs de mesure déclarés, et eux seuls', () => {
    expect(insightsMesures({ engine_version: 'mirror-insights-v1' })).toBe(true);
    expect(insightsMesures({ engine_version: 'mirror-insights-v3' })).toBe(true);
    expect(MOTEURS_INSIGHTS_REELS).toHaveLength(2);
  });

  it('refuse le moteur de démonstration tel qu’il est en production', () => {
    expect(insightsMesures({ engine_version: 'mirror-insights-demo' })).toBe(false);
  });

  it('refuse tout moteur inconnu sans chercher à l’interpréter', () => {
    // Pas de correspondance partielle : « mirror-insights-v2 » ressemble à un
    // moteur réel, mais personne ne l'a déclaré. On ne devine pas.
    expect(insightsMesures({ engine_version: 'mirror-insights-v2' })).toBe(false);
    expect(insightsMesures({ engine_version: 'mirror-insights-v1-beta' })).toBe(false);
    expect(insightsMesures({ engine_version: 'qdi-1.1.0' })).toBe(false);
  });

  it('refuse une version absente ou vide — fail-closed', () => {
    expect(insightsMesures({ engine_version: '' })).toBe(false);
    expect(insightsMesures({ engine_version: null as unknown as string })).toBe(false);
    expect(insightsMesures(null)).toBe(false);
  });

  it('aucun moteur déclaré réel ne porte un nom de démonstration', () => {
    for (const moteur of MOTEURS_INSIGHTS_REELS) {
      expect(moteur).not.toMatch(/demo|test|fake|mock/i);
    }
  });

  it('le moteur que l’application sait calculer est reconnu comme réel', () => {
    // Garde contre la dérive : si `INSIGHTS_ENGINE_VERSION` change sans que la
    // liste suive, l'application cesserait d'afficher ses propres calculs.
    expect(insightsMesures({ engine_version: INSIGHTS_ENGINE_VERSION })).toBe(true);
  });
});
