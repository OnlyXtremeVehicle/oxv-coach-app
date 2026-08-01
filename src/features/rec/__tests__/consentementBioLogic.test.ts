/**
 * CONSENTEMENT BIOMÉTRIE — on ne demande qu'une fois.
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `un refus ne se re-sollicite pas`. Avant la colonne `biometry_asked_at`, un
 * refus et une question jamais posée valaient tous deux NULL : l'application
 * n'avait aucun moyen de les distinguer, et aurait redemandé à chaque journée au
 * pilote qui avait dit non.
 *
 * Le RGPD veut qu'un refus soit respecté, pas re-sollicité. Reposer
 * indéfiniment la même question sur une donnée de santé est une forme
 * d'insistance — exactement ce que la doctrine OXV refuse.
 *
 * ---
 *
 * CE QUE CES TESTS NE PROUVENT PAS
 *
 * Que la date est bien écrite. C'est `markBiometryAsked` qui l'écrit, à
 * l'OUVERTURE de la feuille et jamais deux fois (`.is('biometry_asked_at',
 * null)` dans le filtre). Ici on ne teste que la DÉCISION.
 */

import { doitSolliciterConsentementBio } from '@/features/rec/consentementBioLogic';

const jamaisPose = {
  flagActif: true,
  solliciteLe: null,
  consentementCaptureLe: null,
};

describe('doitSolliciterConsentementBio', () => {
  it('un refus ne se re-sollicite pas', () => {
    // Question posée le 12 juin, restée sans consentement : c'est un refus.
    // Il vaut réponse — on ne redemande jamais.
    expect(
      doitSolliciterConsentementBio({
        flagActif: true,
        solliciteLe: '2026-06-12T10:00:00.000Z',
        consentementCaptureLe: null,
      })
    ).toBe(false);
  });

  it('demande la première fois, et elle seule', () => {
    expect(doitSolliciterConsentementBio(jamaisPose)).toBe(true);
  });

  it('ne redemande pas à qui a déjà dit oui', () => {
    expect(
      doitSolliciterConsentementBio({
        flagActif: true,
        solliciteLe: '2026-06-12T10:00:00.000Z',
        consentementCaptureLe: '2026-06-12T10:00:30.000Z',
      })
    ).toBe(false);
  });

  it('un consentement donné hors flux compte comme une réponse', () => {
    // Cas réel : le pilote a activé la captation depuis ses réglages, sans être
    // passé par la feuille du jour J. La question a trouvé sa réponse ailleurs.
    expect(
      doitSolliciterConsentementBio({
        flagActif: true,
        solliciteLe: null,
        consentementCaptureLe: '2026-06-12T10:00:30.000Z',
      })
    ).toBe(false);
  });

  describe('le drapeau serveur commande tout', () => {
    it('drapeau éteint → aucune question, même à qui n’a jamais été sollicité', () => {
      // Demander un consentement pour une capacité qui n'existe pas n'a pas de
      // sens, et laisserait une trace de sollicitation injustifiée.
      expect(doitSolliciterConsentementBio({ ...jamaisPose, flagActif: false })).toBe(false);
    });

    it('un drapeau non booléen ne vaut pas actif', () => {
      const flou = { ...jamaisPose, flagActif: 'oui' } as unknown as typeof jamaisPose;
      expect(doitSolliciterConsentementBio(flou)).toBe(false);
    });
  });

  describe('fail-closed — dans le doute, on ne demande pas', () => {
    it('un état absent ne déclenche rien', () => {
      expect(doitSolliciterConsentementBio(null as unknown as typeof jamaisPose)).toBe(false);
    });

    it('des champs indéfinis valent « déjà répondu »', () => {
      // Frontière non typée : la ligne vient de la base et peut arriver
      // incomplète. Mieux vaut une question de moins qu'une de trop.
      const partiel = { flagActif: true } as unknown as typeof jamaisPose;
      expect(doitSolliciterConsentementBio(partiel)).toBe(false);
    });
  });
});
