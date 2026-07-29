/**
 * Quels deux tours le delta compare — jalon 4, phase 4septies.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * Une règle de choix non écrite se réinvente à chaque écran, et le pilote lit
 * deux fois le même delta avec deux chiffres différents. La règle est donc
 * pure, nommée, et vérifiée ici.
 */

import { choisitPaireTours, type TourCandidat } from '../choixPaireTours';

/** Un tour chronométré ordinaire. */
function t(lapNumber: number, durationSeconds: number | null): TourCandidat {
  return { lapNumber, durationSeconds };
}

describe('la règle', () => {
  const tours = [t(1, 95), t(2, 92), t(3, 98), t(4, 93)];

  it('compare le tour choisi à votre meilleur', () => {
    const p = choisitPaireTours(tours, 3)!;
    expect(p).toEqual({ courant: 3, reference: 2, referenceEstSecond: false });
  });

  /**
   * Se comparer à soi-même donne une courbe plate à zéro : c'est vrai, et ça
   * n'apprend rien. La référence devient le DEUXIÈME meilleur, et l'écran le
   * dit — sans quoi « référence » désignerait deux choses selon les cas.
   */
  it('quand le tour choisi EST le meilleur, la référence devient le deuxième', () => {
    const p = choisitPaireTours(tours, 2)!;
    expect(p).toEqual({ courant: 2, reference: 4, referenceEstSecond: true });
  });

  it('sans sélection, montre le meilleur contre le deuxième', () => {
    expect(choisitPaireTours(tours, null)).toEqual({
      courant: 2,
      reference: 4,
      referenceEstSecond: true,
    });
  });

  it('une sélection qui n’est pas un tour retenu retombe sur la même paire', () => {
    expect(choisitPaireTours(tours, 99)).toEqual({
      courant: 2,
      reference: 4,
      referenceEstSecond: true,
    });
  });
});

describe('ce qui n’entre pas', () => {
  it('les tours de stand sont écartés', () => {
    const p = choisitPaireTours(
      [
        { lapNumber: 1, durationSeconds: 12, isOutlap: true },
        t(2, 95),
        t(3, 92),
        { lapNumber: 4, durationSeconds: 30, isInlap: true },
      ],
      null
    )!;
    expect([p.courant, p.reference].sort()).toEqual([2, 3]);
  });

  it.each([null, 0, -3, NaN])('une durée « %s » écarte le tour', (d) => {
    expect(choisitPaireTours([t(1, 90), t(2, d as number)], null)).toBeNull();
  });

  /**
   * Moins de deux tours chronométrés : on rend `null`, et l'écran dit
   * l'absence. Comparer un tour à lui-même en silence produirait une courbe
   * plate que le pilote lirait comme une mesure.
   */
  it('moins de deux tours retenus rend null', () => {
    expect(choisitPaireTours([], null)).toBeNull();
    expect(choisitPaireTours([t(1, 90)], 1)).toBeNull();
    expect(
      choisitPaireTours([t(1, 90), { lapNumber: 2, durationSeconds: 20, isOutlap: true }], 1)
    ).toBeNull();
  });
});

describe('la paire est toujours utilisable', () => {
  it('les deux tours sont toujours différents', () => {
    const tours = [t(1, 95), t(2, 92), t(3, 98)];
    for (const sel of [null, 1, 2, 3, 42]) {
      const p = choisitPaireTours(tours, sel);
      expect(p).not.toBeNull();
      expect(p!.courant).not.toBe(p!.reference);
    }
  });

  it('deux tours de durée identique restent départageables', () => {
    const p = choisitPaireTours([t(1, 90), t(2, 90)], 1)!;
    expect(p.courant).not.toBe(p.reference);
  });
});
