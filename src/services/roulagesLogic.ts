/**
 * Logique métier pure des roulages coach (§8 OXV Mirror).
 *
 * Aucune dépendance Supabase / React Native ici : ce module est
 * unitairement testable (Jest). Le service `roulagesService.ts` y branche
 * les accès base de données.
 *
 * Voir migration 20260526190000_0034_coach_roulages.sql.
 */

export type RoulageStatus = 'open' | 'cancelled' | 'done';
export type InvitationStatus = 'invited' | 'accepted' | 'declined';

/** Roulage organisé par un coach (modèle domaine, camelCase). */
export interface Roulage {
  id: string;
  coachId: string;
  title: string;
  circuitName: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  maxPilots: number | null;
  /** Prix par place en centimes d'euro. null = non tarifé. */
  pricePerPilot: number | null;
  notes: string | null;
  status: RoulageStatus;
  createdAt: string;
  updatedAt: string;
}

/** Invitation d'un pilote à un roulage. */
export interface RoulageInvitation {
  id: string;
  roulageId: string;
  pilotId: string;
  status: InvitationStatus;
  invitedAt: string;
  respondedAt: string | null;
}

/** Données de création / mise à jour d'un roulage (saisie coach). */
export interface RoulageInput {
  title: string;
  circuitName?: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  maxPilots?: number | null;
  /** Prix par place en centimes d'euro. null/absent = non tarifé. */
  pricePerPilot?: number | null;
  notes?: string | null;
}

/** Libellés FR sobres des statuts de roulage (doctrine OXV). */
export const ROULAGE_STATUS_LABELS: Record<RoulageStatus, string> = {
  open: 'Ouvert',
  cancelled: 'Annulé',
  done: 'Passé',
};

/** Libellés FR sobres des statuts d'invitation. */
export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  invited: 'En attente',
  accepted: 'Présent',
  declined: 'Absent',
};

/**
 * Valide la saisie d'un roulage. Retourne un message d'erreur FR (sobre,
 * vouvoiement) ou `null` si tout est valide.
 *
 * @param input  la saisie coach
 * @param nowISO l'instant de référence (injecté pour testabilité)
 */
export function validateRoulageInput(input: RoulageInput, nowISO: string): string | null {
  const title = (input.title ?? '').trim();
  if (title.length === 0) return 'Indiquez un titre pour le roulage.';
  if (title.length > 120) return 'Le titre est trop long (120 caractères maximum).';

  const start = Date.parse(input.startsAt);
  if (Number.isNaN(start)) return 'La date de début est invalide.';

  const now = Date.parse(nowISO);
  if (!Number.isNaN(now) && start < now) return 'La date de début est déjà passée.';

  if (input.endsAt != null && input.endsAt !== '') {
    const end = Date.parse(input.endsAt);
    if (Number.isNaN(end)) return 'La date de fin est invalide.';
    if (end < start) return 'La date de fin précède la date de début.';
  }

  if (input.maxPilots != null) {
    if (!Number.isInteger(input.maxPilots) || input.maxPilots <= 0) {
      return 'Le nombre de places doit être un entier positif.';
    }
  }

  if (input.pricePerPilot != null) {
    if (!Number.isInteger(input.pricePerPilot) || input.pricePerPilot < 0) {
      return 'Le prix par place doit être un montant positif.';
    }
  }

  return null;
}

/**
 * Sépare une liste de roulages en « à venir » et « passés », selon nowISO.
 * Un roulage annulé reste classé selon sa date. « À venir » trié au plus
 * tôt d'abord ; « passés » au plus récent d'abord.
 */
export function splitRoulagesByTime(
  roulages: Roulage[],
  nowISO: string
): { upcoming: Roulage[]; past: Roulage[] } {
  const now = Date.parse(nowISO);
  const upcoming: Roulage[] = [];
  const past: Roulage[] = [];

  for (const r of roulages) {
    const ref = Date.parse(r.endsAt ?? r.startsAt);
    if (!Number.isNaN(ref) && ref < now) past.push(r);
    else upcoming.push(r);
  }

  upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  past.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return { upcoming, past };
}

/** Résumé des réponses aux invitations d'un roulage. */
export interface InvitationSummary {
  total: number;
  invited: number;
  accepted: number;
  declined: number;
}

/** Compte les invitations par statut. */
export function summarizeInvitations(invitations: RoulageInvitation[]): InvitationSummary {
  const summary: InvitationSummary = { total: 0, invited: 0, accepted: 0, declined: 0 };
  for (const inv of invitations) {
    summary.total += 1;
    summary[inv.status] += 1;
  }
  return summary;
}

/**
 * Places restantes d'un roulage compte tenu des pilotes ayant accepté.
 * Retourne `null` si le roulage n'a pas de limite (maxPilots null).
 * Ne descend jamais sous zéro.
 */
export function remainingPlaces(roulage: Roulage, acceptedCount: number): number | null {
  if (roulage.maxPilots == null) return null;
  return Math.max(0, roulage.maxPilots - acceptedCount);
}

/**
 * Revenu d'un roulage en centimes : prix par place × pilotes ayant accepté.
 * Retourne 0 si le roulage n'est pas tarifé (pricePerPilot null) ou annulé.
 */
export function roulageRevenueCents(roulage: Roulage, acceptedCount: number): number {
  if (roulage.pricePerPilot == null || roulage.status === 'cancelled') return 0;
  return roulage.pricePerPilot * acceptedCount;
}

/** Résumé du tableau de bord business d'un coach (§10.2, sans remise). */
export interface CoachBusinessSummary {
  pilotCount: number;
  roulageCount: number;
  /** Roulages ouverts/passés non annulés. */
  activeRoulageCount: number;
  /** Revenu total cumulé en centimes (somme des revenus par roulage). */
  totalRevenueCents: number;
  /** Nombre total de présences confirmées sur l'ensemble des roulages. */
  totalAccepted: number;
}

/**
 * Calcule le résumé business d'un coach à partir de ses roulages et du
 * nombre de présences confirmées par roulage. 100 % déterministe et testable.
 *
 * @param pilotCount        nombre de pilotes suivis par le coach
 * @param roulages          roulages du coach
 * @param acceptedByRoulage map roulageId → nombre de présences confirmées
 */
export function computeCoachBusinessSummary(
  pilotCount: number,
  roulages: Roulage[],
  acceptedByRoulage: Map<string, number>
): CoachBusinessSummary {
  let totalRevenueCents = 0;
  let totalAccepted = 0;
  let activeRoulageCount = 0;

  for (const r of roulages) {
    const accepted = acceptedByRoulage.get(r.id) ?? 0;
    totalAccepted += accepted;
    if (r.status !== 'cancelled') activeRoulageCount += 1;
    totalRevenueCents += roulageRevenueCents(r, accepted);
  }

  return {
    pilotCount,
    roulageCount: roulages.length,
    activeRoulageCount,
    totalRevenueCents,
    totalAccepted,
  };
}
