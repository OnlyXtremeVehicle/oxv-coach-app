import type { DataQuality } from '@/circuit/sessionInsights';

import { RELIABILITY_THRESHOLD_PCT, isLowReliability } from '../insightTransparencyLogic';

function dq(pct: number): DataQuality {
  return {
    frames_used: 1000,
    frames_dropped: 0,
    pct_valid: pct,
    corners_detected: 7,
    laps_detected: 6,
  };
}

describe('isLowReliability (T2)', () => {
  it('signale une donnée fragile sous le seuil', () => {
    expect(isLowReliability(dq(RELIABILITY_THRESHOLD_PCT - 1))).toBe(true);
    expect(isLowReliability(dq(50))).toBe(true);
  });

  it('ne signale pas une donnée fiable au seuil ou au-dessus', () => {
    expect(isLowReliability(dq(RELIABILITY_THRESHOLD_PCT))).toBe(false);
    expect(isLowReliability(dq(100))).toBe(false);
  });

  it('ne signale rien sans data_quality', () => {
    expect(isLowReliability(null)).toBe(false);
    expect(isLowReliability(undefined)).toBe(false);
  });
});
