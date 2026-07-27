import { analyzeFrameTimes, BUDGET_60HZ_MS, detectThrottling, judgeBudget } from '../frameTimes';

/** Trace régulière de `n` images à `ms` millisecondes. */
const regulier = (n: number, ms: number): number[] => Array.from({ length: n }, () => ms);

describe('analyzeFrameTimes', () => {
  it('rend null sur une série vide — pas des zéros', () => {
    expect(analyzeFrameTimes([])).toBeNull();
    expect(analyzeFrameTimes([NaN, Infinity])).toBeNull();
  });

  it('donne des centiles justes sur une série connue', () => {
    const s = analyzeFrameTimes(Array.from({ length: 101 }, (_, i) => i))!;
    expect(s.p50).toBeCloseTo(50, 6);
    expect(s.p95).toBeCloseTo(95, 6);
    expect(s.p99).toBeCloseTo(99, 6);
    expect(s.worst).toBe(100);
  });

  it('mesure la part des images tenant le budget', () => {
    const s = analyzeFrameTimes([...regulier(90, 8), ...regulier(10, 40)])!;
    expect(s.withinBudget).toBeCloseTo(0.9, 6);
  });

  // LE point du lot, chiffré : la moyenne dit « conforme » quand l'écran saccade.
  it('LA MOYENNE MENT là où les centiles disent vrai', () => {
    // 95 % à 8 ms, 5 % à 90 ms.
    const trace = [...regulier(95, 8), ...regulier(5, 90)];
    const s = analyzeFrameTimes(trace)!;

    // La moyenne passe sous le budget…
    expect(s.mean).toBeLessThan(BUDGET_60HZ_MS);
    // …alors qu'une image sur vingt met plus de cinq budgets.
    expect(s.p99).toBeGreaterThan(BUDGET_60HZ_MS * 4);
  });
});

describe('detectThrottling — la dérive, pas le niveau', () => {
  it('rend null sous vingt images — une tendance ne se lit pas sur dix points', () => {
    expect(detectThrottling(regulier(10, 8))).toBeNull();
  });

  it('ne signale rien sur une trace stable', () => {
    const v = detectThrottling(regulier(100, 9))!;
    expect(v.detected).toBe(false);
    expect(v.ratio).toBeCloseTo(1, 3);
  });

  // La signature du throttling : bon départ, dégradation progressive.
  it('signale une seconde moitié nettement plus lente', () => {
    const v = detectThrottling([...regulier(50, 8), ...regulier(50, 20)])!;
    expect(v.detected).toBe(true);
    expect(v.p95Fin).toBeGreaterThan(v.p95Debut);
    expect(v.ratio).toBeGreaterThan(2);
  });

  // Une trace globalement LENTE mais STABLE n'est pas un throttling : c'est un
  // autre défaut, et les confondre enverrait chercher au mauvais endroit.
  it('ne confond pas « lent partout » avec une dérive', () => {
    const v = detectThrottling(regulier(100, 40))!;
    expect(v.detected).toBe(false);
  });

  it('ne rend pas un ratio infini quand le début est à zéro', () => {
    const v = detectThrottling([...regulier(50, 0), ...regulier(50, 10)])!;
    expect(Number.isFinite(v.ratio)).toBe(true);
  });
});

describe('judgeBudget — trois conditions, toutes nécessaires', () => {
  it('accepte une trace saine', () => {
    const v = judgeBudget(regulier(200, 9))!;
    expect(v.passed).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it('REFUSE une trace dont la moyenne passe mais le centile 99 décroche', () => {
    const v = judgeBudget([...regulier(95, 8), ...regulier(5, 90)])!;
    expect(v.passed).toBe(false);
    expect(v.stats.mean).toBeLessThan(BUDGET_60HZ_MS);
    expect(v.reasons.join(' ')).toMatch(/centile 99/);
  });

  it('refuse une trace qui dérive, même si chaque image tient', () => {
    // 12 puis 16 ms : tout tient le budget, mais la dérive est nette.
    const v = judgeBudget([...regulier(60, 12), ...regulier(60, 16.5)])!;
    expect(v.reasons.join(' ')).toMatch(/dérive/);
  });

  it('nomme ce qui a échoué, en clair', () => {
    const v = judgeBudget(regulier(200, 40))!;
    expect(v.passed).toBe(false);
    expect(v.reasons.length).toBeGreaterThan(0);
    for (const r of v.reasons) expect(r.length).toBeGreaterThan(10);
  });

  it('rend null sans mesure', () => {
    expect(judgeBudget([])).toBeNull();
  });
});
