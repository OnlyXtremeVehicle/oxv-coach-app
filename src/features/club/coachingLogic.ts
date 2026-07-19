/**
 * Logique pure du COACHING (V2-L5, écran 2/7) — sans réseau, testable seule.
 *
 * Cœur doctrinal : une fiche coach ne CLASSE personne. `coachCardMap` et
 * `reviewCitations` construisent leurs sorties par LISTE BLANCHE : aucune note
 * moyenne étoilée, aucun score, aucun vocabulaire de classement ne peut
 * traverser — même si le service marketplace expose `rating` / `average`. Les
 * avis ne sortent qu'en CITATIONS factuelles (le texte de l'avis + son auteur),
 * jamais une étoile. Les tests doctrinaux verrouillent ces deux invariants.
 *
 * Aucune I/O ici : les appels Supabase vivent dans `useCoaching`.
 */

import type { CoachListing, CoachReview } from '@/services/coachMarketplaceService';

// ---------------------------------------------------------------------------
// Onglets — Trouver · Mon coach · Demandes
// ---------------------------------------------------------------------------

export type CoachTabKey = 'trouver' | 'mon-coach' | 'demandes';

export const COACHING_TABS: readonly { key: CoachTabKey; label: string }[] = [
  { key: 'trouver', label: 'Trouver' },
  { key: 'mon-coach', label: 'Mon coach' },
  { key: 'demandes', label: 'Demandes' },
] as const;

/** Borne un index d'onglet dans [0, n-1] (swipe/tap robuste). */
export function clampTabIndex(index: number): number {
  const n = COACHING_TABS.length;
  if (!Number.isFinite(index)) return 0;
  return Math.min(n - 1, Math.max(0, Math.round(index)));
}

/** Clé d'onglet depuis un index borné. */
export function tabKeyFromIndex(index: number): CoachTabKey {
  return COACHING_TABS[clampTabIndex(index)].key;
}

/** Index d'un onglet depuis sa clé. */
export function tabIndexOf(key: CoachTabKey): number {
  const i = COACHING_TABS.findIndex((t) => t.key === key);
  return i < 0 ? 0 : i;
}

// ---------------------------------------------------------------------------
// Carte coach (découverte) — ZÉRO score (doctrine).
// ---------------------------------------------------------------------------

/**
 * Vue carte coach pour la découverte. Champs DÉLIBÉRÉMENT limités aux faits
 * descriptifs : nom, spécialités, circuits, photo, tarif indicatif. AUCUNE note,
 * AUCUN score, AUCUN classement.
 */
export interface CoachCardVM {
  coachId: string;
  name: string;
  specialties: string[];
  circuits: string[];
  /** Circuits joués, en une ligne mono (« Haute Saintonge · Le Mans »), ou null. */
  circuitsLabel: string | null;
  photoUrl: string | null;
  /** Tarif à la session, factuel et indicatif (« 120 € »), ou null si absent. */
  sessionPriceLabel: string | null;
}

/** « 120 € » — montant euros indicatif, ou null si absent (jamais fabriqué). */
export function euroLabel(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString('fr-FR')} €`;
}

/**
 * Mappe une fiche marketplace en carte d'affichage — par LISTE BLANCHE. Toute
 * clé de scoring éventuelle du service (rating/average/score) est structurellement
 * absente de la sortie.
 */
export function coachCardMap(listing: CoachListing): CoachCardVM {
  const specialties = Array.isArray(listing.specialties) ? listing.specialties : [];
  const circuits = Array.isArray(listing.circuits) ? listing.circuits : [];
  return {
    coachId: listing.coachId,
    name: listing.headline?.trim() ? listing.headline.trim() : 'Coach OXV',
    specialties,
    circuits,
    circuitsLabel: circuits.length > 0 ? circuits.slice(0, 3).join(' · ') : null,
    photoUrl: listing.photoUrl ?? null,
    sessionPriceLabel: euroLabel(listing.sessionPriceEur),
  };
}

/** Tri neutre (alphabétique sur le nom) — jamais un palmarès de personnes. */
export function sortCoachCards(cards: readonly CoachCardVM[]): CoachCardVM[] {
  return [...cards].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

// ---------------------------------------------------------------------------
// Avis en CITATIONS — jamais d'étoile, jamais de note.
// ---------------------------------------------------------------------------

/** Une citation d'avis : le TEXTE et son auteur. La note est délibérément absente. */
export interface ReviewCitationVM {
  id: string;
  quote: string;
  author: string;
}

/**
 * Transforme les avis en citations factuelles — par LISTE BLANCHE. Un avis sans
 * texte (note seule) N'EST PAS une citation : on ne le montre pas (une étoile
 * nue n'a rien à dire). L'attribut `rating` n'apparaît jamais en sortie.
 */
export function reviewCitations(reviews: readonly CoachReview[]): ReviewCitationVM[] {
  const out: ReviewCitationVM[] = [];
  for (const r of reviews) {
    const quote = r.comment?.trim();
    if (!quote) continue; // note seule, aucun propos → pas de citation
    const author = r.pilotFirstName?.trim() ? r.pilotFirstName.trim() : 'Un pilote';
    out.push({ id: r.id, quote, author });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Demandes — timeline d'états (sans étoile, texte libre à la relecture).
// ---------------------------------------------------------------------------

export type BookingTimelineStep = 'envoyee' | 'acceptee' | 'declinee' | 'passee' | 'close';

/**
 * Étape de timeline d'une demande, dérivée du statut marketplace. Sert à placer
 * un point sur une frise hairline — jamais une note.
 */
export function bookingTimelineStep(status: string): BookingTimelineStep {
  switch (status) {
    case 'pending':
      return 'envoyee';
    case 'accepted':
    case 'paid':
      return 'acceptee';
    case 'declined':
      return 'declinee';
    case 'completed':
      return 'passee';
    default:
      // cancelled / refunded / inconnu
      return 'close';
  }
}

/** Vrai si la demande est terminée (avis post-séance possible). */
export function bookingIsPast(status: string): boolean {
  return status === 'completed';
}
