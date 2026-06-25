/**
 * Place de marché coaching — Phase 1 (mise en relation, SANS paiement, SANS avis).
 *
 * Côté pilote : découvrir les coachs publiés, lire une fiche, demander une
 * séance, suivre ses demandes. Réf. spec :
 * docs/specs-bundle-v4/MVP_PLACE_DE_MARCHE_COACHING.md.
 *
 * Sécurité : tout passe par les RLS Supabase (proposées dans
 * 0007_coaching_marketplace.sql) — un pilote ne lit que les fiches/créneaux
 * `is_published = true`, ne crée que ses propres demandes en `pending`. Aucune
 * donnée pilote n'est exposée par la découverte (RGPD, spec §4). Une demande
 * `pending` n'ouvre aucun accès : l'affiliation `coach_pilots` reste le seul
 * vecteur de consentement, et n'est PAS touchée ici (Phase 1).
 *
 * Doctrine : pas de classement de personnes, pas de note, pas de tri « meilleur
 * coach ». Tri neutre (premium d'abord puis alphabétique), comme les lieux.
 * Best-effort : en cas d'erreur on renvoie un résultat vide / défensif plutôt
 * que de faire planter l'écran.
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

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'paid'
  | 'completed'
  | 'refunded';

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
}

/** Entrée d'une demande de séance. Le pilote n'envoie qu'un message + un
 *  souhait de créneau (référencé ou horaire libre). Aucun champ prix/Stripe. */
export interface RequestBookingInput {
  coachId: string;
  availabilityId?: string | null;
  requestedStartsAt?: string | null;
  circuitName?: string | null;
  message?: string | null;
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

  const { data, error } = await supabase
    .from('coaching_bookings')
    .insert({
      pilot_id: pilotId,
      coach_id: input.coachId,
      availability_id: input.availabilityId ?? null,
      requested_starts_at: input.requestedStartsAt ?? null,
      circuit_name: input.circuitName?.trim() || null,
      message,
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

/** Liste les demandes du pilote courant (les plus récentes d'abord). */
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

  return (data ?? []).map((row) => ({
    id: row.id,
    coachId: row.coach_id,
    availabilityId: row.availability_id ?? null,
    requestedStartsAt: row.requested_starts_at ?? null,
    circuitName: row.circuit_name ?? null,
    message: row.message ?? null,
    status: row.status as BookingStatus,
    createdAt: row.created_at,
  }));
}
