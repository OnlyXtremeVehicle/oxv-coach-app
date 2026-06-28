/**
 * Tests des OXV Key Moments (T-3, PR-54).
 */

import { computeKeyMoments } from '../keyMomentsLogic';

describe('computeKeyMoments', () => {
  it('renvoie [] sans matière', () => {
    expect(computeKeyMoments({ laps: [], segments: [] })).toEqual([]);
  });

  it('tour de référence = le plus rapide (hors out/in lap)', () => {
    const m = computeKeyMoments({
      laps: [
        { lapNumber: 1, durationSeconds: 90, isOutlap: true },
        { lapNumber: 2, durationSeconds: 88.2 },
        { lapNumber: 3, durationSeconds: 87.1 },
      ],
      segments: [],
    });
    const ref = m.find((x) => x.key === 'reference');
    expect(ref?.fact).toContain('Tour 3');
    expect(ref?.fact).toContain('1:27.100');
  });

  it('passage le plus engagé = G latéral max', () => {
    const m = computeKeyMoments({
      laps: [],
      segments: [
        { segmentIndex: 1, segmentName: 'Variante', maxGLateral: 0.9 },
        { segmentIndex: 2, segmentName: 'Épingle', maxGLateral: 1.18 },
      ],
    });
    const eng = m.find((x) => x.key === 'engaged');
    expect(eng?.fact).toContain('Épingle');
    expect(eng?.fact).toContain('1.18');
  });

  it("écart net entre deux tours quand l'amplitude est notable", () => {
    const m = computeKeyMoments({
      laps: [
        { lapNumber: 1, durationSeconds: 88.0 },
        { lapNumber: 2, durationSeconds: 91.5 },
      ],
      segments: [],
    });
    const v = m.find((x) => x.key === 'variation');
    expect(v?.fact).toContain('3,5 s');
    expect(v?.fact).toContain('tours 1 et 2');
  });
});
