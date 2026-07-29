/**
 * Les virages posés sur la courbe de delta — jalon 4, phase 4septies.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * `startProgress` est une fraction entre zéro et un. Rien dans son type ne dit
 * si c'est une fraction de TEMPS ou de DISTANCE — et la confondre placerait
 * chaque virage au mauvais endroit sans que rien ne plante.
 *
 * La vérification a été faite en amont, à la source : `progress` vient de
 * `mapMatchPoint`, projection du point GPS sur l'axe du circuit. C'est bien une
 * fraction de longueur. Ces tests verrouillent la conversion qui en découle.
 */

import { reperesDepuisSegments, type SegmentSituable } from '../reperesVirages';

function seg(
  segmentIndex: number,
  kind: string | null,
  startProgress: number | null,
  segmentName: string | null = null
): SegmentSituable {
  return { segmentIndex, kind, startProgress, segmentName };
}

describe('la conversion', () => {
  it('une fraction devient des mètres sur la longueur du tour', () => {
    const r = reperesDepuisSegments([seg(0, 'turn', 0.25)], 4000);
    expect(r[0].distanceM).toBeCloseTo(1000, 6);
  });

  it('le début du tour tombe à zéro, la fin à la longueur', () => {
    const r = reperesDepuisSegments([seg(0, 'turn', 0), seg(1, 'turn', 1)], 3000);
    expect(r[0].distanceM).toBeCloseTo(0, 6);
    expect(r[1].distanceM).toBeCloseTo(3000, 6);
  });

  /** Mieux vaut une courbe sans repères qu'une courbe dont les repères mentent. */
  it.each([0, -1, NaN, Infinity])('une longueur « %s » ne rend aucun repère', (l) => {
    expect(reperesDepuisSegments([seg(0, 'turn', 0.5)], l as number)).toEqual([]);
  });

  it('les repères sortent dans l’ordre du tour', () => {
    const r = reperesDepuisSegments(
      [seg(2, 'turn', 0.8), seg(0, 'turn', 0.1), seg(1, 'turn', 0.4)],
      1000
    );
    expect(r.map((x) => x.distanceM)).toEqual([100, 400, 800]);
  });
});

describe('ce qui mérite un repère', () => {
  it('garde les virages et les chicanes', () => {
    const r = reperesDepuisSegments([seg(0, 'turn', 0.2), seg(1, 'chicane', 0.5)], 1000);
    expect(r).toHaveLength(2);
  });

  /**
   * Poser « ligne droite » sur une courbe de delta n'apprend rien, et mange la
   * place des repères qui comptent.
   */
  it('écarte les lignes droites', () => {
    expect(reperesDepuisSegments([seg(0, 'straight', 0.2)], 1000)).toEqual([]);
  });

  it('écarte un genre inconnu ou absent', () => {
    expect(reperesDepuisSegments([seg(0, null, 0.2), seg(1, 'autre', 0.5)], 1000)).toEqual([]);
  });

  it.each([null, NaN, -0.1, 1.5])('écarte une position « %s »', (p) => {
    expect(reperesDepuisSegments([seg(0, 'turn', p as number)], 1000)).toEqual([]);
  });
});

describe('les noms', () => {
  it('reprend le nom du circuit quand il existe', () => {
    const r = reperesDepuisSegments([seg(4, 'turn', 0.5, 'Épingle')], 1000);
    expect(r[0].nom).toBe('Épingle');
  });

  /** L'index est à base zéro ; le pilote compte à partir de un. */
  it('numérote à partir de un quand le circuit n’a rien nommé', () => {
    expect(reperesDepuisSegments([seg(0, 'turn', 0.1)], 1000)[0].nom).toBe('V1');
    expect(reperesDepuisSegments([seg(2, 'turn', 0.1)], 1000)[0].nom).toBe('V3');
  });

  it('un nom fait d’espaces ne compte pas comme un nom', () => {
    expect(reperesDepuisSegments([seg(0, 'turn', 0.1, '   ')], 1000)[0].nom).toBe('V1');
  });
});

describe('sans segments', () => {
  /**
   * Le découpage seuille la courbure, donc la vitesse de lacet. Sans
   * gyroscope, il n'existe pas — et la courbe se dessine sans repères.
   */
  it('aucun segment rend aucun repère, sans erreur', () => {
    expect(reperesDepuisSegments([], 4000)).toEqual([]);
  });
});
