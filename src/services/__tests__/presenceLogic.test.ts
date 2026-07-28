/**
 * La présence ne se pose que depuis `pending` ou `confirmed` — lot 11.
 *
 * ---
 *
 * CE QUE CES TESTS EMPÊCHENT DE REVENIR
 *
 * `setAttendance` posait `attended_at` sans jamais regarder le statut. Un pilote
 * annulé, déclaré absent, ou dont le paiement était en attente pouvait être
 * marqué présent d'un seul geste.
 *
 * Rien ne s'y opposait : l'enum `registration_status_enum` borne `status`, pas
 * `attended_at`. Les deux colonnes pouvaient diverger librement, et
 * `attended_at` alimente les indicateurs du site, la demande d'avis J+1 et la
 * livraison des médias — une présence fausse s'y propage en silence.
 */

import { decisionPointage, LIBELLE } from '../presenceLogic';
import type { StatutInscription } from '../presenceLogic';

/** Les six valeurs de l'enum, lues en base le 28/07/2026. */
const TOUS: StatutInscription[] = [
  'pending',
  'confirmed',
  'cancelled',
  'attended',
  'no_show',
  'pending_payment',
];

describe('pointer une présence', () => {
  it('accepte une inscription en attente ou confirmée', () => {
    expect(decisionPointage('pending', false, true).autorise).toBe(true);
    expect(decisionPointage('confirmed', false, true).autorise).toBe(true);
  });

  // Le défaut d'origine, statut par statut.
  it.each(['cancelled', 'no_show', 'pending_payment', 'attended'] as const)(
    'refuse une inscription « %s »',
    (statut) => {
      expect(decisionPointage(statut, false, true).autorise).toBe(false);
    }
  );

  it('dit pourquoi, en français et au vouvoiement', () => {
    const d = decisionPointage('cancelled', false, true);
    expect(d.raison).toBe('Inscription annulée.');
  });

  // Fail-closed : un statut absent n'autorise pas, il refuse.
  it('refuse quand le statut est inconnu', () => {
    expect(decisionPointage(null, false, true).autorise).toBe(false);
  });

  it('refuse un statut hors enum', () => {
    expect(decisionPointage('refunded', false, true).autorise).toBe(false);
  });

  /**
   * « Jamais en écrasement ». Une présence déjà datée est un fait. La reposer
   * réécrirait l'heure d'arrivée sans que personne ne le voie — et c'est cette
   * heure que le site publie.
   */
  it('refuse de repointer une présence déjà enregistrée', () => {
    const d = decisionPointage('confirmed', true, true);
    expect(d.autorise).toBe(false);
    expect(d.raison).toContain('déjà enregistrée');
  });
});

describe('retirer une présence', () => {
  /**
   * TOUJOURS possible, depuis n'importe quel statut.
   *
   * Une garde qui empêche de réparer une erreur ne protège rien : elle déplace
   * la correction dans la base, à la main, sans trace.
   */
  it.each(TOUS)('reste possible depuis « %s »', (statut) => {
    expect(decisionPointage(statut, true, false).autorise).toBe(true);
    expect(decisionPointage(statut, false, false).autorise).toBe(true);
  });

  it('reste possible même sans statut lisible', () => {
    expect(decisionPointage(null, true, false).autorise).toBe(true);
  });
});

describe('libellés', () => {
  it('couvrent les six valeurs de l’enum', () => {
    for (const s of TOUS) {
      expect(typeof LIBELLE[s]).toBe('string');
      expect(LIBELLE[s].length).toBeGreaterThan(0);
    }
  });

  it('sont descriptifs, sans prescription ni emoji', () => {
    for (const s of TOUS) {
      expect(LIBELLE[s]).not.toMatch(/vous devez|il faut|veuillez/i);
      expect(LIBELLE[s]).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
