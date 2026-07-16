/**
 * Logique pure des repères de référence coach (§10.3c-A OXV Mirror).
 *
 * Aucune dépendance Supabase / RN : module unitairement testable (Jest).
 * Voir migrations 20260526230000_0038_coach_corner_references.sql et
 * 20260716180000_corner_references_multicircuit.sql (un repère appartient
 * à UN circuit : clé coach + circuit + virage).
 */

/** Repère de référence d'un coach sur un virage d'UN circuit (modèle domaine). */
export interface CoachCornerReference {
  id: string;
  coachId: string;
  circuitId: string;
  cornerIndex: number;
  brakingPointM: number | null;
  targetSpeedKmh: number | null;
  trajectoryNote: string | null;
  updatedAt: string;
}

/** Saisie / mise à jour d'un repère (champs optionnels). */
export interface CornerReferenceInput {
  brakingPointM?: number | null;
  targetSpeedKmh?: number | null;
  trajectoryNote?: string | null;
}

/** Vrai si le repère porte au moins une information exploitable. */
export function referenceHasContent(input: CornerReferenceInput): boolean {
  if (input.brakingPointM != null) return true;
  if (input.targetSpeedKmh != null) return true;
  if (typeof input.trajectoryNote === 'string' && input.trajectoryNote.trim().length > 0) {
    return true;
  }
  return false;
}

/**
 * Valide la saisie d'un repère. Retourne un message FR sobre ou `null`.
 * On reste factuel : ce sont des repères, pas des consignes.
 */
export function validateCornerReference(input: CornerReferenceInput): string | null {
  if (
    input.brakingPointM != null &&
    (Number.isNaN(input.brakingPointM) || input.brakingPointM < 0)
  ) {
    return 'Le point de freinage doit être une distance positive (en mètres).';
  }
  if (
    input.targetSpeedKmh != null &&
    (Number.isNaN(input.targetSpeedKmh) || input.targetSpeedKmh < 0)
  ) {
    return 'La vitesse repère doit être positive (en km/h).';
  }
  if (typeof input.trajectoryNote === 'string' && input.trajectoryNote.length > 280) {
    return 'La note de trajectoire est trop longue (280 caractères maximum).';
  }
  return null;
}

/**
 * Compte les virages d'un circuit portant un repère POSÉ (au moins une
 * information exploitable). Compteur RÉEL, jamais gonflé : seuls comptent les
 * repères dont le virage figure dans la liste des virages du circuit (un
 * repère orphelin d'un ancien découpage du tracé n'entre pas dans le compte),
 * et chaque virage ne compte qu'une fois.
 */
export function countCornersWithReference(
  references: readonly (CornerReferenceInput & { cornerIndex: number })[],
  cornerIndexes: readonly number[]
): number {
  const listed = new Set(cornerIndexes);
  const placed = new Set<number>();
  for (const reference of references) {
    if (listed.has(reference.cornerIndex) && referenceHasContent(reference)) {
      placed.add(reference.cornerIndex);
    }
  }
  return placed.size;
}

/** Comparaison factuelle vitesse pilote ↔ vitesse repère du coach. */
export interface SpeedComparison {
  deltaKmh: number;
  /** 'above' = pilote plus rapide, 'below' = plus lent, 'equal' = identique. */
  direction: 'above' | 'below' | 'equal';
}

/**
 * Compare la vitesse du pilote (ex. à l'apex) à la vitesse repère du coach.
 * Retourne `null` si l'une des deux manque. Purement descriptif : on énonce
 * l'écart, on ne juge pas.
 */
export function compareSpeedToReference(
  pilotKmh: number | null | undefined,
  referenceKmh: number | null | undefined
): SpeedComparison | null {
  if (pilotKmh == null || referenceKmh == null) return null;
  const delta = Math.round((pilotKmh - referenceKmh) * 10) / 10;
  const direction = delta > 0 ? 'above' : delta < 0 ? 'below' : 'equal';
  return { deltaKmh: delta, direction };
}
