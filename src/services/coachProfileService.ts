/**
 * Fiche coach — gestion par le coach LUI-MÊME (lecture + édition de SA fiche).
 *
 * Distinct de `coachMarketplaceService` (qui lit les fiches publiées côté
 * pilote). Ici le coach lit et édite sa propre fiche : la RLS
 * `coach_profiles_owner_all` ((coach_id = auth.uid()) AND is_coach()) borne
 * tout au coach courant.
 *
 * Doctrine : sobre, vouvoiement. La fiche est l'image du coach ; le tarif de
 * saison est indicatif (jamais transactionnel). La publication (`is_published`)
 * décide si la fiche apparaît dans la découverte pilote. Média photo/vidéo :
 * upload à venir (incrément suivant) — non géré ici.
 */

import { supabase } from '@/lib/supabase';

/** Fiche éditable du coach courant. */
export interface MyCoachProfile {
  headline: string | null;
  bio: string | null;
  palmares: string | null;
  specialties: string[];
  circuits: string[];
  seasonPriceEur: number | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  isPublished: boolean;
}

/** Champs modifiables (tous optionnels : on ne patche que ce qui est fourni). */
export interface UpdateCoachProfileInput {
  headline?: string | null;
  bio?: string | null;
  palmares?: string | null;
  specialties?: string[];
  circuits?: string[];
  seasonPriceEur?: number | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  isPublished?: boolean;
}

/** Forme du patch envoyé à `coach_profiles.upsert` (noms de colonnes réels). */
type CoachProfilePatch = {
  coach_id: string;
  headline?: string | null;
  bio?: string | null;
  palmares?: string | null;
  specialties?: string[];
  circuits?: string[];
  season_price_eur?: number | null;
  website_url?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  is_published?: boolean;
};

const EMPTY: MyCoachProfile = {
  headline: null,
  bio: null,
  palmares: null,
  specialties: [],
  circuits: [],
  seasonPriceEur: null,
  photoUrl: null,
  websiteUrl: null,
  instagramUrl: null,
  youtubeUrl: null,
  isPublished: false,
};

/**
 * Lit la fiche du coach courant. Renvoie une fiche vide (non publiée) si le
 * coach n'en a pas encore créé, ou en cas d'erreur (best-effort, jamais d'exception).
 */
export async function getMyCoachProfile(): Promise<MyCoachProfile> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth.user?.id;
  if (!coachId) return EMPTY;

  const { data, error } = await supabase
    .from('coach_profiles')
    .select(
      'headline, bio, palmares, specialties, circuits, season_price_eur, photo_url, website_url, instagram_url, youtube_url, is_published'
    )
    .eq('coach_id', coachId)
    .maybeSingle();

  if (error) {
    console.warn('[OXV][coachProfile] getMyCoachProfile :', error.message);
    return EMPTY;
  }
  if (!data) return EMPTY;

  return {
    headline: data.headline ?? null,
    bio: data.bio ?? null,
    palmares: data.palmares ?? null,
    specialties: Array.isArray(data.specialties) ? data.specialties : [],
    circuits: Array.isArray(data.circuits) ? data.circuits : [],
    seasonPriceEur: data.season_price_eur ?? null,
    photoUrl: data.photo_url ?? null,
    websiteUrl: data.website_url ?? null,
    instagramUrl: data.instagram_url ?? null,
    youtubeUrl: data.youtube_url ?? null,
    isPublished: data.is_published ?? false,
  };
}

/**
 * Crée ou met à jour la fiche du coach courant (UPSERT sur `coach_id`). Le
 * `coach_id` est posé à `auth.uid()` ; la RLS borne au propriétaire. On ne
 * patche que les champs fournis (les chaînes vides deviennent `null`). Renvoie
 * un résultat défensif, jamais d'exception remontée à l'écran.
 */
export async function updateMyCoachProfile(
  input: UpdateCoachProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth.user?.id;
  if (!coachId) {
    return { ok: false, error: 'Vous devez être connecté pour modifier votre fiche.' };
  }

  const patch: CoachProfilePatch = { coach_id: coachId };
  if (input.headline !== undefined) patch.headline = input.headline?.trim() || null;
  if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
  if (input.palmares !== undefined) patch.palmares = input.palmares?.trim() || null;
  if (input.specialties !== undefined) patch.specialties = input.specialties;
  if (input.circuits !== undefined) patch.circuits = input.circuits;
  if (input.seasonPriceEur !== undefined) patch.season_price_eur = input.seasonPriceEur;
  if (input.websiteUrl !== undefined) patch.website_url = input.websiteUrl?.trim() || null;
  if (input.instagramUrl !== undefined) patch.instagram_url = input.instagramUrl?.trim() || null;
  if (input.youtubeUrl !== undefined) patch.youtube_url = input.youtubeUrl?.trim() || null;
  if (input.isPublished !== undefined) patch.is_published = input.isPublished;

  const { error } = await supabase.from('coach_profiles').upsert(patch, { onConflict: 'coach_id' });

  if (error) {
    console.warn('[OXV][coachProfile] updateMyCoachProfile :', error.message);
    return {
      ok: false,
      error: "Votre fiche n'a pas pu être enregistrée. Réessayez dans un instant.",
    };
  }

  return { ok: true };
}

/** Découpe une saisie « a, b , c » en liste nettoyée (sans doublons vides). */
export function parseTagList(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
