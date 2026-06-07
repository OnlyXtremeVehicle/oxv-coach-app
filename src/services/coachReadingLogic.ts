/**
 * Logique pure de « La lecture de votre coach » (§10.3c-D, version sûre).
 *
 * Le coach pondère les sous-composantes DÉJÀ calculées par OXV (véhicule,
 * pilote, régularité, fluidité). On en dérive une moyenne pondérée présentée
 * SÉPARÉMENT et attribuée — jamais à la place de la marge OXV.
 *
 * Aucune dépendance Supabase / RN : module unitairement testable (Jest).
 * Voir migration 20260526250000_0040_coach_reading_weights.sql.
 */

/** Pondérations du coach (modèle domaine). */
export interface CoachReadingWeights {
  coachId: string;
  wVehicle: number;
  wPilot: number;
  wRegularity: number;
  wSmoothness: number;
  note: string | null;
  updatedAt: string;
}

export interface ReadingWeightsInput {
  wVehicle: number;
  wPilot: number;
  wRegularity: number;
  wSmoothness: number;
  note?: string | null;
}

/** Sous-composantes de la marge (toutes 0..100), telles que calculées par OXV. */
export interface MarginBreakdown {
  vehicle: number;
  pilot: number;
  regularity: number;
  smoothness: number;
}

/**
 * Calcule la lecture du coach : moyenne des sous-composantes pondérée par les
 * poids du coach. Les poids sont normalisés (pas besoin de sommer à 100).
 * Retourne `null` si la somme des poids est nulle (aucune lecture possible).
 * Arrondi à l'entier. Purement dérivé, descriptif.
 */
export function computeCoachReading(
  breakdown: MarginBreakdown,
  weights: ReadingWeightsInput
): number | null {
  const w = [weights.wVehicle, weights.wPilot, weights.wRegularity, weights.wSmoothness];
  const v = [breakdown.vehicle, breakdown.pilot, breakdown.regularity, breakdown.smoothness];
  const total = w.reduce((s, x) => s + Math.max(0, x), 0);
  if (total <= 0) return null;
  const weighted = w.reduce((s, x, i) => s + Math.max(0, x) * v[i], 0);
  return Math.round(weighted / total);
}

/** Valide les pondérations. Retourne un message FR sobre ou `null`. */
export function validateReadingWeights(input: ReadingWeightsInput): string | null {
  const w = [input.wVehicle, input.wPilot, input.wRegularity, input.wSmoothness];
  if (w.some((x) => Number.isNaN(x) || x < 0)) {
    return 'Les pondérations doivent être positives ou nulles.';
  }
  if (w.reduce((s, x) => s + x, 0) <= 0) {
    return 'Au moins une pondération doit être supérieure à zéro.';
  }
  if (typeof input.note === 'string' && input.note.length > 280) {
    return 'La note est trop longue (280 caractères maximum).';
  }
  return null;
}

/** Pondérations par défaut (équipondération ≈ lecture neutre). */
export const DEFAULT_READING_WEIGHTS: ReadingWeightsInput = {
  wVehicle: 25,
  wPilot: 25,
  wRegularity: 25,
  wSmoothness: 25,
};
