/**
 * Pilier §3.2 — Régularité / consistance.
 *
 * Une mesure MATHÉMATIQUE de la constance : l'écart entre les tours.
 * Ce n'est pas un jugement de valeur, c'est un fait statistique. Répond
 * à « êtes-vous régulier ? » et non « êtes-vous bon ? ».
 *
 * Logique PURE (pas de Supabase) → testable unitairement.
 *
 * Doctrine : aucun "bon"/"mauvais". On qualifie la dispersion par des
 * termes neutres (resserré / régulier / dispersé) et on situe chaque
 * tour par rapport à la médiane, sans le noter.
 */

export type RegularityBand = 'resserré' | 'régulier' | 'dispersé';

export interface LapDeviation {
  lapNumber: number;
  durationSeconds: number;
  /** Écart au tour médian, en secondes (signé). */
  deltaToMedianSeconds: number;
}

export interface RegularityProfile {
  /** Nombre de tours valides exploités. */
  lapCount: number;
  /** Temps médian (référence neutre, robuste aux tours aberrants). */
  medianSeconds: number | null;
  /** Meilleur tour. */
  bestSeconds: number | null;
  /** Écart-type des temps (mesure de dispersion). */
  stdDevSeconds: number | null;
  /** Amplitude max − min. */
  spreadSeconds: number | null;
  /** Bande de régularité descriptive. */
  band: RegularityBand | null;
  /** Détail par tour (écart à la médiane). */
  laps: LapDeviation[];
  /** Phrase manifeste neutre, ou null si pas assez de tours. */
  manifest: string | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calcule le profil de régularité à partir des temps de tour valides
 * (déjà filtrés outlap/inlap par l'appelant) avec leur numéro de tour.
 */
export function computeRegularity(
  laps: { lapNumber: number; durationSeconds: number }[]
): RegularityProfile {
  const valid = laps.filter((l) => l.durationSeconds > 0);
  const times = valid.map((l) => l.durationSeconds);

  const med = median(times);
  const sd = stdDev(times);
  const best = times.length > 0 ? Math.min(...times) : null;
  const spread = times.length >= 2 ? Math.max(...times) - Math.min(...times) : null;

  let band: RegularityBand | null = null;
  if (sd !== null) {
    if (sd <= 0.5) band = 'resserré';
    else if (sd <= 1.5) band = 'régulier';
    else band = 'dispersé';
  }

  const lapsDeviation: LapDeviation[] =
    med === null
      ? []
      : valid.map((l) => ({
          lapNumber: l.lapNumber,
          durationSeconds: l.durationSeconds,
          deltaToMedianSeconds: l.durationSeconds - med,
        }));

  return {
    lapCount: valid.length,
    medianSeconds: med,
    bestSeconds: best,
    stdDevSeconds: sd,
    spreadSeconds: spread,
    band,
    laps: lapsDeviation,
    manifest: buildManifest(band, valid.length),
  };
}

function buildManifest(band: RegularityBand | null, lapCount: number): string | null {
  if (band === null || lapCount < 2) return null;
  switch (band) {
    case 'resserré':
      return 'Vos tours se ressemblent. Une main posée, séance après séance.';
    case 'régulier':
      return 'Vos tours suivent une ligne stable, avec quelques respirations.';
    case 'dispersé':
      return 'Vos tours explorent un large éventail. Chacun raconte autre chose.';
  }
}
