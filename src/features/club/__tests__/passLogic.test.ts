/**
 * Tests purs — ce qui RESTE de la logique historique du Pass.
 *
 * Le partage des journées, les libellés et l'éligibilité du QR ont déménagé
 * dans `passJourneeLogic` avec leurs tests : ils parlaient le vocabulaire de
 * `event_registrations`, table à zéro ligne que le Pass lisait depuis toujours.
 *
 * Restent ici la destination du bouton quand le pilote n'a aucune journée
 * (fail-closed sur le drapeau paiement) et la charge utile du QR, commune au
 * flux v1.
 */

import { URL_JOURNEES_SITE, passEmptyCta, qrCheckinPayload } from '../passLogic';

describe('passEmptyCta — fail-closed sur le drapeau paiement', () => {
  it('paiements armés → réserver ; sinon → le site', () => {
    expect(passEmptyCta(true)).toBe('reserve');
    // Paiements fermés : le SITE, pas la porte Club. Le repli précédent
    // ramenait le pilote à l'écran d'où il venait — voir le plan, jalon 5 :
    // « un lien vers le site avec le chemin exact, jamais un bouton mort ».
    expect(passEmptyCta(false)).toBe('site');
  });

  it("l'adresse du site est complète et sûre — jamais un chemin relatif", () => {
    // Un `openURL` sur un chemin relatif ne fait rien, en silence.
    expect(URL_JOURNEES_SITE).toMatch(/^https:\/\/[a-z0-9.-]+\/[a-z-]+$/);
    expect(URL_JOURNEES_SITE).toContain('oxvehicle.fr');
  });
});

describe('la charge utile du QR — identique au flux v1', () => {
  /**
   * Le scan d'accueil (régie) attend EXACTEMENT ce préfixe. Le changer casse
   * le pointage au portail sans qu'aucun test d'écran ne s'en aperçoive : le
   * QR s'afficherait, joliment, et ne serait pas reconnu.
   */
  it('le préfixe et l’identifiant, rien d’autre', () => {
    expect(qrCheckinPayload('abc-123')).toBe('oxv:checkin:abc-123');
  });

  it('aucun identifiant fabriqué pour une chaîne vide', () => {
    // On rend une charge utile visiblement incomplète plutôt qu'un faux code
    // qui aurait l'air valable au portail.
    expect(qrCheckinPayload('')).toBe('oxv:checkin:');
  });
});
