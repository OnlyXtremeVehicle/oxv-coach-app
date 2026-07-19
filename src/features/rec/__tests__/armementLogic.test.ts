/**
 * Tests — armementLogic (V2-L2, appui long « ARMER LA CAPTURE »).
 * Couvre la courbe de progression (durée), le seuil, et l'annulation au
 * relâchement précoce, plus le réducteur de geste.
 */

import {
  ARM_HOLD_MS,
  ARM_INITIAL,
  armOutcomeOnRelease,
  armProgress,
  armReducer,
  armRemainingMs,
  isArmComplete,
} from '@/features/rec/armementLogic';

describe('armProgress', () => {
  it('vaut 0 au tout début et 1 au seuil', () => {
    expect(armProgress(0)).toBe(0);
    expect(armProgress(ARM_HOLD_MS)).toBe(1);
  });

  it('progresse linéairement à la moitié de la durée', () => {
    expect(armProgress(ARM_HOLD_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it('est borné à 1 au-delà du seuil', () => {
    expect(armProgress(ARM_HOLD_MS * 3)).toBe(1);
  });

  it('compte les temps négatifs ou non finis comme 0', () => {
    expect(armProgress(-100)).toBe(0);
    expect(armProgress(Number.NaN)).toBe(0);
  });

  it('arme immédiatement si la durée est nulle ou négative (pas de division ratée)', () => {
    expect(armProgress(0, 0)).toBe(1);
    expect(armProgress(10, -50)).toBe(1);
  });

  it('respecte une durée personnalisée', () => {
    expect(armProgress(500, 1000)).toBeCloseTo(0.5, 5);
  });
});

describe('isArmComplete / armOutcomeOnRelease', () => {
  it('n’est pas complet avant le seuil, complet au seuil', () => {
    expect(isArmComplete(ARM_HOLD_MS - 1)).toBe(false);
    expect(isArmComplete(ARM_HOLD_MS)).toBe(true);
  });

  it('relâchement précoce = annulation, relâchement au seuil = armé', () => {
    expect(armOutcomeOnRelease(200)).toBe('cancelled');
    expect(armOutcomeOnRelease(ARM_HOLD_MS)).toBe('armed');
    expect(armOutcomeOnRelease(ARM_HOLD_MS + 120)).toBe('armed');
  });
});

describe('armRemainingMs', () => {
  it('décroît puis se borne à 0', () => {
    expect(armRemainingMs(0)).toBe(ARM_HOLD_MS);
    expect(armRemainingMs(ARM_HOLD_MS / 2)).toBe(ARM_HOLD_MS / 2);
    expect(armRemainingMs(ARM_HOLD_MS + 999)).toBe(0);
  });
});

describe('armReducer', () => {
  it('press-in entre en holding à 0', () => {
    expect(armReducer(ARM_INITIAL, { type: 'press-in' })).toEqual({
      phase: 'holding',
      progress: 0,
    });
  });

  it('tick remplit la jauge sans armer avant le seuil', () => {
    const held = armReducer(ARM_INITIAL, { type: 'press-in' });
    const ticked = armReducer(held, { type: 'tick', elapsedMs: ARM_HOLD_MS / 2 });
    expect(ticked.phase).toBe('holding');
    expect(ticked.progress).toBeCloseTo(0.5, 5);
  });

  it('tick au seuil bascule en armed à 1', () => {
    const held = armReducer(ARM_INITIAL, { type: 'press-in' });
    const armed = armReducer(held, { type: 'tick', elapsedMs: ARM_HOLD_MS });
    expect(armed).toEqual({ phase: 'armed', progress: 1 });
  });

  it('relâchement précoce annule (retour idle)', () => {
    const held = armReducer(ARM_INITIAL, { type: 'press-in' });
    const partial = armReducer(held, { type: 'tick', elapsedMs: 300 });
    const released = armReducer(partial, { type: 'release', elapsedMs: 300 });
    expect(released).toEqual(ARM_INITIAL);
  });

  it('relâchement au seuil sans tick préalable arme quand même', () => {
    const held = armReducer(ARM_INITIAL, { type: 'press-in' });
    const released = armReducer(held, { type: 'release', elapsedMs: ARM_HOLD_MS + 5 });
    expect(released.phase).toBe('armed');
  });

  it('armed est absorbant : un tick tardif ne désarme pas', () => {
    const armed = { phase: 'armed' as const, progress: 1 };
    expect(armReducer(armed, { type: 'tick', elapsedMs: 10 })).toBe(armed);
    expect(armReducer(armed, { type: 'release', elapsedMs: 10 })).toBe(armed);
  });

  it('ignore un tick hors phase holding', () => {
    expect(armReducer(ARM_INITIAL, { type: 'tick', elapsedMs: 400 })).toBe(ARM_INITIAL);
  });
});
