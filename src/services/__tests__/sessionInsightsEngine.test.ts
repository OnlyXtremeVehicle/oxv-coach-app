import {
  INSIGHTS_ENGINE_VERSION,
  type InsightSegmentInput,
  computeInsightsBlocks,
} from '../sessionInsightsEngine';

function seg(
  overrides: Partial<InsightSegmentInput> & { cornerIndex: number }
): InsightSegmentInput {
  return {
    apexSpeedKmh: 90,
    entrySpeedKmh: 150,
    minSpeedKmh: 85,
    exitSpeedKmh: 130,
    maxGLateral: 1.05,
    maxGBraking: 1.2,
    maxGAccel: 0.8,
    marginPercent: 70,
    ...overrides,
  };
}

describe('computeInsightsBlocks (mirror-insights-v1, 7 virages)', () => {
  it('produit une anatomie par virage triée + version moteur', () => {
    const blocks = computeInsightsBlocks({
      segments: [seg({ cornerIndex: 3 }), seg({ cornerIndex: 1 }), seg({ cornerIndex: 2 })],
      laps: [],
      frameCount: 1000,
    });
    expect(blocks.engine_version).toBe(INSIGHTS_ENGINE_VERSION);
    expect(blocks.anatomy.map((a) => a.corner_index)).toEqual([1, 2, 3]);
    expect(blocks.data_quality.corners_detected).toBe(3);
  });

  it('mappe apex et G latéral, estime des distances frein/accel positives', () => {
    const [a] = computeInsightsBlocks({
      segments: [seg({ cornerIndex: 1, apexSpeedKmh: 92.34, maxGLateral: 1.123 })],
      laps: [],
      frameCount: 10,
    }).anatomy;
    expect(a.apex_speed_kmh).toBeCloseTo(92.3, 1);
    expect(a.g_lat_apex).toBeCloseTo(1.12, 2);
    expect(a.brake_dist_m).toBeGreaterThan(0); // entrée 150 > min 85
    expect(a.accel_dist_m).toBeGreaterThan(0); // sortie 130 > min 85
  });

  it('brake_dist = 0 si pas de freinage (entrée = min) ou G nul', () => {
    const [a] = computeInsightsBlocks({
      segments: [seg({ cornerIndex: 1, entrySpeedKmh: 85, minSpeedKmh: 85, maxGBraking: 0 })],
      laps: [],
      frameCount: 10,
    }).anatomy;
    expect(a.brake_dist_m).toBe(0);
  });

  it('ideal_lap : meilleur tour réel, sans gain inventé, hors out/in lap', () => {
    const blocks = computeInsightsBlocks({
      segments: [seg({ cornerIndex: 1 })],
      laps: [
        { lapNumber: 1, durationSeconds: 60, isOutlap: true },
        { lapNumber: 2, durationSeconds: 95.8 },
        { lapNumber: 3, durationSeconds: 94.3 },
        { lapNumber: 4, durationSeconds: 50, isInlap: true },
      ],
      frameCount: 5000,
    });
    expect(blocks.ideal_lap).not.toBeNull();
    expect(blocks.ideal_lap?.real_best_s).toBeCloseTo(94.3, 3);
    expect(blocks.ideal_lap?.ideal_time_s).toBeCloseTo(94.3, 3);
    expect(blocks.ideal_lap?.gap_s).toBe(0);
    expect(blocks.ideal_lap?.best_lap).toBe(3);
    expect(blocks.n_laps).toBe(2); // out/in laps exclus
  });

  it('ideal_lap null si aucun tour valide', () => {
    expect(computeInsightsBlocks({ segments: [], laps: [], frameCount: 0 }).ideal_lap).toBeNull();
  });

  it('data_quality : pct_valid et frames_dropped depuis les trames valides', () => {
    const dq = computeInsightsBlocks({
      segments: [],
      laps: [],
      frameCount: 1000,
      validFrameCount: 980,
    }).data_quality;
    expect(dq.frames_used).toBe(1000);
    expect(dq.frames_dropped).toBe(20);
    expect(dq.pct_valid).toBe(98);
  });

  it('couches gyro/multi-tours laissées vides (honnête, non spéculatif)', () => {
    const b = computeInsightsBlocks({
      segments: [seg({ cornerIndex: 1 })],
      laps: [],
      frameCount: 1,
    });
    expect(b.dispersion).toEqual({});
    expect(b.chassis_balance).toEqual({});
    expect(b.load_transfer).toEqual({});
  });
});
