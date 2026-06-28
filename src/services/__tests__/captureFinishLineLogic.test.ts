/**
 * Tests — résolution de la ligne d'arrivée pour la détection de tours.
 * Garantit que la ligne du CIRCUIT CHOISI est passée (sinon aucun tour compté),
 * et qu'une ligne non renseignée renvoie undefined (jamais une fausse ligne).
 */

import { captureFinishLineFor } from '../captureFinishLineLogic';

describe('captureFinishLineFor', () => {
  it('renvoie la ligne d’arrivée du circuit (Haute Saintonge)', () => {
    expect(
      captureFinishLineFor({
        finishLineLat: 45.2426515,
        finishLineLon: -0.0941293,
        finishLineRadiusM: 40,
      })
    ).toEqual({ lat: 45.2426515, lon: -0.0941293, radiusM: 40 });
  });

  it('renvoie la ligne d’arrivée du circuit (Charente, rayon 35)', () => {
    expect(
      captureFinishLineFor({
        finishLineLat: 45.627473,
        finishLineLon: -0.2767456,
        finishLineRadiusM: 35,
      })
    ).toEqual({ lat: 45.627473, lon: -0.2767456, radiusM: 35 });
  });

  it('renvoie undefined pour un circuit absent', () => {
    expect(captureFinishLineFor(null)).toBeUndefined();
    expect(captureFinishLineFor(undefined)).toBeUndefined();
  });

  it('renvoie undefined si la ligne n’est pas renseignée (0/0)', () => {
    expect(
      captureFinishLineFor({ finishLineLat: 0, finishLineLon: 0, finishLineRadiusM: 40 })
    ).toBeUndefined();
  });

  it('renvoie undefined si une coordonnée n’est pas finie', () => {
    expect(
      captureFinishLineFor({ finishLineLat: NaN, finishLineLon: -0.09, finishLineRadiusM: 40 })
    ).toBeUndefined();
  });

  it('retombe sur un rayon par défaut (40 m) si le rayon est nul/invalide', () => {
    expect(
      captureFinishLineFor({ finishLineLat: 45.24, finishLineLon: -0.09, finishLineRadiusM: 0 })
    ).toEqual({ lat: 45.24, lon: -0.09, radiusM: 40 });
  });
});
