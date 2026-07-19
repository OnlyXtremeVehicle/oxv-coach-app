/**
 * Tests — validation pure de l'alignement vidéo (offset tap-align).
 * Miroir du CHECK SQL : offset entier (négatif permis), durée entière > 0 ou nulle.
 */

import { validateOverlayOffset } from '../videoOverlayLogic';

describe('validateOverlayOffset — offset', () => {
  it('accepte un offset entier positif', () => {
    expect(validateOverlayOffset({ offsetMs: 1500 })).toEqual({ ok: true });
  });

  it('accepte un offset entier négatif (image avant franchissement)', () => {
    expect(validateOverlayOffset({ offsetMs: -320 })).toEqual({ ok: true });
  });

  it('accepte zéro', () => {
    expect(validateOverlayOffset({ offsetMs: 0 })).toEqual({ ok: true });
  });

  it('refuse un offset non entier', () => {
    const r = validateOverlayOffset({ offsetMs: 12.5 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/entier/i);
  });

  it('refuse NaN', () => {
    expect(validateOverlayOffset({ offsetMs: Number.NaN }).ok).toBe(false);
  });
});

describe('validateOverlayOffset — durée', () => {
  it('accepte une durée absente (undefined)', () => {
    expect(validateOverlayOffset({ offsetMs: 100 })).toEqual({ ok: true });
  });

  it('accepte une durée nulle (null)', () => {
    expect(validateOverlayOffset({ offsetMs: 100, durationMs: null })).toEqual({ ok: true });
  });

  it('accepte une durée entière strictement positive', () => {
    expect(validateOverlayOffset({ offsetMs: 100, durationMs: 90000 })).toEqual({ ok: true });
  });

  it('refuse une durée nulle en valeur (0)', () => {
    const r = validateOverlayOffset({ offsetMs: 100, durationMs: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/durée/i);
  });

  it('refuse une durée négative', () => {
    expect(validateOverlayOffset({ offsetMs: 100, durationMs: -5 }).ok).toBe(false);
  });

  it('refuse une durée non entière', () => {
    expect(validateOverlayOffset({ offsetMs: 100, durationMs: 42.7 }).ok).toBe(false);
  });
});
