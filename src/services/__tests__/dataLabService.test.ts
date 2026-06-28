/**
 * Tests de la logique pure d'agrégation Data Lab (§4.2).
 * Couches activables + état vide honnête, sans réseau.
 */

import { deriveDataLabAvailability } from '../dataLabLogic';

const layer = (a: ReturnType<typeof deriveDataLabAvailability>, key: string) =>
  a.layers.find((l) => l.key === key)!;

describe('deriveDataLabAvailability', () => {
  it('session introuvable → emptyReason dédié', () => {
    const a = deriveDataLabAvailability({
      found: false,
      frameCount: 0,
      validLapCount: 0,
      cornerCount: 0,
    });
    expect(a.emptyReason).toBe('Session introuvable.');
  });

  it('session vide (aucune matière) → message honnête, aucune couche', () => {
    const a = deriveDataLabAvailability({
      found: true,
      frameCount: 0,
      validLapCount: 0,
      cornerCount: 0,
    });
    expect(a.emptyReason).toMatch(/pas encore assez de matière/);
    expect(a.layers.every((l) => !l.available)).toBe(true);
  });

  it('frames présentes → trajectoire/vitesse/G activables, régularité non (1 tour)', () => {
    const a = deriveDataLabAvailability({
      found: true,
      frameCount: 1200,
      validLapCount: 1,
      cornerCount: 5,
    });
    expect(a.emptyReason).toBeNull();
    expect(layer(a, 'trajectory').available).toBe(true);
    expect(layer(a, 'speed').available).toBe(true);
    expect(layer(a, 'g').available).toBe(true);
    expect(layer(a, 'regularity').available).toBe(false);
  });

  it('au moins 2 tours valides → régularité activable', () => {
    const a = deriveDataLabAvailability({
      found: true,
      frameCount: 1200,
      validLapCount: 3,
      cornerCount: 5,
    });
    expect(layer(a, 'regularity').available).toBe(true);
  });

  it('pas de frames mais des virages → trajectoire activable, pas d état vide', () => {
    const a = deriveDataLabAvailability({
      found: true,
      frameCount: 0,
      validLapCount: 0,
      cornerCount: 7,
    });
    expect(layer(a, 'trajectory').available).toBe(true);
    expect(layer(a, 'speed').available).toBe(false);
    expect(a.emptyReason).toBeNull();
  });
});
