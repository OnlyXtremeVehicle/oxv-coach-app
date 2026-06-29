import { buildLapTimeline } from '../lapTimelineLogic';

const laps = (durations: number[]) =>
  durations.map((d, i) => ({ lapNumber: i + 1, durationSeconds: d }));

describe('buildLapTimeline', () => {
  it('sans tour, aucune barre', () => {
    const m = buildLapTimeline([]);
    expect(m.bars).toEqual([]);
    expect(m.spreadSeconds).toBeNull();
  });

  it('situe chaque tour par son écart au médian (signe + amplitude relative)', () => {
    const m = buildLapTimeline(laps([60, 62, 64])); // médiane 62
    expect(m.medianSeconds).toBe(62);
    expect(m.bars.map((b) => b.deltaToMedianSeconds)).toEqual([-2, 0, 2]);
    expect(m.bars.map((b) => b.magnitudePct)).toEqual([1, 0, 1]);
    expect(m.bars.map((b) => b.below)).toEqual([true, false, false]);
    expect(m.spreadSeconds).toBe(4);
  });

  it('marque le tour de référence (le plus rapide), une seule fois', () => {
    const m = buildLapTimeline(laps([60, 60, 64])); // deux tours à 60
    const refs = m.bars.filter((b) => b.isReference);
    expect(refs).toHaveLength(1);
    expect(refs[0].lapNumber).toBe(1);
    expect(m.bestSeconds).toBe(60);
  });

  it('tours identiques : barres plates, aucune dispersion (régularité parfaite)', () => {
    const m = buildLapTimeline(laps([62, 62, 62]));
    expect(m.bars.every((b) => b.magnitudePct === 0)).toBe(true);
    expect(m.bars.every((b) => !b.below)).toBe(true);
    expect(m.spreadSeconds).toBe(0);
  });
});
