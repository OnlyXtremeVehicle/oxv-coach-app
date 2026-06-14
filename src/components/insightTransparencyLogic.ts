/**
 * Logique pure de la transparence des insights (charte 11, T2) — sans React
 * Native, donc testable sous ts-jest. La présentation est dans
 * InsightTransparency.tsx.
 */

import type { DataQuality } from '@/circuit/sessionInsights';

/** Seuil de fiabilité : en-dessous, on signale au lieu de présenter comme sûr. */
export const RELIABILITY_THRESHOLD_PCT = 90;

/** Vrai si la donnée est trop fragile pour être présentée sans réserve (T2). */
export function isLowReliability(dq: DataQuality | null | undefined): boolean {
  if (!dq) return false;
  return dq.pct_valid < RELIABILITY_THRESHOLD_PCT;
}
