/**
 * Tests du bandeau « mode démo » du Bilan (PR-20b).
 */

import { demoBannerForEventType } from '../eventContextLogic';

describe('demoBannerForEventType', () => {
  it('ne montre rien pour une session de circuit ou sans événement', () => {
    expect(demoBannerForEventType('session')).toBeNull();
    expect(demoBannerForEventType(null)).toBeNull();
    expect(demoBannerForEventType(undefined)).toBeNull();
  });

  it('montre le bandeau honnête pour les événements hors circuit', () => {
    for (const t of ['balade_decouverte', 'test_alpha', 'partenaire', 'corporate']) {
      const b = demoBannerForEventType(t);
      expect(b).not.toBeNull();
      expect(b?.title.toLowerCase()).toContain('pas une session de circuit');
      expect(b?.body.toLowerCase()).toContain('expérimentales');
    }
  });
});
