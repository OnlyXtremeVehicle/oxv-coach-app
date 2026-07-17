/**
 * Service volet social — pings de localisation (§7 OXV Mirror).
 *
 * Lecture des points de la carte sociale, réservée aux membres validés
 * (RLS is_validated_member). Écritures : admin (tout) et partenaire VALIDÉ
 * (son point uniquement, toujours en non-publié — la publication est LA
 * validation admin ; décision fondateur 2026-07-16).
 *
 * Voir migrations 20260526180000_0033_social_pings.sql et
 * 20260716200000_coach_session_price_and_partner_pings.sql.
 */

import { supabase } from '@/lib/supabase';

export type SocialPingKind =
  | 'event_oxv'
  | 'event_partner'
  | 'soiree'
  | 'partner_location'
  | 'filming_location'
  | 'host_experience'
  // Catégories fondateur (build 23) — points créés par les partenaires.
  | 'garage'
  | 'restaurant'
  | 'hotel'
  | 'autre';

export interface SocialPing {
  id: string;
  kind: SocialPingKind;
  title: string;
  description: string | null;
  lat: number;
  lon: number;
  address: string | null;
  contactEmail: string | null;
  liveUrl: string | null;
  eventUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  // Contenu marketing affiché au clic (migration 0013).
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  /** Partenaire propriétaire du point (NULL = point OXV/admin). */
  partnerId: string | null;
}

interface DbRow {
  id: string;
  kind: SocialPingKind;
  title: string;
  description: string | null;
  lat: number;
  lon: number;
  address: string | null;
  contact_email: string | null;
  live_url: string | null;
  event_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  image_url: string | null;
  is_published: boolean;
  partner_id?: string | null;
}

/** Libellés FR des types de ping (sobres, doctrine OXV). */
export const PING_KIND_LABELS: Record<SocialPingKind, string> = {
  event_oxv: 'Événement OXV',
  event_partner: 'Événement partenaire',
  soiree: 'Soirée',
  partner_location: 'Partenaire',
  filming_location: 'Tournage',
  host_experience: 'Chez un hôte',
  garage: 'Garage',
  restaurant: 'Restaurant',
  hotel: 'Hôtel',
  autre: 'Autre',
};

function mapRow(row: DbRow): SocialPing {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    lat: Number(row.lat),
    lon: Number(row.lon),
    address: row.address,
    contactEmail: row.contact_email,
    liveUrl: row.live_url,
    eventUrl: row.event_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    websiteUrl: row.website_url,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    youtubeUrl: row.youtube_url,
    imageUrl: row.image_url,
    isPublished: row.is_published,
    partnerId: row.partner_id ?? null,
  };
}

/**
 * Liste les pings publiés visibles (RLS : membres validés). Triés par
 * date d'événement croissante (les non-datés en fin).
 */
export async function listSocialPings(): Promise<SocialPing[]> {
  const { data, error } = await supabase.from('social_pings').select('*').eq('is_published', true);

  if (error || !data) {
    if (error) console.warn('[socialPings] list error:', error.message);
    return [];
  }

  const rows = (data as unknown as DbRow[]).map(mapRow);
  // Tri : événements datés à venir d'abord (par date), puis les non-datés.
  return rows.sort((a, b) => {
    if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt);
    if (a.startsAt) return -1;
    if (b.startsAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Regroupe les pings par type, dans l'ordre d'affichage du cahier §7. */
export function groupPingsByKind(
  pings: SocialPing[]
): { kind: SocialPingKind; items: SocialPing[] }[] {
  const order: SocialPingKind[] = [
    'event_oxv',
    'event_partner',
    'soiree',
    'garage',
    'restaurant',
    'hotel',
    'partner_location',
    'filming_location',
    'host_experience',
    'autre',
  ];
  return order
    .map((kind) => ({ kind, items: pings.filter((p) => p.kind === kind) }))
    .filter((g) => g.items.length > 0);
}

// ─── Catégories de La carte OXV (onglets fondateur, build 23) ───────────────
// « affichage sur carte et dans un onglet événement, garage, restaurant,
// hôtel ou autre » — décision fondateur 2026-07-16. Logique pure (testée).

export type CarteCategoryKey = 'evenements' | 'garages' | 'restaurants' | 'hotels' | 'autres';

/** Onglets de la carte, dans l'ordre d'affichage. */
export const CARTE_CATEGORIES: { key: CarteCategoryKey; label: string; kinds: SocialPingKind[] }[] =
  [
    { key: 'evenements', label: 'Événements', kinds: ['event_oxv', 'event_partner', 'soiree'] },
    { key: 'garages', label: 'Garages', kinds: ['garage'] },
    { key: 'restaurants', label: 'Restaurants', kinds: ['restaurant'] },
    { key: 'hotels', label: 'Hôtels', kinds: ['hotel'] },
    {
      key: 'autres',
      label: 'Autres',
      kinds: ['partner_location', 'filming_location', 'host_experience', 'autre'],
    },
  ];

/** Catégorie (onglet) d'un kind. Tout kind appartient à exactement une catégorie. */
export function categoryOfKind(kind: SocialPingKind): CarteCategoryKey {
  const found = CARTE_CATEGORIES.find((c) => c.kinds.includes(kind));
  return found ? found.key : 'autres';
}

/** Comptes RÉELS par catégorie (les chips à zéro sont masquées à l'affichage). */
export function countPingsByCategory(pings: SocialPing[]): Record<CarteCategoryKey, number> {
  const counts: Record<CarteCategoryKey, number> = {
    evenements: 0,
    garages: 0,
    restaurants: 0,
    hotels: 0,
    autres: 0,
  };
  for (const p of pings) counts[categoryOfKind(p.kind)] += 1;
  return counts;
}

/** Filtre par onglet ; `'tout'` renvoie la liste inchangée. */
export function filterPingsByCategory(
  pings: SocialPing[],
  category: CarteCategoryKey | 'tout'
): SocialPing[] {
  if (category === 'tout') return pings;
  return pings.filter((p) => categoryOfKind(p.kind) === category);
}

// ─── Admin (RLS social_pings_admin_all : is_admin) ──────────────────────────

/** Entrée d'édition d'un point (admin). */
export interface UpsertPingInput {
  id?: string | null;
  kind: SocialPingKind;
  title: string;
  description: string | null;
  lat: number;
  lon: number;
  address: string | null;
  contactEmail: string | null;
  liveUrl: string | null;
  eventUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  imageUrl: string | null;
  startsAt: string | null;
  isPublished: boolean;
}

/** Admin : liste TOUS les points (publiés ou non), triés par titre. */
export async function listAllPings(): Promise<SocialPing[]> {
  const { data, error } = await supabase
    .from('social_pings')
    .select('*')
    .order('title', { ascending: true });
  if (error || !data) {
    if (error) console.warn('[socialPings] listAll error:', error.message);
    return [];
  }
  return (data as unknown as DbRow[]).map(mapRow);
}

function toDbRow(input: UpsertPingInput): Record<string, unknown> {
  return {
    kind: input.kind,
    title: input.title,
    description: input.description,
    lat: input.lat,
    lon: input.lon,
    address: input.address,
    contact_email: input.contactEmail,
    live_url: input.liveUrl,
    event_url: input.eventUrl,
    website_url: input.websiteUrl,
    instagram_url: input.instagramUrl,
    facebook_url: input.facebookUrl,
    youtube_url: input.youtubeUrl,
    image_url: input.imageUrl,
    starts_at: input.startsAt,
    is_published: input.isPublished,
  };
}

/** Admin : crée (sans id) ou met à jour (avec id) un point. */
export async function upsertPing(
  input: UpsertPingInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Objet construit dynamiquement (snake_case) -> cast assumé au bord DB.
  const row = toDbRow(input) as never;
  if (input.id) {
    const { error } = await supabase.from('social_pings').update(row).eq('id', input.id);
    if (error) {
      console.warn('[socialPings] update error:', error.message);
      return { ok: false, error: "Le point n'a pas pu être enregistré." };
    }
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from('social_pings').insert(row).select('id').single();
  if (error || !data) {
    console.warn('[socialPings] insert error:', error?.message);
    return { ok: false, error: "Le point n'a pas pu être créé." };
  }
  return { ok: true, id: (data as { id: string }).id };
}

/** Admin : supprime un point. */
export async function deletePing(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('social_pings').delete().eq('id', id);
  if (error) {
    console.warn('[socialPings] delete error:', error.message);
    return { ok: false };
  }
  return { ok: true };
}

// ─── Partenaire (RLS social_pings_partner_*, migration 2026-07-16) ──────────
// Le partenaire VALIDÉ crée et modifie SON point ; la RLS force is_published
// = false à chaque écriture : toute édition repasse par la validation admin.

/** Entrée du formulaire partenaire « Mon point sur la carte ». */
export interface PartnerPingInput {
  id?: string | null;
  partnerId: string;
  kind: SocialPingKind;
  title: string;
  description: string | null;
  address: string | null;
  lat: number;
  lon: number;
}

/** Partenaire : SES points (publiés ou en attente), triés par titre. */
export async function listMyPartnerPings(partnerId: string): Promise<SocialPing[]> {
  // Colonne partner_id (migration 2026-07-16) absente des types générés :
  // accès non typé localisé, même précédent que circuits.centerline_latlon.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('social_pings') as any;
  const { data, error } = await table
    .select('*')
    .eq('partner_id', partnerId)
    .order('title', { ascending: true });
  if (error || !data) {
    if (error) console.warn('[socialPings] listMyPartnerPings error:', error.message);
    return [];
  }
  return (data as unknown as DbRow[]).map(mapRow);
}

/**
 * Partenaire : crée (sans id) ou modifie (avec id) SON point. `is_published`
 * est TOUJOURS false côté écriture (exigé par la RLS) : le point repasse en
 * « En attente de validation OXV » à chaque enregistrement.
 */
export async function upsertMyPartnerPing(
  input: PartnerPingInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const row = {
    partner_id: input.partnerId,
    kind: input.kind,
    title: input.title,
    description: input.description,
    address: input.address,
    lat: input.lat,
    lon: input.lon,
    is_published: false, // la publication appartient à l'admin
  } as never;
  if (input.id) {
    const { error } = await supabase.from('social_pings').update(row).eq('id', input.id);
    if (error) {
      console.warn('[socialPings] partner update error:', error.message);
      return { ok: false, error: "Le point n'a pas pu être enregistré." };
    }
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from('social_pings').insert(row).select('id').single();
  if (error || !data) {
    console.warn('[socialPings] partner insert error:', error?.message);
    return { ok: false, error: "Le point n'a pas pu être créé." };
  }
  return { ok: true, id: (data as { id: string }).id };
}

/** Admin : points partenaires en attente de validation (non publiés). */
export async function listPendingPartnerPings(): Promise<SocialPing[]> {
  // Colonne partner_id absente des types générés : accès non typé localisé.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('social_pings') as any;
  const { data, error } = await table
    .select('*')
    .eq('is_published', false)
    .not('partner_id', 'is', null)
    .order('title', { ascending: true });
  if (error || !data) {
    if (error) console.warn('[socialPings] listPending error:', error.message);
    return [];
  }
  return (data as unknown as DbRow[]).map(mapRow);
}

/** Admin : valide un point (le rend visible sur La carte OXV). */
export async function publishPing(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('social_pings')
    .update({ is_published: true } as never)
    .eq('id', id);
  if (error) {
    console.warn('[socialPings] publish error:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
