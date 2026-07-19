/**
 * Logique PURE des candidatures fondateur (lot BE-1, Mission B).
 *
 * Aucun accès réseau ni Supabase ici : uniquement la validation de la motivation
 * et le libellé humain d'un statut. Ce module est le pendant testable de
 * `founderService` (l'I/O vit dans le service, la règle vit ici).
 *
 * Bornes alignées sur la contrainte SQL de `founder_applications.motivation`
 * (20..2000 caractères, sur la valeur détrimée). Ton OXV : vouvoiement, sec,
 * sans emoji.
 */

/** Statut d'une candidature fondateur (miroir de la colonne `status`). */
export type FounderApplicationStatus = 'pending' | 'approved' | 'declined';

/** Longueur minimale de la motivation, en caractères (après trim). */
export const FOUNDER_MOTIVATION_MIN = 20;
/** Longueur maximale de la motivation, en caractères (après trim). */
export const FOUNDER_MOTIVATION_MAX = 2000;

/**
 * Valide la motivation d'une candidature. La longueur est mesurée APRÈS trim,
 * comme la contrainte SQL : un texte composé d'espaces est donc refusé.
 */
export function validateMotivation(input: string): { ok: boolean; error?: string } {
  const trimmed = (input ?? '').trim();
  if (trimmed.length < FOUNDER_MOTIVATION_MIN) {
    return {
      ok: false,
      error: `Votre motivation doit compter au moins ${FOUNDER_MOTIVATION_MIN} caractères.`,
    };
  }
  if (trimmed.length > FOUNDER_MOTIVATION_MAX) {
    return {
      ok: false,
      error: `Votre motivation ne peut pas dépasser ${FOUNDER_MOTIVATION_MAX} caractères.`,
    };
  }
  return { ok: true };
}

/** Libellés vouvoyés des trois statuts, pour l'écran « Candidature fondateur ». */
const FOUNDER_STATUS_LABELS: Record<FounderApplicationStatus, string> = {
  pending: 'Votre candidature est en cours d’examen.',
  approved: 'Votre candidature a été retenue.',
  declined: 'Votre candidature n’a pas été retenue.',
};

/**
 * Rend le libellé humain d'un statut. Le `??` couvre défensivement une valeur
 * inattendue venue de la base (on retombe alors sur le libellé « en examen »).
 */
export function founderStatusLabel(status: FounderApplicationStatus): string {
  return FOUNDER_STATUS_LABELS[status] ?? FOUNDER_STATUS_LABELS.pending;
}

/** Normalise une chaîne libre en statut typé (garde-fou de lecture DB). */
export function normalizeFounderStatus(raw: string): FounderApplicationStatus {
  return raw === 'approved' || raw === 'declined' ? raw : 'pending';
}
