/**
 * Tests uiLogic — logique pure du noyau de composants V2 (Livrable 7).
 */

import { formatLapTimeMs } from '@/utils/format';

import { radius } from '../tokens';
import {
  CHRONO_HERO_FONT_SIZES,
  CHRONO_HERO_SIZES,
  EMPTY_CIRCUIT_LENGTH,
  EMPTY_CIRCUIT_PATH,
  EMPTY_CIRCUIT_POINTS,
  EMPTY_CIRCUIT_VIEWBOX,
  EMPTY_LOOP_MS,
  STATE_SHAPES,
  chronoHeroFontSize,
  msToLapLabel,
  polylineLength,
  polylinePath,
  skeletonBlocksFor,
} from '../uiLogic';

describe('msToLapLabel — millisecondes → label chrono', () => {
  it('convertit les ms en secondes et suit formatLapTimeMs (référence du repo)', () => {
    expect(msToLapLabel(84318)).toBe('1:24.318');
    expect(msToLapLabel(84318)).toBe(formatLapTimeMs(84.318));
    expect(msToLapLabel(45123)).toBe('45.123 s');
    expect(msToLapLabel(45123)).toBe(formatLapTimeMs(45.123));
  });

  it('arrondit au millième', () => {
    expect(msToLapLabel(84318.4)).toBe('1:24.318');
    expect(msToLapLabel(84318.6)).toBe('1:24.319');
  });

  it('borne les entrées invalides sur le tiret', () => {
    expect(msToLapLabel(-1)).toBe('—');
    expect(msToLapLabel(Number.NaN)).toBe('—');
    expect(msToLapLabel(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('gère zéro', () => {
    expect(msToLapLabel(0)).toBe('0.000 s');
  });
});

describe('chronoHeroFontSize — tailles s/m/l', () => {
  it('couvre les trois tailles, strictement croissantes', () => {
    expect(CHRONO_HERO_SIZES).toEqual(['s', 'm', 'l']);
    const [s, m, l] = CHRONO_HERO_SIZES.map(chronoHeroFontSize);
    expect(s).toBeLessThan(m);
    expect(m).toBeLessThan(l);
  });

  it('suit le record exporté', () => {
    for (const size of CHRONO_HERO_SIZES) {
      expect(chronoHeroFontSize(size)).toBe(CHRONO_HERO_FONT_SIZES[size]);
    }
  });
});

describe('skeletonBlocksFor — formes de squelette', () => {
  it('retourne des blocs plausibles pour chaque forme', () => {
    for (const shape of STATE_SHAPES) {
      const blocks = skeletonBlocksFor(shape);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block.height).toBeGreaterThan(0);
        expect(block.radius).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('list : plusieurs rangées pleine largeur', () => {
    const blocks = skeletonBlocksFor('list');
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) expect(block.width).toBe('100%');
  });

  it('hero : premier bloc au rayon hero', () => {
    expect(skeletonBlocksFor('hero')[0].radius).toBe(radius.hero);
  });

  it('radar : premier bloc en disque (carré, rayon = moitié)', () => {
    const [disc] = skeletonBlocksFor('radar');
    expect(disc.width).toBe(disc.height);
    expect(disc.radius).toBe(disc.height / 2);
  });
});

describe('polylinePath / polylineLength', () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ] as const;

  it('construit un chemin M/L, fermé par Z', () => {
    expect(polylinePath(square)).toBe('M0 0 L10 0 L10 10 L0 10 Z');
    expect(polylinePath(square, false)).toBe('M0 0 L10 0 L10 10 L0 10');
    expect(polylinePath([])).toBe('');
  });

  it('mesure la longueur, segment de fermeture compris', () => {
    expect(polylineLength(square)).toBeCloseTo(40);
    expect(polylineLength(square, false)).toBeCloseTo(30);
    expect(polylineLength([[3, 4]])).toBe(0);
  });
});

describe('tracé de circuit de l’état vide', () => {
  it('tient dans le viewBox', () => {
    const [minX, minY, width, height] = EMPTY_CIRCUIT_VIEWBOX.split(' ').map(Number);
    for (const [x, y] of EMPTY_CIRCUIT_POINTS) {
      expect(x).toBeGreaterThan(minX);
      expect(x).toBeLessThan(minX + width);
      expect(y).toBeGreaterThan(minY);
      expect(y).toBeLessThan(minY + height);
    }
  });

  it('forme une boucle fermée assez riche pour lire un circuit', () => {
    expect(EMPTY_CIRCUIT_POINTS.length).toBeGreaterThanOrEqual(12);
    expect(EMPTY_CIRCUIT_PATH.startsWith('M')).toBe(true);
    expect(EMPTY_CIRCUIT_PATH.endsWith('Z')).toBe(true);
  });

  it('expose la longueur réelle du tracé (pour le strokeDasharray)', () => {
    expect(EMPTY_CIRCUIT_LENGTH).toBeCloseTo(polylineLength(EMPTY_CIRCUIT_POINTS));
    expect(EMPTY_CIRCUIT_LENGTH).toBeGreaterThan(400);
  });

  it('boucle lente de 8 s', () => {
    expect(EMPTY_LOOP_MS).toBe(8000);
  });
});
