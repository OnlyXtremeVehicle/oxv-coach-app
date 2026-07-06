import { rankTriageCorners, type TriageSegment } from '@/services/coachTriageLogic';

const seg = (
  i: number,
  margin: number | null,
  zone: TriageSegment['marginZone']
): TriageSegment => ({
  segmentIndex: i,
  segmentName: null,
  marginPercent: margin,
  marginZone: zone,
});

describe('rankTriageCorners (Smart Flagging factuel)', () => {
  it('classe du plus serré au moins serré et limite à N', () => {
    const out = rankTriageCorners(
      [seg(1, 40, 'green'), seg(2, 12, 'red'), seg(3, 25, 'yellow'), seg(4, 18, 'yellow')],
      3
    );
    expect(out.map((c) => c.segmentIndex)).toEqual([2, 4, 3]);
    expect(out).toHaveLength(3);
    expect(out[0].fact).toContain('la plus serrée');
    expect(out[1].fact).toContain('parmi les plus serrées');
  });

  it('ignore les segments sans marge mesurée (honnêteté)', () => {
    const out = rankTriageCorners([seg(1, null, null), seg(2, 30, 'yellow')]);
    expect(out.map((c) => c.segmentIndex)).toEqual([2]);
  });

  it('reste factuel : aucune consigne de pilotage dans le fact', () => {
    const out = rankTriageCorners([seg(2, 12, 'red')]);
    const forbidden = /freinez|acc[ée]l[ée]rez|il faut|vous devez|corrigez|tracez/i;
    expect(forbidden.test(out[0].fact)).toBe(false);
    expect(out[0].fact).toMatch(/marge 12 %/);
  });

  it('utilise le nom du segment quand présent', () => {
    const out = rankTriageCorners([
      { segmentIndex: 3, segmentName: 'Double droite', marginPercent: 10, marginZone: 'red' },
    ]);
    expect(out[0].label).toBe('Double droite');
    expect(out[0].fact).toContain('Double droite');
  });

  it('tableau vide → tableau vide', () => {
    expect(rankTriageCorners([])).toEqual([]);
  });
});
