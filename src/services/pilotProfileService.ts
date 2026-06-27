/**
 * Profil pilote — lecture + édition par le pilote LUI-MÊME (sa ligne `users`).
 *
 * Le pilote édite : niveau, expérience, licence FFSA, véhicule, réseaux. La RLS
 * de self-update sur `users` borne tout au pilote courant. L'exposition au coach
 * affilié (affichage côté coach) = incrément suivant. Média photo/vidéo : upload
 * à venir. Doctrine : sobre, vouvoiement, factuel.
 */

import { supabase } from '@/lib/supabase';

/** Liens réseaux du pilote (dénormalisés en jsonb `users.socials`). */
export interface PilotSocials {
  website: string | null;
  instagram: string | null;
  youtube: string | null;
}

/** Profil éditable du pilote courant. */
export interface MyPilotProfile {
  pilotLevel: string | null;
  experienceYears: string | null;
  ffsaLicense: string | null;
  vehicle: string | null;
  socials: PilotSocials;
}

export interface UpdatePilotProfileInput {
  pilotLevel?: string | null;
  experienceYears?: string | null;
  ffsaLicense?: string | null;
  vehicle?: string | null;
  socials?: PilotSocials;
}

const EMPTY_SOCIALS: PilotSocials = { website: null, instagram: null, youtube: null };
const EMPTY: MyPilotProfile = {
  pilotLevel: null,
  experienceYears: null,
  ffsaLicense: null,
  vehicle: null,
  socials: EMPTY_SOCIALS,
};

function parseSocials(raw: unknown): PilotSocials {
  if (!raw || typeof raw !== 'object') return EMPTY_SOCIALS;
  const o = raw as Record<string, unknown>;
  const pick = (k: string): string | null =>
    typeof o[k] === 'string' && (o[k] as string).length > 0 ? (o[k] as string) : null;
  return { website: pick('website'), instagram: pick('instagram'), youtube: pick('youtube') };
}

/** Niveaux pilote (vocabulaire OXV figé : « Apprivoisé » pour intermédiaire). */
export const PILOT_LEVELS: { value: string; label: string }[] = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Apprivoisé' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'expert', label: 'Expert' },
];

export function pilotLevelLabel(value: string | null): string {
  return PILOT_LEVELS.find((l) => l.value === value)?.label ?? 'Niveau —';
}

/**
 * Lit le profil du pilote courant. Best-effort : profil vide en cas d'erreur ou
 * d'utilisateur non connecté.
 */
export async function getMyPilotProfile(): Promise<MyPilotProfile> {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) return EMPTY;

  const { data, error } = await supabase
    .from('users')
    .select('pilot_level, experience_years, ffsa_license, vehicle, socials')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('[OXV][pilotProfile] getMyPilotProfile :', error.message);
    return EMPTY;
  }
  if (!data) return EMPTY;

  return {
    pilotLevel: data.pilot_level ?? null,
    experienceYears: data.experience_years ?? null,
    ffsaLicense: data.ffsa_license ?? null,
    vehicle: data.vehicle ?? null,
    socials: parseSocials(data.socials),
  };
}

/** Forme du patch envoyé à `users.update`. */
type PilotProfilePatch = {
  pilot_level?: string | null;
  experience_years?: string | null;
  ffsa_license?: string | null;
  vehicle?: string | null;
  // Record (et non PilotSocials) : compatible avec le type `Json` de Supabase.
  socials?: Record<string, string | null>;
};

/**
 * Met à jour le profil du pilote courant (sa ligne `users`). RLS self-update.
 * Renvoie un résultat défensif, jamais d'exception remontée à l'écran.
 */
export async function updateMyPilotProfile(
  input: UpdatePilotProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) {
    return { ok: false, error: 'Vous devez être connecté pour modifier votre profil.' };
  }

  const clean = (v?: string | null): string | null => (v && v.trim() ? v.trim() : null);
  const patch: PilotProfilePatch = {};
  if (input.pilotLevel !== undefined) patch.pilot_level = input.pilotLevel;
  if (input.experienceYears !== undefined) patch.experience_years = clean(input.experienceYears);
  if (input.ffsaLicense !== undefined) patch.ffsa_license = clean(input.ffsaLicense);
  if (input.vehicle !== undefined) patch.vehicle = clean(input.vehicle);
  if (input.socials !== undefined) {
    patch.socials = {
      website: clean(input.socials.website),
      instagram: clean(input.socials.instagram),
      youtube: clean(input.socials.youtube),
    };
  }

  const { error } = await supabase.from('users').update(patch).eq('id', id);

  if (error) {
    console.warn('[OXV][pilotProfile] updateMyPilotProfile :', error.message);
    return {
      ok: false,
      error: "Votre profil n'a pas pu être enregistré. Réessayez dans un instant.",
    };
  }

  return { ok: true };
}
