/**
 * Tests staggerDelays — calcul pur des délais de cascade du <Stagger>.
 */

import { staggerDelay, staggerDelays } from '../staggerDelays';

describe('staggerDelay', () => {
  it('croît linéairement avec l’index', () => {
    expect(staggerDelay(0, { interval: 80 })).toBe(0);
    expect(staggerDelay(1, { interval: 80 })).toBe(80);
    expect(staggerDelay(5, { interval: 80 })).toBe(400);
  });

  it('ajoute initialDelay avant le premier enfant', () => {
    expect(staggerDelay(0, { interval: 80, initialDelay: 200 })).toBe(200);
    expect(staggerDelay(2, { interval: 80, initialDelay: 200 })).toBe(360);
  });

  it('plafonne au maxDelay (initialDelay compris)', () => {
    expect(staggerDelay(50, { interval: 80, maxDelay: 800 })).toBe(800);
    expect(staggerDelay(10, { interval: 100, initialDelay: 300, maxDelay: 500 })).toBe(500);
    // Sous le plafond : inchangé.
    expect(staggerDelay(3, { interval: 80, maxDelay: 800 })).toBe(240);
  });

  it('ne renvoie jamais de délai négatif', () => {
    expect(staggerDelay(-2, { interval: 80 })).toBe(0);
    expect(staggerDelay(3, { interval: -50 })).toBe(0);
    expect(staggerDelay(0, { interval: 80, initialDelay: -100 })).toBe(0);
    expect(staggerDelay(5, { interval: 80, maxDelay: -10 })).toBe(0);
  });

  it('tronque les index fractionnaires', () => {
    expect(staggerDelay(1.9, { interval: 100 })).toBe(100);
  });
});

describe('staggerDelays', () => {
  it('renvoie un délai par enfant', () => {
    expect(staggerDelays(4, { interval: 80 })).toEqual([0, 80, 160, 240]);
  });

  it('renvoie un tableau vide pour count ≤ 0', () => {
    expect(staggerDelays(0, { interval: 80 })).toEqual([]);
    expect(staggerDelays(-3, { interval: 80 })).toEqual([]);
  });

  it('applique le plafond aux derniers éléments', () => {
    expect(staggerDelays(5, { interval: 300, maxDelay: 700 })).toEqual([0, 300, 600, 700, 700]);
  });

  it('est cohérent avec staggerDelay élément par élément', () => {
    const options = { interval: 60, initialDelay: 120, maxDelay: 400 };
    const delays = staggerDelays(8, options);
    delays.forEach((delay, index) => {
      expect(delay).toBe(staggerDelay(index, options));
    });
  });
});
