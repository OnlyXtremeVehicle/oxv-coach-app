/**
 * Tests pathMath — préparation pure des tracés SVG pour <DrawInPath>.
 */

import { polylineLength, polylineToPathD, type Point2D } from '../pathMath';

const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('polylineToPathD', () => {
  it('génère un M initial puis des L', () => {
    expect(polylineToPathD(SQUARE)).toBe('M 0.00 0.00 L 10.00 0.00 L 10.00 10.00 L 0.00 10.00');
  });

  it('renvoie une chaîne vide sans point', () => {
    expect(polylineToPathD([])).toBe('');
  });

  it('respecte la précision demandée', () => {
    const points = [
      { x: 1.23456, y: 2.34567 },
      { x: 3.45678, y: 4.56789 },
    ];
    expect(polylineToPathD(points, 1)).toBe('M 1.2 2.3 L 3.5 4.6');
    expect(polylineToPathD(points, 0)).toBe('M 1 2 L 3 5');
  });

  it('ferme le tracé avec Z quand close=true (circuit en boucle)', () => {
    expect(polylineToPathD(SQUARE, 0, true)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
  });
});

describe('polylineLength', () => {
  it('somme les segments euclidiens', () => {
    // Trois côtés du carré : 10 + 10 + 10.
    expect(polylineLength(SQUARE)).toBe(30);
  });

  it('inclut le segment de fermeture quand close=true', () => {
    expect(polylineLength(SQUARE, true)).toBe(40);
  });

  it('gère les diagonales (3-4-5)', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ])
    ).toBe(5);
  });

  it('vaut 0 pour moins de deux points', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
  });
});
