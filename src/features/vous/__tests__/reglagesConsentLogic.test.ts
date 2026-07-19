/**
 * Tests de l'invariant biométrie côté UI (V2-L4, mission D).
 * « coachShare ⇒ capture » dans les deux sens ; confirmation à la révocation.
 */

import { nextBiometryConsents, requiresCaptureRevokeConfirm } from '../reglagesConsentLogic';

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
