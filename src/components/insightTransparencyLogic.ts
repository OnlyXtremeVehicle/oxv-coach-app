/**
 * Logique pure de la transparence des insights (charte 11, T2) — sans React
 * Native, donc testable sous ts-jest. La présentation est dans
 * InsightTransparency.tsx.
 *
 * ===========================================================================
 * ⚠ DORMANT, ET DOUBLÉ PAR UNE CHAÎNE VIVANTE. MESURÉ LE 15/08/2026.
 * ===========================================================================
 *
 * Ni ce module ni `InsightTransparency.tsx` ne sont atteignables depuis un
 * écran. Mais le signal qu'ils portent, lui, EST rendu :
 *
 *     computeDataConfidence (dataConfidenceLogic)
 *       → traceNarrativeService
 *         → useMiroirHome / useBilan
 *
 * Ce n'est donc pas un trou de transparence — c'est une SECONDE
 * implémentation, avec son propre seuil (`RELIABILITY_THRESHOLD_PCT = 90`)
 * qui n'a aucune raison de rester d'accord avec celui de la chaîne vivante.
 *
 * Deux mesures d'une même grandeur, calculées deux fois : c'est exactement ce
 * qui a produit `qdi.regularite = 34` contre `margin_breakdown.regularity = 0`
 * sur la même ligne, le 13/08. Brancher celui-ci recréerait le désaccord.
 *
 * À supprimer, ou à laisser dormir en le sachant. Pas à armer.
 */

import type { DataQuality } from '@/circuit/sessionInsights';

/** Seuil de fiabilité : en-dessous, on signale au lieu de présenter comme sûr. */
export const RELIABILITY_THRESHOLD_PCT = 90;

/** Vrai si la donnée est trop fragile pour être présentée sans réserve (T2). */
export function isLowReliability(dq: DataQuality | null | undefined): boolean {
  if (!dq) return false;
  return dq.pct_valid < RELIABILITY_THRESHOLD_PCT;
}
