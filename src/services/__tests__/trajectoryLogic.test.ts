import { mapFramesToTrajectory } from '@/services/trajectoryLogic';

describe('mapFramesToTrajectory (source unique trajectoire)', () => {
  it('écarte les trames sans coordonnées GPS (invariant)', () => {
    const out = mapFramesToTrajectory([
      { latitude: 45.1, longitude: 0.5, speed_kmh: 120 },
      { latitude: null, longitude: 0.5, speed_kmh: 130 },
      { latitude: 45.2, longitude: null, speed_kmh: 140 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ lat: 45.1, lon: 0.5, speed: 120 });
  });

  it('convertit en nombres et préserve une vitesse absente (null)', () => {
    const out = mapFramesToTrajectory([{ latitude: 45, longitude: 1, speed_kmh: null }]);
    expect(out[0]).toEqual({ lat: 45, lon: 1, speed: null });
  });

  it('tableau vide → tableau vide', () => {
    expect(mapFramesToTrajectory([])).toEqual([]);
  });
});
