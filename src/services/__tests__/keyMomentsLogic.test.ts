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
    expect(ref?.fact).toContain('1:27,100');
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
    expect(eng?.fact).toContain('1,18'); // virgule fr-FR (formats unifiés)
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

/**
 * LE REPLI SUR LE MAXIMUM DE LA SÉANCE.
 *
 * « Le passage le plus engagé » exigeait une ligne de `app_segment_analyses`.
 * Cette table est vide sur toute séance réelle, et le moment disparaissait —
 * alors que `telemetry_sessions.max_g_lateral` porte 0,62 g sur la séance de
 * référence depuis la capture.
 *
 * La valeur est mesurée : elle s'affiche. Le lieu ne l'est pas : le titre cesse
 * de le promettre, et le fait le dit.
 */
describe('l’appui maximum quand aucun segment n’est analysé', () => {
  const tours = [{ lapNumber: 1, durationSeconds: 100 }];

  it('rend la valeur de la séance, sans lieu', () => {
    const m = computeKeyMoments({ laps: tours, segments: [], gLateralMaxSeance: 0.62 });
    const appui = m.find((x) => x.key === 'engaged');
    expect(appui).toBeDefined();
    expect(appui!.fact).toContain('0,62 g');
    expect(appui!.title).not.toContain('passage');
    expect(appui!.fact).toContain('Position non mesurée');
  });

  it('un segment mesuré l’emporte : le lieu est alors connu', () => {
    const m = computeKeyMoments({
      laps: tours,
      segments: [{ segmentIndex: 3, segmentName: 'Épingle', maxGLateral: 0.9 }],
      gLateralMaxSeance: 0.62,
    });
    const appui = m.find((x) => x.key === 'engaged');
    expect(appui!.fact).toContain('Épingle');
    expect(appui!.title).toBe('Le passage le plus engagé');
  });

  it('sans segment ET sans maximum, aucun moment n’est fabriqué', () => {
    const m = computeKeyMoments({ laps: tours, segments: [], gLateralMaxSeance: null });
    expect(m.some((x) => x.key === 'engaged')).toBe(false);
  });

  it('un maximum nul ou absurde n’ouvre rien', () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const m = computeKeyMoments({ laps: tours, segments: [], gLateralMaxSeance: v });
      expect(m.some((x) => x.key === 'engaged')).toBe(false);
    }
  });
});
