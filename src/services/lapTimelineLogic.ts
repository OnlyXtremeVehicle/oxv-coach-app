/**
 * LapTimeline (V9 §17 Data) — profil de RÉGULARITÉ d'une séance, tour par tour.
 *
 * Chaque tour est situé par son ÉCART AU TOUR MÉDIAN (réutilise computeRegularity,
 * déjà testé). La dispersion des écarts = la régularité, vue d'un coup d'œil.
 * Logique PURE → testable.
 *
 * Doctrine : un FAIT spatial, jamais un classement. « Plus rapide » n'est pas
 * « mieux » : les barres au-dessus/au-dessous de la médiane sont neutres ; seul
 * le tour de référence (le plus rapide) est marqué, comme un repère, pas un prix.
 * Fonctionne sans trames du boîtier — il sort de la table `laps` (durées).
 */

import { computeRegularity } from './regularityService';

export interface LapTimelineBar {
  lapNumber: number;
  durationSeconds: number;
  /** Écart signé au tour médian (négatif = plus court que la médiane). */
  deltaToMedianSeconds: number;
  /** Amplitude relative 0..1 (au plus grand écart absolu), pour la hauteur. */
  magnitudePct: number;
  /** Plus court que la médiane (barre vers le bas) ? */
  below: boolean;
  /** Tour de référence (le plus rapide) — un repère, pas un rang. */
  isReference: boolean;
}

export interface LapTimelineModel {
  bars: LapTimelineBar[];
  medianSeconds: number | null;
  bestSeconds: number | null;
  /** Amplitude max − min (le fait de régularité). */
  spreadSeconds: number | null;
}

export function buildLapTimeline(
  laps: { lapNumber: number; durationSeconds: number }[]
): LapTimelineModel {
  const reg = computeRegularity(laps);
  const maxAbs = reg.laps.reduce((m, l) => Math.max(m, Math.abs(l.deltaToMedianSeconds)), 0);
  const best = reg.bestSeconds;

  // Un seul tour de référence, même en cas d'égalité de chrono (le premier).
  let referenceMarked = false;
  const bars: LapTimelineBar[] = reg.laps.map((l) => {
    const isReference = !referenceMarked && best != null && l.durationSeconds === best;
    if (isReference) referenceMarked = true;
    return {
      lapNumber: l.lapNumber,
      durationSeconds: l.durationSeconds,
      deltaToMedianSeconds: l.deltaToMedianSeconds,
      magnitudePct: maxAbs > 0 ? Math.abs(l.deltaToMedianSeconds) / maxAbs : 0,
      below: l.deltaToMedianSeconds < 0,
      isReference,
    };
  });

  return {
    bars,
    medianSeconds: reg.medianSeconds,
    bestSeconds: best,
    spreadSeconds: reg.spreadSeconds,
  };
}
