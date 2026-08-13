/**
 * La rampe des seaux d'écart est-elle une rampe, ou une décoration ?
 *
 * Ce test tient les trois propriétés qui font la différence :
 *
 *   1. elle EXISTE — `rampe` n'est pas nulle, donc le repli plat de
 *      `couleursDesSeaux` est une branche prouvée morte et non supposée telle ;
 *   2. elle DESCEND — la luminance décroît strictement d'un seau au suivant ;
 *      une rampe non monotone ne code plus l'ordre de l'axe ;
 *   3. elle reste LISIBLE — chaque seau tient 3:1 contre son fond, seuil des
 *      éléments graphiques porteurs de sens.
 *
 * La valeur de contraste est donc MESURÉE ici, jamais recopiée dans un
 * commentaire à côté de la teinte. C'est précisément ce qu'a coûté ce dépôt
 * ailleurs : un nombre relu au lieu d'être remesuré.
 */

import { colors } from '@/ui/v2/tokens';
import { ECART_LOINTAIN, ECART_PROCHE, couleursDesSeaux, rampe } from '../rampeEcarts';

// ---------------------------------------------------------------------------
// Outils WCAG
// ---------------------------------------------------------------------------

function canaux(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function luminance(hex: string): number {
  const [r, v, b] = canaux(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Les cinq seaux de `BUCKET_LABELS` — c'est le cas réel de l'histogramme. */
const CINQ = couleursDesSeaux(5);

describe('rampe des seaux d’écart', () => {
  it('la rampe existe — le repli plat est une branche morte', () => {
    expect(rampe).not.toBeNull();
  });

  it('les bornes sont exactement les teintes déclarées', () => {
    expect(CINQ).toHaveLength(5);
    expect(CINQ[0].toLowerCase()).toBe(ECART_PROCHE.toLowerCase());
    expect(CINQ[4].toLowerCase()).toBe(ECART_LOINTAIN.toLowerCase());
  });

  it('la luminance décroît strictement du proche au lointain', () => {
    const ls = CINQ.map(luminance);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });

  /**
   * Une rampe qui change de teinte se lit comme deux catégories. On tient donc
   * la famille violette d'un bout à l'autre : bleu au-dessus du rouge,
   * lui-même au-dessus du vert.
   */
  it('la teinte reste dans la famille violette sur toute la rampe', () => {
    for (const hex of CINQ) {
      const [r, v, b] = canaux(hex);
      expect(b).toBeGreaterThan(r);
      expect(r).toBeGreaterThan(v);
    }
  });

  it('chaque seau tient le plancher de 3:1 contre son fond', () => {
    for (const hex of CINQ) {
      expect(contraste(hex, colors.bg.card)).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * Le chroma doit VRAIMENT retomber : une rampe qui ne ferait que noircir la
   * teinte pleine se lirait comme une ombre, pas comme un éloignement.
   */
  it('le lointain est nettement moins coloré que le proche', () => {
    const etendue = (hex: string) => {
      const c = canaux(hex);
      return Math.max(...c) - Math.min(...c);
    };
    expect(etendue(ECART_LOINTAIN)).toBeLessThan(etendue(ECART_PROCHE) / 2);
  });
});

describe('couleursDesSeaux — les cas de bord', () => {
  it('aucun seau ne rend aucune couleur', () => {
    expect(couleursDesSeaux(0)).toEqual([]);
    expect(couleursDesSeaux(-3)).toEqual([]);
    expect(couleursDesSeaux(Number.NaN)).toEqual([]);
  });

  /** Un seau unique n'a pas d'ordre à coder — et `i / (n - 1)` y diviserait par zéro. */
  it('un seul seau rend la teinte pleine, sans division par zéro', () => {
    expect(couleursDesSeaux(1)).toEqual([ECART_PROCHE]);
  });

  it('deux seaux rendent les deux bornes', () => {
    const deux = couleursDesSeaux(2);
    expect(deux[0].toLowerCase()).toBe(ECART_PROCHE.toLowerCase());
    expect(deux[1].toLowerCase()).toBe(ECART_LOINTAIN.toLowerCase());
  });

  it('toutes les couleurs sont des hexadécimaux complets', () => {
    for (const hex of couleursDesSeaux(7)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
