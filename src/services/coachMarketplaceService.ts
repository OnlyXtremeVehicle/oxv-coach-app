/**
 * Place de marché coaching — Phases 1 & 2 (mise en relation, SANS paiement).
 *
 * Côté pilote : découvrir les coachs publiés, lire une fiche, demander une
 * séance, suivre ses demandes, annuler une demande en attente, laisser un avis
 * (Phase 2). Côté coach : lire les demandes reçues (avec le PRÉNOM du pilote,
 * Phase 2), accepter / décliner. Réf. spec :
 * docs/specs-bundle-v4/MVP_PLACE_DE_MARCHE_COACHING.md.
 *
 * Sécurité : tout passe par les RLS Supabase (0007_coaching_marketplace.sql +
 * 0008_coaching_reviews.sql, appliquées en prod) :
 *   - un pilote ne lit que les fiches/créneaux `is_published = true`, ne crée
 *     que ses propres demandes en `pending`, et ne peut mettre à jour SA
 *     demande QUE vers `cancelled` (`coaching_bookings_pilot_cancel`).
 *   - un coach ne lit/répond qu'aux demandes où `coach_id = auth.uid()`
 *     (`coaching_bookings_coach_select` / `_coach_respond`).
 *   - les avis d'un coach PUBLIÉ sont lisibles par tout authentifié
 *     (`coach_reviews_select_published`) ; un pilote n'écrit QUE son avis et
 *     seulement s'il a une séance acceptée/complétée (`coach_reviews_pilot_write`).
 * Aucune donnée pilote n'est exposée par la découverte (RGPD, spec §4). Une
 * demande `pending` n'ouvre aucun accès : l'affiliation `coach_pilots` reste le
 * seul vecteur de consentement, et n'est PAS touchée ici.
 *
 * Identité du pilote côté coach (Phase 2) : on ne lit JAMAIS la ligne `users`
 * d'un pilote. Le pilote fournit lui-même son prénom, DÉNORMALISÉ sur la demande
 * (`coaching_bookings.pilot_first_name`) et sur l'avis. Le coach affiche ce
 * prénom (repli « Pilote » s'il est absent). L'ancien embed `users` est abandonné.
 *
 * Doctrine : pas de classement de personnes, pas de tri « meilleur coach ». Tri
 * neutre (alphabétique), comme les lieux. La note d'un avis est un FAIT de cet
 * avis (jamais un palmarès de personnes) ; l'agrégat reste interne à CE coach.
 * Un statut/une note est toujours doublé d'un libellé humain. Best-effort : en
 * cas d'erreur on renvoie un résultat vide / défensif plutôt que de planter.
 */

import { supabase } from '@/lib/supabase';

/** Carte coach pour l'écran de découverte (donnée publique, fiche publiée). */
export interface CoachListing {
  coachId: string;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  circuits: string[];
  specialties: string[];
  /** Tarif indicatif de saison (euros). Affiché, jamais transactionnel. */
  seasonPriceEur: number | null;
}

/** Fiche coach détaillée (fiche publiée). */
export interface CoachProfileDetail extends CoachListing {
  palmares: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
}

/** Créneau ouvert par un coach (lecture côté pilote). */
export interface CoachAvailabilitySlot {
  id: string;
  coachId: string;
  circuitName: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  status: string;
}

/**
 * Statut d'un créneau de disponibilité (`coach_availability.status`). `open` est
 * le défaut posé en base ; `full` indique un créneau complet ; `closed` /
 * `cancelled` retirent le créneau de la découverte pilote (cf. `getCoachProfile`
 * qui ne lit que `open`/`full`).
 */
export type AvailabilityStatus = 'open' | 'full' | 'closed' | 'cancelled';

/**
 * Libellé humain d'un statut de créneau. Comme pour les demandes, le statut
 * n'est JAMAIS rendu par la couleur seule (doctrine + a11y) : on le double
 * toujours de ce texte factuel, au vouvoiement, sans emoji.
 */
export function availabilityStatusLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'open':
      return 'Ouvert';
    case 'full':
      return 'Complet';
    case 'closed':
      return 'Fermé';
    case 'cancelled':
      return 'Annulé';
    default:
      return 'Statut inconnu';
  }
}

/** Créneau du coach courant (lecture côté coach, « Mes disponibilités »). */
export interface MyAvailabilitySlot {
  id: string;
  circuitName: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  status: AvailabilityStatus;
  notes: string | null;
}

/** Entrée de création d'un créneau. `coach_id` est posé à `auth.uid()`. */
export interface CreateAvailabilityInput {
  circuitName: string;
  startsAt: string;
  endsAt?: string | null;
  capacity: number;
  notes?: string | null;
}

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'paid'
  | 'completed'
  | 'refunded';

/**
 * Libellé humain d'un statut de demande. Le statut n'est JAMAIS rendu par la
 * couleur seule (doctrine + a11y) : on le double toujours de ce texte factuel,
 * au vouvoiement, sans emoji. Phase 1 ne produit que pending/accepted/declined/
 * cancelled ; les statuts Phase 2 (paid/completed/refunded) sont couverts pour
 * rester exhaustif.
 */
export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending':
      return 'En attente de réponse';
    case 'accepted':
      return 'Acceptée';
    case 'declined':
      return 'Déclinée';
    case 'cancelled':
      return 'Annulée';
    case 'paid':
      return 'Réglée';
    case 'completed':
      return 'Terminée';
    case 'refunded':
      return 'Remboursée';
    default:
      return 'Statut inconnu';
  }
}

/** Coach résumé pour « Mes demandes » (lu via `coach_profiles`, pas `users`). */
export interface BookingCoachRef {
  headline: string | null;
}

/** Demande de séance, vue côté pilote (« Mes demandes »). */
export interface MyBooking {
  id: string;
  coachId: string;
  availabilityId: string | null;
  requestedStartsAt: string | null;
  circuitName: string | null;
  message: string | null;
  status: BookingStatus;
  createdAt: string;
  /** Fiche du coach (nom/headline) si lisible (fiche publiée), sinon `null`. */
  coach: BookingCoachRef | null;
}

/** Demande de séance, vue côté coach (« Demandes reçues »). */
export interface CoachBooking {
  id: string;
  pilotId: string;
  availabilityId: string | null;
  requestedStartsAt: string | null;
  circuitName: string | null;
  message: string | null;
  status: BookingStatus;
  createdAt: string;
  /**
   * Prénom dénormalisé du pilote, fourni par lui-même à la demande (Phase 2).
   * On n'expose jamais la ligne `users` : seul ce prénom voyage. `null` si la
   * demande est antérieure à la Phase 2 → l'écran retombe sur « Pilote ».
   */
  pilotFirstName: string | null;
}

/** Entrée d'une demande de séance. Le pilote n'envoie qu'un message + un
 *  souhait de créneau (référencé ou horaire libre). Aucun champ prix/Stripe. */
export interface RequestBookingInput {
  coachId: string;
  availabilityId?: string | null;
  requestedStartsAt?: string | null;
  circuitName?: string | null;
  message?: string | null;
  /**
   * Prénom du pilote courant (depuis `useAuthStore` → profile.first_name).
   * Dénormalisé sur la demande pour que le coach voie un prénom sans accès à la
   * ligne `users` du pilote (Phase 2, décision Gabin). Optionnel et nettoyé.
   */
  pilotFirstName?: string | null;
}

/** Borne valide d'une note d'avis (1 à 5). */
export type ReviewRating = 1 | 2 | 3 | 4 | 5;

/** Un avis laissé par un pilote sur un coach (lecture, fiche publiée). */
export interface CoachReview {
  id: string;
  rating: number;
  comment: string | null;
  /** Prénom dénormalisé du pilote (fourni par lui-même), repli « Pilote ». */
  pilotFirstName: string | null;
  createdAt: string;
}

/** Agrégat des avis d'UN coach. Jamais comparé à d'autres coachs (doctrine). */
export interface CoachReviewsSummary {
  /** Moyenne des notes (1 décimale), `null` si aucun avis. */
  average: number | null;
  /** Nombre d'avis. */
  count: number;
}

/** L'avis du pilote courant sur un coach (pour pré-remplir l'édition). */
export interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
}

/** Entrée de création / mise à jour d'un avis. `pilot_id` est posé à
 *  `auth.uid()` ; la note est bornée 1-5 ; le prénom est dénormalisé. */
export interface CreateReviewInput {
  coachId: string;
  bookingId?: string | null;
  rating: number;
  comment?: string | null;
  pilotFirstName?: string | null;
}

const COACH_PROFILE_FIELDS =
  'coach_id, headline, bio, photo_url, circuits, specialties, season_price_eur';

function toListing(row: {
  coach_id: string;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  circuits: string[] | null;
  specialties: string[] | null;
  season_price_eur: number | null;
}): CoachListing {
  return {
    coachId: row.coach_id,
    headline: row.headline ?? null,
    bio: row.bio ?? null,
    photoUrl: row.photo_url ?? null,
    circuits: Array.isArray(row.circuits) ? row.circuits : [],
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    seasonPriceEur: row.season_price_eur ?? null,
  };
}

/**
 * Liste les coachs publiés (`is_published = true`). Tri neutre : alphabétique
 * sur le headline (ou « Coach » à défaut). Aucune mise en avant hiérarchisée.
 */
export async function listPublishedCoaches(): Promise<CoachListing[]> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select(COACH_PROFILE_FIELDS)
    .eq('is_published', true);

  if (error) {
    console.warn('[OXV][marketplace] listPublishedCoaches :', error.message);
    return [];
  }

  return (data ?? []).map(toListing).sort((a, b) =>
    (a.headline ?? 'Coach').localeCompare(b.headline ?? 'Coach', 'fr', {
      sensitivity: 'base',
    })
  );
}

/**
 * Charge la fiche détaillée d'un coach publié, et ses créneaux ouverts à venir.
 * Renvoie `null` si la fiche n'existe pas ou n'est pas publiée (RLS).
 */
export async function getCoachProfile(coachId: string): Promise<{
  profile: CoachProfileDetail;
  availability: CoachAvailabilitySlot[];
} | null> {
  const [profileRes, availabilityRes] = await Promise.all([
    supabase
      .from('coach_profiles')
      .select(`${COACH_PROFILE_FIELDS}, palmares, website_url, instagram_url, youtube_url`)
      .eq('coach_id', coachId)
      .eq('is_published', true)
      .maybeSingle(),
    supabase
      .from('coach_availability')
      .select('id, coach_id, circuit_name, starts_at, ends_at, capacity, status')
      .eq('coach_id', coachId)
      .in('status', ['open', 'full'])
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true }),
  ]);

  if (profileRes.error) {
    console.warn('[OXV][marketplace] getCoachProfile :', profileRes.error.message);
    return null;
  }
  if (!profileRes.data) return null;

  const row = profileRes.data;
  const profile: CoachProfileDetail = {
    ...toListing(row),
    palmares: row.palmares ?? null,
    websiteUrl: row.website_url ?? null,
    instagramUrl: row.instagram_url ?? null,
    youtubeUrl: row.youtube_url ?? null,
  };

  if (availabilityRes.error) {
    console.warn(
      '[OXV][marketplace] getCoachProfile availability :',
      availabilityRes.error.message
    );
  }

  const availability: CoachAvailabilitySlot[] = (availabilityRes.data ?? []).map((s) => ({
    id: s.id,
    coachId: s.coach_id,
    circuitName: s.circuit_name,
    startsAt: s.starts_at,
    endsAt: s.ends_at ?? null,
    capacity: s.capacity,
    status: s.status,
  }));

  return { profile, availability };
}

/**
 * Crée une demande de séance (`pending`). Le `pilot_id` est posé à
 * `auth.uid()` ; un appel non authentifié échoue. Renvoie `{ ok: true }` ou
 * `{ ok: false, error }` (jamais d'exception remontée à l'écran).
 */
export async function requestBooking(
  input: RequestBookingInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const pilotId = auth.user?.id;
  if (!pilotId) {
    return { ok: false, error: 'Vous devez être connecté pour envoyer une demande.' };
  }

  const message = input.message?.trim() || null;
  // Prénom dénormalisé (Phase 2) : fourni par le pilote, jamais lu depuis `users`.
  const pilotFirstName = input.pilotFirstName?.trim() || null;

  const { data, error } = await supabase
    .from('coaching_bookings')
    .insert({
      pilot_id: pilotId,
      coach_id: input.coachId,
      availability_id: input.availabilityId ?? null,
      requested_starts_at: input.requestedStartsAt ?? null,
      circuit_name: input.circuitName?.trim() || null,
      message,
      pilot_first_name: pilotFirstName,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('[OXV][marketplace] requestBooking :', error?.message);
    return { ok: false, error: "La demande n'a pas pu être envoyée. Réessayez dans un instant." };
  }

  return { ok: true, id: data.id };
}

/**
 * Liste les demandes du pilote courant (les plus récentes d'abord). La RLS
 * `coaching_bookings_pilot_select` borne déjà à `pilot_id = auth.uid()`.
 *
 * Le coach est résolu via `coach_profiles` (lisible par le pilote quand la fiche
 * est publiée — policy `coach_profiles_read_published`), JAMAIS via `users`. On
 * fait deux requêtes plutôt qu'un embed PostgREST : `coaching_bookings` et
 * `coach_profiles` ne partagent pas de clé étrangère directe (toutes deux
 * pointent `users`), l'inférence d'embed n'est donc pas garantie. Le stitch en
 * mémoire est robuste et n'expose rien de plus. Si la fiche n'est pas/plus
 * publiée, `coach` retombe à `null` et l'écran affiche un libellé générique.
 */
export async function listMyBookings(): Promise<MyBooking[]> {
  const { data, error } = await supabase
    .from('coaching_bookings')
    .select(
      'id, coach_id, availability_id, requested_starts_at, circuit_name, message, status, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][marketplace] listMyBookings :', error.message);
    return [];
  }

  const rows = data ?? [];

  // Résolution des coachs : une seule requête sur les coach_id distincts. Best
  // effort — en cas d'échec on garde les demandes, coach = null.
  const coachIds = Array.from(new Set(rows.map((r) => r.coach_id)));
  const headlineById = new Map<string, string | null>();
  if (coachIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from('coach_profiles')
      .select('coach_id, headline')
      .in('coach_id', coachIds);
    if (profErr) {
      console.warn('[OXV][marketplace] listMyBookings profiles :', profErr.message);
    } else {
      for (const p of profiles ?? []) headlineById.set(p.coach_id, p.headline ?? null);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    coachId: row.coach_id,
    availabilityId: row.availability_id ?? null,
    requestedStartsAt: row.requested_starts_at ?? null,
    circuitName: row.circuit_name ?? null,
    message: row.message ?? null,
    status: row.status as BookingStatus,
    createdAt: row.created_at,
    coach: headlineById.has(row.coach_id)
      ? { headline: headlineById.get(row.coach_id) ?? null }
      : null,
  }));
}

/**
 * Liste les demandes reçues par le coach courant (les plus récentes d'abord).
 * La RLS `coaching_bookings_coach_select` borne à `coach_id = auth.uid()`.
 *
 * Identité du pilote (Phase 2) : on lit le prénom DÉNORMALISÉ porté par la
 * demande (`pilot_first_name`), que le pilote a fourni lui-même. Aucun accès à
 * la ligne `users` (l'ancien embed est abandonné — il revenait `null`). Si le
 * prénom est absent (demande antérieure à la Phase 2), l'écran affiche « Pilote »
 * et c'est le message qui porte le contexte de décision.
 */
export async function listCoachBookings(): Promise<CoachBooking[]> {
  const { data, error } = await supabase
    .from('coaching_bookings')
    .select(
      'id, pilot_id, availability_id, requested_starts_at, circuit_name, message, status, created_at, pilot_first_name'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][marketplace] listCoachBookings :', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    pilotId: row.pilot_id,
    availabilityId: row.availability_id ?? null,
    requestedStartsAt: row.requested_starts_at ?? null,
    circuitName: row.circuit_name ?? null,
    message: row.message ?? null,
    status: row.status as BookingStatus,
    createdAt: row.created_at,
    pilotFirstName: row.pilot_first_name?.trim() || null,
  }));
}

/**
 * Réponse du coach à une demande `pending` : `accepted` ou `declined`. La RLS
 * `coaching_bookings_coach_respond` vérifie `coach_id = auth.uid()`. On pose
 * aussi `responded_at = now()` (horodatage de la décision). Renvoie un résultat
 * défensif, jamais d'exception remontée à l'écran.
 */
export async function respondToBooking(
  id: string,
  status: 'accepted' | 'declined'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('coaching_bookings')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.warn('[OXV][marketplace] respondToBooking :', error.message);
    return {
      ok: false,
      error: "La réponse n'a pas pu être enregistrée. Réessayez dans un instant.",
    };
  }

  return { ok: true };
}

/**
 * Annulation par le pilote de SA demande. La RLS `coaching_bookings_pilot_cancel`
 * n'autorise QUE la transition vers `cancelled` ; on pose `cancelled_at = now()`.
 * Renvoie un résultat défensif, jamais d'exception remontée à l'écran.
 */
export async function cancelBooking(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('coaching_bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.warn('[OXV][marketplace] cancelBooking :', error.message);
    return { ok: false, error: "La demande n'a pas pu être annulée. Réessayez dans un instant." };
  }

  return { ok: true };
}

/**
 * Ouvre un créneau de disponibilité pour le coach courant. Le `coach_id` est
 * posé à `auth.uid()` (un appel non authentifié échoue). La capacité est bornée
 * à ≥ 1, le circuit et les notes sont nettoyés (trim → `null` si vide). Le
 * statut initial est `open` (défaut métier). Renvoie un résultat défensif,
 * jamais d'exception remontée à l'écran.
 */
export async function createAvailability(
  input: CreateAvailabilityInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth.user?.id;
  if (!coachId) {
    return { ok: false, error: 'Vous devez être connecté pour ouvrir un créneau.' };
  }

  const circuitName = input.circuitName.trim();
  if (!circuitName) {
    return { ok: false, error: 'Indiquez le circuit du créneau.' };
  }

  const capacity = Math.max(1, Math.floor(input.capacity));
  if (!Number.isFinite(capacity)) {
    return { ok: false, error: 'La capacité doit être un nombre valide.' };
  }

  const { data, error } = await supabase
    .from('coach_availability')
    .insert({
      coach_id: coachId,
      circuit_name: circuitName,
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      capacity,
      notes: input.notes?.trim() || null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('[OXV][marketplace] createAvailability :', error?.message);
    return {
      ok: false,
      error: "Le créneau n'a pas pu être ouvert. Réessayez dans un instant.",
    };
  }

  return { ok: true, id: data.id };
}

/**
 * Liste les créneaux du coach courant, du plus proche au plus lointain (tri
 * `starts_at` croissant). Le `coach_id = auth.uid()` est borné côté RLS ; on le
 * filtre tout de même explicitement par robustesse. Best-effort : en cas
 * d'erreur on renvoie une liste vide plutôt que de faire planter l'écran.
 */
export async function listMyAvailability(): Promise<MyAvailabilitySlot[]> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth.user?.id;
  if (!coachId) return [];

  const { data, error } = await supabase
    .from('coach_availability')
    .select('id, circuit_name, starts_at, ends_at, capacity, status, notes')
    .eq('coach_id', coachId)
    .order('starts_at', { ascending: true });

  if (error) {
    console.warn('[OXV][marketplace] listMyAvailability :', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    circuitName: row.circuit_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null,
    capacity: row.capacity,
    status: row.status as AvailabilityStatus,
    notes: row.notes ?? null,
  }));
}

/**
 * Met à jour le statut d'un créneau du coach courant (`open` → `closed` /
 * `cancelled`, etc.). La RLS borne déjà à `coach_id = auth.uid()`. Renvoie un
 * résultat défensif, jamais d'exception remontée à l'écran.
 */
export async function updateAvailabilityStatus(
  id: string,
  status: AvailabilityStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('coach_availability').update({ status }).eq('id', id);

  if (error) {
    console.warn('[OXV][marketplace] updateAvailabilityStatus :', error.message);
    return {
      ok: false,
      error: "Le créneau n'a pas pu être mis à jour. Réessayez dans un instant.",
    };
  }

  return { ok: true };
}

/** Normalise une note arbitraire en entier borné 1-5. */
function clampRating(rating: number): ReviewRating {
  const r = Math.round(rating);
  if (!Number.isFinite(r)) return 1;
  return Math.min(5, Math.max(1, r)) as ReviewRating;
}

/**
 * Dépose ou met à jour l'avis du pilote courant sur un coach (Phase 2). Un seul
 * avis par pilote par coach : on UPSERT sur la contrainte `coach_id,pilot_id`
 * (l'avis est donc éditable). Le `pilot_id` est posé à `auth.uid()` ; la RLS
 * `coach_reviews_pilot_write` vérifie en plus qu'une séance acceptée/complétée
 * existe. La note est bornée 1-5, le commentaire et le prénom sont nettoyés.
 * Renvoie un résultat défensif, jamais d'exception remontée à l'écran.
 */
export async function createReview(
  input: CreateReviewInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const pilotId = auth.user?.id;
  if (!pilotId) {
    return { ok: false, error: 'Vous devez être connecté pour laisser un avis.' };
  }

  const rating = clampRating(input.rating);
  const comment = input.comment?.trim() || null;
  const pilotFirstName = input.pilotFirstName?.trim() || null;

  const { data, error } = await supabase
    .from('coach_reviews')
    .upsert(
      {
        coach_id: input.coachId,
        pilot_id: pilotId,
        booking_id: input.bookingId ?? null,
        rating,
        comment,
        pilot_first_name: pilotFirstName,
      },
      { onConflict: 'coach_id,pilot_id' }
    )
    .select('id')
    .single();

  if (error || !data) {
    console.warn('[OXV][marketplace] createReview :', error?.message);
    return { ok: false, error: "L'avis n'a pas pu être enregistré. Réessayez dans un instant." };
  }

  return { ok: true, id: data.id };
}

/**
 * Liste les avis d'un coach publié (les plus récents d'abord) et leur agrégat
 * { moyenne, nombre }. La RLS `coach_reviews_select_published` borne la lecture
 * aux fiches publiées. La moyenne est arrondie à une décimale et ne sert qu'à
 * décrire CE coach — jamais à le classer face à d'autres (doctrine).
 * Best-effort : en cas d'erreur on renvoie une liste vide et un agrégat nul.
 */
export async function listCoachReviews(
  coachId: string
): Promise<{ reviews: CoachReview[]; summary: CoachReviewsSummary }> {
  const empty = { reviews: [], summary: { average: null, count: 0 } };

  const { data, error } = await supabase
    .from('coach_reviews')
    .select('id, rating, comment, pilot_first_name, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][marketplace] listCoachReviews :', error.message);
    return empty;
  }

  const rows = data ?? [];
  const reviews: CoachReview[] = rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment ?? null,
    pilotFirstName: row.pilot_first_name?.trim() || null,
    createdAt: row.created_at,
  }));

  const count = reviews.length;
  const average =
    count > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : null;

  return { reviews, summary: { average, count } };
}

/**
 * Renvoie l'avis existant du pilote courant sur un coach (pour pré-remplir le
 * formulaire d'édition), ou `null` s'il n'en a pas encore laissé. La RLS borne
 * déjà à `pilot_id = auth.uid()` ; on le filtre explicitement par robustesse.
 * Best-effort : en cas d'erreur on renvoie `null`.
 */
export async function getMyReviewFor(coachId: string): Promise<MyReview | null> {
  const { data: auth } = await supabase.auth.getUser();
  const pilotId = auth.user?.id;
  if (!pilotId) return null;

  const { data, error } = await supabase
    .from('coach_reviews')
    .select('id, rating, comment')
    .eq('coach_id', coachId)
    .eq('pilot_id', pilotId)
    .maybeSingle();

  if (error) {
    console.warn('[OXV][marketplace] getMyReviewFor :', error.message);
    return null;
  }
  if (!data) return null;

  return { id: data.id, rating: data.rating, comment: data.comment ?? null };
}
