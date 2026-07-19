/**
 * Tests motionMath — logique pure du langage de motion V2 (lot L0).
 */

import {
  PULL_SWEEP_DEG,
  RECORD_FLASH_MS,
  STAGGER_MAX_DELAY_MS,
  clamp,
  condensedProgress,
  dampedPull,
  diffDigits,
  digitStripOffset,
  digitsOf,
  lerp,
  morphFromRects,
  needleAngle,
  pullAngle,
  recordPulsePhases,
  staggerDelayV2,
} from '../motion/motionMath';

describe('clamp / lerp', () => {
  it('borne dans [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('interpole linéairement', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(22, 12, 1)).toBe(12);
  });
});

describe('staggerDelayV2', () => {
  it('cascade au pas motion.stagger (45 ms) par défaut', () => {
    expect(staggerDelayV2(0)).toBe(0);
    expect(staggerDelayV2(1)).toBe(45);
    expect(staggerDelayV2(3)).toBe(135);
  });

  it('respecte initialDelay et le pas explicite', () => {
    expect(staggerDelayV2(2, 60, 100)).toBe(220);
  });

  it('plafonne à STAGGER_MAX_DELAY_MS par défaut', () => {
    expect(staggerDelayV2(100)).toBe(STAGGER_MAX_DELAY_MS);
  });

  it('index négatif ou fractionnaire → assaini', () => {
    expect(staggerDelayV2(-3)).toBe(0);
    expect(staggerDelayV2(2.9)).toBe(90);
  });
});

describe('digitsOf', () => {
  it('découpe un chrono en digits et séparateurs', () => {
    const cells = digitsOf('1:41.203');
    expect(cells).toHaveLength(8);
    expect(cells[0]).toEqual({ char: '1', digit: 1, accent: false });
    expect(cells[1]).toEqual({ char: ':', digit: null, accent: false });
    expect(cells[4].char).toBe('.');
    expect(cells[4].digit).toBeNull();
    expect(cells[7]).toEqual({ char: '3', digit: 3, accent: false });
  });

  it('accentMillis marque uniquement ce qui suit le dernier point', () => {
    const cells = digitsOf('1:41.203', true);
    expect(cells.map((c) => c.accent)).toEqual([
      false,
      false,
      false,
      false,
      false, // le point lui-même reste en base
      true,
      true,
      true,
    ]);
  });

  it('sans point, accentMillis ne marque rien', () => {
    const cells = digitsOf('120', true);
    expect(cells.every((c) => !c.accent)).toBe(true);
  });

  it("restreint l'accent aux chiffres : « 45.123 s » — l'espace et l'unité restent en base", () => {
    const cells = digitsOf('45.123 s', true);
    expect(cells.map((c) => c.accent)).toEqual([
      false,
      false,
      false, // le point lui-même reste en base
      true,
      true,
      true,
      false, // l'espace
      false, // l'unité « s »
    ]);
  });

  it('chaîne vide → aucune case', () => {
    expect(digitsOf('')).toEqual([]);
  });
});

describe('diffDigits', () => {
  it('valeurs identiques → rien ne change', () => {
    expect(diffDigits('1:41.203', '1:41.203')).toEqual(new Array<boolean>(8).fill(false));
  });

  it('marque seulement les cases modifiées', () => {
    expect(diffDigits('1:41.203', '1:41.207')).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('longueurs différentes → tout change', () => {
    expect(diffDigits('59.9', '1:00.0')).toEqual(new Array<boolean>(6).fill(true));
  });
});

describe('digitStripOffset', () => {
  it('translate la bande vers le digit', () => {
    expect(digitStripOffset(0, 40)).toBe(0);
    expect(digitStripOffset(3, 40)).toBe(-120);
    expect(digitStripOffset(9, 40)).toBe(-360);
  });

  it('borne le digit à [0, 9] et arrondit', () => {
    expect(digitStripOffset(12, 40)).toBe(-360);
    expect(digitStripOffset(-2, 40)).toBe(0);
    expect(digitStripOffset(3.6, 40)).toBe(-160);
  });
});

describe('needleAngle', () => {
  it('mappe linéairement [min, max] sur [angleMin, angleMax]', () => {
    expect(needleAngle(0, 0, 100)).toBe(-135);
    expect(needleAngle(50, 0, 100)).toBe(0);
    expect(needleAngle(100, 0, 100)).toBe(135);
  });

  it('borne hors plage', () => {
    expect(needleAngle(-10, 0, 100)).toBe(-135);
    expect(needleAngle(250, 0, 100)).toBe(135);
  });

  it('plage dégénérée → angleMin, jamais NaN', () => {
    expect(needleAngle(5, 10, 10)).toBe(-135);
    expect(needleAngle(5, 20, 10, -90, 90)).toBe(-90);
  });

  it('plage d angles personnalisée', () => {
    expect(needleAngle(25, 0, 100, 0, 360)).toBe(90);
  });
});

describe('pullAngle', () => {
  it('0 au repos, PULL_SWEEP_DEG au seuil', () => {
    expect(pullAngle(0, 72)).toBe(0);
    expect(pullAngle(36, 72)).toBe(PULL_SWEEP_DEG / 2);
    expect(pullAngle(72, 72)).toBe(PULL_SWEEP_DEG);
  });

  it('sur-course amortie plafonnée à +30°', () => {
    const just = pullAngle(80, 72);
    expect(just).toBeGreaterThan(PULL_SWEEP_DEG);
    expect(pullAngle(10000, 72)).toBe(PULL_SWEEP_DEG + 30);
  });

  it('monotone croissant', () => {
    let prev = -1;
    for (let d = 0; d <= 200; d += 10) {
      const a = pullAngle(d, 72);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('entrées dégénérées → 0', () => {
    expect(pullAngle(50, 0)).toBe(0);
    expect(pullAngle(-20, 72)).toBe(0);
  });
});

describe('dampedPull', () => {
  it('nul au repos, croissant, borné par 1.5 × threshold', () => {
    expect(dampedPull(0, 72)).toBe(0);
    let prev = -1;
    for (let d = 0; d <= 600; d += 30) {
      const t = dampedPull(d, 72);
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThan(72 * 1.5);
      prev = t;
    }
  });

  it('suit le doigt au départ (dérivée proche de 1)', () => {
    expect(dampedPull(5, 72)).toBeGreaterThan(4.7);
    expect(dampedPull(5, 72)).toBeLessThanOrEqual(5);
  });

  it('threshold dégénéré → 0', () => {
    expect(dampedPull(50, 0)).toBe(0);
  });
});

describe('condensedProgress', () => {
  it('0 avant la bande, 1 au seuil (condensé au-delà de 64 px)', () => {
    expect(condensedProgress(0)).toBe(0);
    expect(condensedProgress(40)).toBe(0);
    expect(condensedProgress(52)).toBe(0.5);
    expect(condensedProgress(64)).toBe(1);
    expect(condensedProgress(500)).toBe(1);
  });

  it('scroll négatif (rebond) → 0', () => {
    expect(condensedProgress(-30)).toBe(0);
  });

  it('bande nulle → pas de division par zéro', () => {
    expect(condensedProgress(64, 64, 0)).toBe(1);
    expect(condensedProgress(62, 64, 0)).toBe(0);
  });
});

describe('recordPulsePhases', () => {
  it('4 phases égales dont la somme vaut le total', () => {
    const phases = recordPulsePhases();
    expect(phases).toHaveLength(4);
    expect(phases.reduce((a, b) => a + b, 0)).toBe(RECORD_FLASH_MS);
    expect(new Set(phases).size).toBe(1);
  });

  it('total personnalisé', () => {
    expect(recordPulsePhases(600)).toEqual([150, 150, 150, 150]);
  });
});

describe('morphFromRects', () => {
  it('même rect → identité', () => {
    const r = { x: 10, y: 20, width: 100, height: 50 };
    expect(morphFromRects(r, r)).toEqual({ dx: 0, dy: 0, sx: 1, sy: 1 });
  });

  it('translate les centres et met à l échelle cible → source', () => {
    const source = { x: 0, y: 0, width: 100, height: 50 };
    const target = { x: 100, y: 200, width: 200, height: 100 };
    expect(morphFromRects(source, target)).toEqual({
      dx: 50 - 200,
      dy: 25 - 250,
      sx: 0.5,
      sy: 0.5,
    });
  });

  it('rect dégénéré → identité (fallback door, jamais de NaN)', () => {
    const ok = { x: 0, y: 0, width: 100, height: 50 };
    expect(morphFromRects({ ...ok, width: 0 }, ok)).toEqual({ dx: 0, dy: 0, sx: 1, sy: 1 });
    expect(morphFromRects(ok, { ...ok, height: 0 })).toEqual({ dx: 0, dy: 0, sx: 1, sy: 1 });
  });
});
