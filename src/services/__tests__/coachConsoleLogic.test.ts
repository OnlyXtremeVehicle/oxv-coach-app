import { computeSelfTrend, latestPerPilot } from '@/services/coachConsoleLogic';

describe('computeSelfTrend (vs SA propre séance, jamais un autre pilote)', () => {
  it('hausse / baisse au-delà du seuil', () => {
    expect(computeSelfTrend(60, 55)).toBe('up');
    expect(computeSelfTrend(50, 58)).toBe('down');
  });

  it('stable sous le seuil epsilon', () => {
    expect(computeSelfTrend(60, 60.5)).toBe('flat');
    expect(computeSelfTrend(60, 59.2, 1)).toBe('flat');
  });

  it('null si une valeur manque (honnêteté)', () => {
    expect(computeSelfTrend(60, null)).toBeNull();
    expect(computeSelfTrend(null, 60)).toBeNull();
  });
});

describe('latestPerPilot', () => {
  it('regroupe par pilote en conservant l’ordre (récent d’abord)', () => {
    const rows = [
      { userId: 'a', v: 3 },
      { userId: 'b', v: 2 },
      { userId: 'a', v: 1 },
    ];
    const m = latestPerPilot(rows);
    expect(m.get('a')?.map((r) => r.v)).toEqual([3, 1]);
    expect(m.get('b')?.map((r) => r.v)).toEqual([2]);
  });
});
