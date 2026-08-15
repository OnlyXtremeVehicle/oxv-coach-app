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
  skeletonBlocksFor,
} from '../uiLogic';

describe('msToLapLabel — millisecondes → label chrono', () => {
  it('convertit les ms en secondes et suit formatLapTimeMs (référence du repo)', () => {
    expect(msToLapLabel(84318)).toBe('1:24,318');
    expect(msToLapLabel(84318)).toBe(formatLapTimeMs(84.318));
    expect(msToLapLabel(45123)).toBe('45,123 s');
    expect(msToLapLabel(45123)).toBe(formatLapTimeMs(45.123));
  });

  it('arrondit au millième', () => {
    expect(msToLapLabel(84318.4)).toBe('1:24,318');
    expect(msToLapLabel(84318.6)).toBe('1:24,319');
  });

  it('borne les entrées invalides sur le tiret', () => {
    expect(msToLapLabel(-1)).toBe('—');
    expect(msToLapLabel(Number.NaN)).toBe('—');
    expect(msToLapLabel(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('gère zéro', () => {
    expect(msToLapLabel(0)).toBe('0,000 s');
  });
});

describe('chronoHeroFontSize — tailles s/m/l', () => {
  it('couvre les trois tailles, strictement croissantes', () => {
    expect(CHRONO_HERO_SIZES).toEqual(['s', 'm', 'l']);
    // `.map` passe l'INDEX en second argument, qui est désormais `valeur`.
    // Sans la lambda, `chronoHeroFontSize('m', 1)` — et le test ne mesurerait
    // plus ce qu'il croit.
    const [s, m, l] = CHRONO_HERO_SIZES.map((t) => chronoHeroFontSize(t));
    expect(s).toBeLessThan(m);
    expect(m).toBeLessThan(l);
  });

  /**
   * LE PLAFOND ET LE REPLI, branchés au jalon 3 après l'audit.
   *
   * `chronoHeroFontSize` rendait 56 pt sans jamais regarder la longueur du
   * chrono ni la largeur offerte. Sur iPhone SE, `1:41,203` occupe 268,8 pt
   * pour un budget réel d'environ 236 — le dernier millième passait sous
   * l'`overflow: 'hidden'` du héros, coupé sans erreur.
   */
  it('sans valeur, rend la table — compatibilité des appelants existants', () => {
    expect(chronoHeroFontSize('l')).toBe(CHRONO_HERO_FONT_SIZES.l);
  });

  it('plafonne un chrono de huit glyphes', () => {
    expect(chronoHeroFontSize('l', '1:41,203')).toBeLessThanOrEqual(56);
  });

  it('replie quand la largeur ne suffit pas', () => {
    const large = chronoHeroFontSize('l', '1:41,203', 400);
    const etroit = chronoHeroFontSize('l', '1:41,203', 236);
    expect(etroit).toBeLessThan(large);
    // Et le résultat TIENT dans le budget, réserve comprise.
    expect('1:41,203'.length * 0.6 * etroit).toBeLessThanOrEqual(236 * 0.9);
  });

  it('un chrono court n’est pas rapetissé pour rien', () => {
    expect(chronoHeroFontSize('l', '58,4', 236)).toBe(CHRONO_HERO_FONT_SIZES.l);
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

/**
 * `polylinePath` et `polylineLength` ONT ÉTÉ RETIRÉS D'ICI le 15/08/2026.
 *
 * C'étaient des doublons de `components/motion/pathMath`, avec une valeur par
 * défaut OPPOSÉE sur la fermeture (`closed = true` ici, `close = false`
 * là-bas). Deux fonctions de même nom qui ne mesurent pas la même longueur :
 * changer un import déplaçait le `strokeDasharray` d'un segment entier.
 *
 * Les tests qui vivaient ici comparaient une CHAÎNE exacte — `'M0 0 L10 0 …'`.
 * C'est le genre d'assertion qui tombe sur un espace et laisse passer une
 * coordonnée inversée. Leur remplaçant, `polylineUnique.guard.test.ts`, relit
 * le chemin produit et compare la GÉOMÉTRIE, point par point ; il fige aussi
 * la longueur du motif générique mesurée avant la consolidation.
 */

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
    // La valeur exacte est figée par `polylineUnique.guard.test.ts`, qui la
    // compare à la mesure prise AVANT la consolidation du 15/08. Ici on ne
    // vérifie que l'ordre de grandeur : une longueur estimée ou nulle
    // casserait l'animation sans casser ce fichier.
    expect(EMPTY_CIRCUIT_LENGTH).toBeGreaterThan(400);
  });

  it('boucle lente de 8 s', () => {
    expect(EMPTY_LOOP_MS).toBe(8000);
  });
});
