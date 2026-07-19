/**
 * Logique pure de l'écran PASS OXV (V2-L5, mission C, écran 7/7) — porte CLUB.
 *
 * Aucune dépendance React ni react-native : testée sous ts-jest/node
 * (src/features/club/__tests__/passLogic.test.ts). Décide le partage
 * inscriptions à venir / historique, les libellés factuels, et l'éligibilité du
 * QR. La charge utile du QR est RÉUTILISÉE telle quelle du flux pass-oxv v1
 * (source unique : preparationLogic.qrCheckinPayload).
 *
 * Doctrine : faits, jamais de classement ni de chrono d'autrui. Un pass est une
 * inscription du pilote à SA journée — aucune comparaison à quiconque. Données
 * réelles câblées : une inscription sans événement lisible (RLS) n'invente rien.
 */

import { qrCheckinPayload } from '@/features/rec/preparationLogic';

// Source unique de la charge utile du QR de présence (flux pass-oxv v1).
export { qrCheckinPayload };

// ---------------------------------------------------------------------------
// Formes minimales (structurellement compatibles avec eventsService)
// ---------------------------------------------------------------------------

/** Statut d'inscription (miroir de eventsService.RegistrationStatus). */
export type PassStatus = 'registered' | 'checked_in' | 'cancelled' | 'no_show';

/** Événement rattaché — champs réellement affichés par le pass. */
export interface PassEventLike {
  name: string;
  /** Type d'événement → « offre » affichée en chip. */
  eventType: string;
  /** Lieu / circuit de la journée. */
  locationName: string;
  startsAt: string;
  endsAt: string;
}

/** Une inscription du pilote (compatible avec eventsService.MyRegistration). */
export interface PassLike {
  registrationId: string;
  status: string;
  event: PassEventLike | null;
}

// ---------------------------------------------------------------------------
// Partage à venir / historique
// ---------------------------------------------------------------------------

/** Un pass « actif » : le pilote est inscrit ou déjà présent. */
export function isActiveStatus(status: string): boolean {
  return status === 'registered' || status === 'checked_in';
}

export interface SplitPasses<T> {
  /** Journées à venir (cartes QR), triées de la plus proche à la plus lointaine. */
  upcoming: T[];
  /** Historique, trié de la plus récente à la plus ancienne. */
  history: T[];
}

/**
 * Sépare les inscriptions en « à venir » et « historique » (`now` = ms epoch) :
 *   - à venir : événement lisible, statut inscrit/présent, fin >= maintenant ;
 *   - historique : tout le reste ayant un événement (journée passée, annulée,
 *     absente) ;
 *   - une inscription SANS événement lisible (RLS) est écartée des deux — on
 *     n'affiche jamais une carte creuse.
 * Aucun chrono, aucun classement : uniquement des faits d'inscription.
 */
export function splitPasses<
  T extends { status: string; event: { startsAt: string; endsAt: string } | null },
>(regs: readonly T[], now: number): SplitPasses<T> {
  const upcoming: T[] = [];
  const history: T[] = [];
  for (const r of regs) {
    if (r.event === null) continue;
    const ends = Date.parse(r.event.endsAt);
    const active = isActiveStatus(r.status) && Number.isFinite(ends) && ends >= now;
    if (active) upcoming.push(r);
    else history.push(r);
  }
  upcoming.sort((a, b) => Date.parse(a.event!.startsAt) - Date.parse(b.event!.startsAt));
  history.sort((a, b) => Date.parse(b.event!.startsAt) - Date.parse(a.event!.startsAt));
  return { upcoming, history };
}

/** Le QR de présence ne s'affiche que pour un pass actif (inscrit/présent). */
export function canShowQr(status: string): boolean {
  return isActiveStatus(status);
}

// ---------------------------------------------------------------------------
// Libellés factuels
// ---------------------------------------------------------------------------

/**
 * Type d'événement → « offre » affichée en chip. Repris de
 * eventsService.EVENT_TYPES, redéfini ici pour garder ce module PUR
 * (eventsService importe supabase). Inconnu → renvoyé tel quel (jamais masqué).
 */
export const PASS_OFFER_LABELS: Record<string, string> = {
  session: 'Session circuit',
  balade_decouverte: 'Balade découverte',
  test_alpha: 'Test alpha',
  partenaire: 'Partenaire',
  corporate: 'Corporate',
};

export function offerLabel(eventType: string): string {
  return PASS_OFFER_LABELS[eventType] ?? eventType;
}

/** Statut d'inscription → libellé FR neutre (miroir de pass-oxv v1). */
export const PASS_STATUS_LABELS: Record<string, string> = {
  registered: 'Inscrit',
  checked_in: 'Présent',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

export function statusLabel(status: string): string {
  return PASS_STATUS_LABELS[status] ?? status;
}

// ---------------------------------------------------------------------------
// État vide — destination du CTA (fail-closed sur le drapeau paiement)
// ---------------------------------------------------------------------------

export type PassEmptyCta = 'reserve' | 'club';

/**
 * Aucune inscription → où mène le CTA ? Vers le flux de réservation SI le
 * drapeau `app_payments` est armé, sinon vers la porte Club (fail-closed :
 * jamais un bouton « Réserver » mort avant l'ouverture des paiements).
 */
export function passEmptyCta(paymentsEnabled: boolean): PassEmptyCta {
  return paymentsEnabled === true ? 'reserve' : 'club';
}
