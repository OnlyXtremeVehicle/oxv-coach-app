import {
  bestLapCurve,
  pilotStatCells,
  regularityHistogram,
  type PilotStatInput,
} from '../seasonLogic';

describe('bestLapCurve', () => {
  it('écarte les entrées sans chrono et trie du plus ancien au plus récent', () => {
    const curve = bestLapCurve([
      { startedAt: '2026-05-10T10:00:00Z', bestLapMs: 85000 },
      { startedAt: '2026-05-01T10:00:00Z', bestLapMs: null },
      { startedAt: '2026-05-20T10:00:00Z', bestLapMs: 84000 },
      { startedAt: '2026-05-05T10:00:00Z', bestLapMs: 86000 },
    ]);
    expect(curve).toEqual([
      { startedAt: '2026-05-05T10:00:00Z', bestLapMs: 86000 },
      { startedAt: '2026-05-10T10:00:00Z', bestLapMs: 85000 },
      { startedAt: '2026-05-20T10:00:00Z', bestLapMs: 84000 },
    ]);
  });

  it('écarte les chronos non finis et rend [] sur une saison vide', () => {
    expect(bestLapCurve([])).toEqual([]);
    expect(bestLapCurve([{ startedAt: '2026-05-01T10:00:00Z', bestLapMs: Number.NaN }])).toEqual(
      []
    );
  });
});

describe('regularityHistogram', () => {
  it('rend des seaux vides et un pct null sans aucun tour', () => {
    const h = regularityHistogram([], 84000);
    expect(h.withinOneSecPct).toBeNull();
    expect(h.buckets.map((b) => b.count)).toEqual([0, 0, 0, 0, 0]);
    expect(h.buckets[0]).toEqual({ loSec: 0, hiSec: 0.5, count: 0 });
    expect(h.buckets[4]).toEqual({ loSec: 5, hiSec: Infinity, count: 0 });
  });

  it('classe chaque tour selon son écart au tour de référence', () => {
    // best = 80000. Écarts (s) : 0.2, 0.5, 1.0, 3.0, 9.0 → un par seau.
    const h = regularityHistogram([80200, 80500, 81000, 83000, 89000], 80000);
    expect(h.buckets.map((b) => b.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it('respecte les bornes (basse incluse, haute exclue)', () => {
    // 0.5 → seau [0.5,1) ; 1.0 → seau [1,2) ; 5.0 → seau [5,∞).
    const h = regularityHistogram([80500, 81000, 85000], 80000);
    expect(h.buckets.map((b) => b.count)).toEqual([0, 1, 1, 0, 1]);
  });

  it('ramène un tour sous la référence dans le premier seau', () => {
    const h = regularityHistogram([79500], 80000); // écart -0.5 s
    expect(h.buckets[0].count).toBe(1);
    expect(h.withinOneSecPct).toBe(100);
  });

  it('calcule la part factuelle des tours à ≤ 1 s (arrondi au dixième)', () => {
    // best = 80000. 3 tours ≤ 1 s (0.2, 0.5, 1.0) sur 4 → 75 %.
    const h = regularityHistogram([80200, 80500, 81000, 83000], 80000);
    expect(h.withinOneSecPct).toBe(75);

    // 1 tour ≤ 1 s sur 3 → 33.3 %.
    const h2 = regularityHistogram([80200, 82000, 86000], 80000);
    expect(h2.withinOneSecPct).toBe(33.3);
  });

  it('ignore les chronos non finis dans le comptage', () => {
    const h = regularityHistogram([80200, Number.NaN, Infinity], 80000);
    expect(h.buckets.map((b) => b.count)).toEqual([1, 0, 0, 0, 0]);
    expect(h.withinOneSecPct).toBe(100);
  });
});

describe('pilotStatCells', () => {
  it('formate chaque nature de valeur et rend « — » sur une absence', () => {
    const stats: PilotStatInput[] = [
      { key: 'sessions', label: 'Séances', value: 12, kind: 'count' },
      { key: 'best', label: 'Tour de référence', value: 84318, kind: 'chrono' },
      { key: 'vmax', label: 'Vitesse maxi', value: 209.6, kind: 'speed' },
      { key: 'dist', label: 'Distance', value: 12.42, kind: 'distance' },
      { key: 'reg', label: 'Régularité', value: 91.4, kind: 'pct' },
      { key: 'missing', label: 'Inconnu', value: null, kind: 'chrono' },
    ];
    expect(pilotStatCells(stats)).toEqual([
      { key: 'sessions', label: 'Séances', value: '12' },
      { key: 'best', label: 'Tour de référence', value: '1:24.318' },
      { key: 'vmax', label: 'Vitesse maxi', value: '210 km/h' },
      { key: 'dist', label: 'Distance', value: '12,4 km' },
      { key: 'reg', label: 'Régularité', value: '91 %' },
      { key: 'missing', label: 'Inconnu', value: '—' },
    ]);
  });

  it('rend [] sur une liste vide', () => {
    expect(pilotStatCells([])).toEqual([]);
  });
});
