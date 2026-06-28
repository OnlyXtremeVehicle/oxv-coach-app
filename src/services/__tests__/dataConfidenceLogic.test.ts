/**
 * Tests du Data Confidence Score (T-2, PR-52).
 */

import { computeDataConfidence } from '../dataConfidenceLogic';

describe('computeDataConfidence', () => {
  it('renvoie null sans trame (état d’attente honnête)', () => {
    expect(computeDataConfidence(null)).toBeNull();
    expect(
      computeDataConfidence({ pctValid: 0, framesUsed: 0, cornersDetected: 0, lapsValid: 0 })
    ).toBeNull();
  });

  it('lecture complète quand tout est solide (sans raison)', () => {
    const c = computeDataConfidence({
      pctValid: 96,
      framesUsed: 3000,
      cornersDetected: 7,
      lapsValid: 5,
    });
    expect(c?.level).toBe('complete');
    expect(c?.label).toBe('Lecture complète');
    expect(c?.reasons).toEqual([]);
  });

  it('lecture partielle quand une dimension manque, avec raison', () => {
    const c = computeDataConfidence({
      pctValid: 75,
      framesUsed: 2000,
      cornersDetected: 7,
      lapsValid: 0,
    });
    expect(c?.level).toBe('partial');
    expect(c?.reasons.join(' ')).toContain('75%');
    expect(c?.reasons.join(' ')).toContain('aucun tour');
  });

  it('lecture limitée quand la qualité est basse', () => {
    const c = computeDataConfidence({
      pctValid: 30,
      framesUsed: 500,
      cornersDetected: 0,
      lapsValid: 0,
    });
    expect(c?.level).toBe('limited');
    expect(c?.reasons.length).toBeGreaterThan(0);
  });
});
