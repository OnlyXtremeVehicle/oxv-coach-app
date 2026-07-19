/**
 * Logique pure — onglet ROULAGES de la porte CLUB (lot V2-L5, Mission B).
 *
 * Côté PILOTE : classe ses invitations de roulage en « à venir » (à répondre)
 * et « historique », et dérive le fait factuel « roulé ensemble ×{n} » par
 * coach (nombre de roulages réellement honorés). AUCUN chrono, AUCUN
 * classement : un roulage est un fait de présence partagé, jamais une
 * performance comparée (doctrine sociale L5).
 *
 * Aucune I/O ici (pas de Supabase, pas de React) : module .ts pur, testable
 * sous jest node. Le hook `useClubRoulages` y branche les lectures réelles.
 *
 * S'appuie sur les types & libellés PURS de `@/services/roulagesLogic`
 * (aucune dépendance native), jamais sur le service Supabase.
 */

import {
  INVITATION_STATUS_LABELS,
  ROULAGE_STATUS_LABELS,
  type InvitationStatus,
  type Roulage,
  type RoulageInvitation,
  type RoulageStatus,
} from '@/services/roulagesLogic';

/** Une invitation côté pilote, accompagnée du roulage concerné (paire RLS). */
export interface PilotInvitationPair {
  invitation: RoulageInvitation;
  roulage: Roulage;
}

/** Référence coach minimale (le hook mappe `MyCoachAssignment` vers ceci). */
export interface CoachRef {
  coachId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

/** Coach affichable (nom + initiales d'avatar), résolu depuis un `CoachRef`. */
export interface CoachDisplay {
  coachId: string;
  name: string;
  initials: string;
}

/** Carte de roulage prête à afficher — champs factuels, zéro chrono. */
export interface PilotRoulageCard {
  invitationId: string;
  roulageId: string;
  title: string;
  circuitName: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  maxPilots: number | null;
  /** Prix par place en centimes, ou null (non tarifé). */
  pricePerPilot: number | null;
  roulageStatus: RoulageStatus;
  invitationStatus: InvitationStatus;
  coach: CoachDisplay | null;
  /** Libellé de statut pour la puce d'historique. */
  statusLabel: string;
  /** Présence confirmée sur un roulage non annulé (puce « validée »). */
  positive: boolean;
}

/** Fait factuel « roulé ensemble ×{n} » avec un coach donné. */
export interface RolledTogether {
  coachId: string;
  name: string;
  initials: string;
  /** Nombre de roulages réellement honorés (présence confirmée). */
  count: number;
}

/** Vue complète de l'onglet Roulages. */
export interface RoulagesView {
  /** Invitations à venir, en attente de réponse (au plus tôt d'abord). */
  pending: PilotRoulageCard[];
  /** Roulages passés / répondus (au plus récent d'abord). */
  history: PilotRoulageCard[];
  /** « Roulé ensemble ×{n} » par coach (au plus fréquent d'abord). */
  rolledTogether: RolledTogether[];
}

/** Nom affichable du coach : prénom + nom réels, repli e-mail. */
export function coachDisplayName(c: CoachRef): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
}

/** Initiales d'avatar (prénom + nom réels, repli première lettre e-mail). */
export function coachInitials(c: CoachRef): string {
  const letters = [c.firstName, c.lastName]
    .map((p) => (p ?? '').trim().charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();
  return letters || c.email.trim().charAt(0).toUpperCase() || 'C';
}

function coachDisplayOf(coach: CoachRef | undefined): CoachDisplay | null {
  if (!coach) return null;
  return { coachId: coach.coachId, name: coachDisplayName(coach), initials: coachInitials(coach) };
}

/** Instant de référence du roulage (fin si connue, sinon début), en ms. */
function refTime(roulage: Roulage): number {
  return Date.parse(roulage.endsAt ?? roulage.startsAt);
}

/**
 * Une invitation est « à venir » (à répondre) si elle n'a pas encore de
 * réponse, sur un roulage ouvert, et pas déjà écoulée. Tout le reste part
 * dans l'historique.
 */
export function isPending(pair: PilotInvitationPair, nowMs: number): boolean {
  const { invitation, roulage } = pair;
  if (invitation.status !== 'invited' || roulage.status !== 'open') return false;
  const ref = refTime(roulage);
  return Number.isNaN(ref) || ref >= nowMs;
}

/** Présence réellement honorée : invitation acceptée, roulage non annulé. */
export function isAttended(pair: PilotInvitationPair): boolean {
  return pair.invitation.status === 'accepted' && pair.roulage.status !== 'cancelled';
}

/**
 * Libellé de statut d'une entrée d'historique. Priorité : roulage annulé,
 * puis réponse du pilote, sinon roulage passé sans réponse.
 */
export function historyStatusLabel(pair: PilotInvitationPair): string {
  const { invitation, roulage } = pair;
  if (roulage.status === 'cancelled') return ROULAGE_STATUS_LABELS.cancelled;
  if (invitation.status !== 'invited') return INVITATION_STATUS_LABELS[invitation.status];
  return ROULAGE_STATUS_LABELS.done;
}

function toCard(pair: PilotInvitationPair, coachesById: Map<string, CoachRef>): PilotRoulageCard {
  const { invitation, roulage } = pair;
  return {
    invitationId: invitation.id,
    roulageId: roulage.id,
    title: roulage.title,
    circuitName: roulage.circuitName,
    location: roulage.location,
    startsAt: roulage.startsAt,
    endsAt: roulage.endsAt,
    maxPilots: roulage.maxPilots,
    pricePerPilot: roulage.pricePerPilot,
    roulageStatus: roulage.status,
    invitationStatus: invitation.status,
    coach: coachDisplayOf(coachesById.get(roulage.coachId)),
    statusLabel: historyStatusLabel(pair),
    positive: isAttended(pair),
  };
}

/**
 * « Roulé ensemble ×{n} » par coach — uniquement les présences confirmées,
 * regroupées par coach RÉSOLU (un coach non résolu n'est pas attribué à
 * l'aveugle : règle données réelles). Tri décroissant sur le compte, puis
 * nom pour un ordre stable.
 */
export function rolledTogetherByCoach(
  pairs: PilotInvitationPair[],
  coachesById: Map<string, CoachRef>
): RolledTogether[] {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    if (!isAttended(pair)) continue;
    const coachId = pair.roulage.coachId;
    if (!coachesById.has(coachId)) continue;
    counts.set(coachId, (counts.get(coachId) ?? 0) + 1);
  }

  const rows: RolledTogether[] = [];
  for (const [coachId, count] of counts) {
    const coach = coachesById.get(coachId);
    if (!coach) continue;
    rows.push({ coachId, name: coachDisplayName(coach), initials: coachInitials(coach), count });
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  return rows;
}

/**
 * Construit la vue complète de l'onglet Roulages depuis les paires réelles
 * et les coachs résolus. `nowISO` est injecté pour la testabilité.
 */
export function buildRoulagesView(
  pairs: PilotInvitationPair[],
  coachesById: Map<string, CoachRef>,
  nowISO: string
): RoulagesView {
  const nowMs = Date.parse(nowISO);
  const now = Number.isNaN(nowMs) ? Date.now() : nowMs;

  const pending: PilotRoulageCard[] = [];
  const history: PilotRoulageCard[] = [];

  for (const pair of pairs) {
    (isPending(pair, now) ? pending : history).push(toCard(pair, coachesById));
  }

  pending.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  history.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

  return { pending, history, rolledTogether: rolledTogetherByCoach(pairs, coachesById) };
}
