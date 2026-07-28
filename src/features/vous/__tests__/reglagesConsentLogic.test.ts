/**
 * Tests de l'invariant biométrie côté UI (V2-L4, mission D).
 * « coachShare ⇒ capture » dans les deux sens ; confirmation à la révocation.
 */

import {
  biometrieVisible,
  nextBiometryConsents,
  requiresCaptureRevokeConfirm,
} from '../reglagesConsentLogic';

describe('nextBiometryConsents', () => {
  it('révoquer la capture coupe aussi le partage (cascade)', () => {
    expect(
      nextBiometryConsents({ capture: true, coachShare: true }, { which: 'capture', value: false })
    ).toEqual({ capture: false, coachShare: false });
  });

  it('activer la capture préserve l’état du partage', () => {
    expect(
      nextBiometryConsents({ capture: false, coachShare: false }, { which: 'capture', value: true })
    ).toEqual({ capture: true, coachShare: false });
  });

  it('activer le partage active la capture si elle manquait', () => {
    expect(
      nextBiometryConsents(
        { capture: false, coachShare: false },
        { which: 'coachShare', value: true }
      )
    ).toEqual({ capture: true, coachShare: true });
  });

  it('révoquer le partage seul conserve la capture', () => {
    expect(
      nextBiometryConsents(
        { capture: true, coachShare: true },
        { which: 'coachShare', value: false }
      )
    ).toEqual({ capture: true, coachShare: false });
  });

  it('ne mute pas l’objet source', () => {
    const current = { capture: true, coachShare: true };
    nextBiometryConsents(current, { which: 'capture', value: false });
    expect(current).toEqual({ capture: true, coachShare: true });
  });
});

describe('requiresCaptureRevokeConfirm', () => {
  it('exige une confirmation seulement pour la révocation de la capture', () => {
    expect(
      requiresCaptureRevokeConfirm(
        { capture: true, coachShare: false },
        {
          which: 'capture',
          value: false,
        }
      )
    ).toBe(true);
  });

  it('n’exige rien pour activer la capture', () => {
    expect(
      requiresCaptureRevokeConfirm(
        { capture: false, coachShare: false },
        {
          which: 'capture',
          value: true,
        }
      )
    ).toBe(false);
  });

  it('n’exige rien pour une bascule de partage', () => {
    expect(
      requiresCaptureRevokeConfirm(
        { capture: true, coachShare: true },
        {
          which: 'coachShare',
          value: false,
        }
      )
    ).toBe(false);
  });
});

describe('biometrieVisible — deux portes, une seule était gatée', () => {
  const rien = { capture: false, coachShare: false };

  /**
   * LE DÉFAUT D'ORIGINE. `equipement.tsx` gardait son bloc derrière le drapeau
   * `biometry` ; les Réglages affichaient les mêmes interrupteurs sans aucun
   * contrôle. Un pilote pouvait accorder la captation de son rythme cardiaque —
   * donnée de santé, article 9 — pendant que le drapeau déclarait la fonction
   * absente. Et l'interrupteur ne faisait rien, le chemin de capture étant gaté
   * ailleurs.
   */
  it('drapeau éteint et aucun consentement : le bloc est absent', () => {
    expect(biometrieVisible(false, rien)).toBe(false);
  });

  it('drapeau allumé : le bloc est là', () => {
    expect(biometrieVisible(true, rien)).toBe(true);
  });

  /**
   * L'ASYMÉTRIE, ET ELLE COMPTE. Masquer le bloc à un pilote qui a DÉJÀ
   * consenti l'enfermerait dans son consentement : plus aucun endroit pour le
   * retirer. Pour une donnée de santé, ce serait pire que le défaut d'origine.
   * Fermé pour accorder, ouvert pour retirer — comme le pointage de présence.
   */
  it('drapeau éteint mais capture accordée : le bloc reste, pour révoquer', () => {
    expect(biometrieVisible(false, { capture: true, coachShare: false })).toBe(true);
  });

  it('drapeau éteint mais partage accordé : le bloc reste aussi', () => {
    expect(biometrieVisible(false, { capture: false, coachShare: true })).toBe(true);
  });
});
