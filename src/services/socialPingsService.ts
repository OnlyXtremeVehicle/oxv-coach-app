/**
 * Service volet social — pings de localisation (§7 OXV Mirror).
 *
 * Lecture des points de la carte sociale, réservée aux membres validés
 * (RLS is_validated_member). Aucune écriture côté pilote (admin only).
 *
 * Voir migration 20260526180000_0033_social_pings.sql.
 */

import { supabase } from '@/lib/supabase';

export type SocialPingKind =
  | 'event_oxv'
  | 'event_partner'
  | 'soiree'
  | 'partner_location'
  | 'filming_location'
  | 'host_experience';

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
}

/** Libellés FR des types de ping (sobres, doctrine OXV). */
export const PING_KIND_LABELS: Record<SocialPingKind, string> = {
  event_oxv: 'Événement OXV',
  event_partner: 'Événement partenaire',
  soiree: 'Soirée',
  partner_location: 'Partenaire',
  filming_location: 'Tournage',
  host_experience: 'Chez un hôte',
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
  };
}

/**
 * Liste les pings publiés visibles (RLS : membres validés). Triés par
 * date d'événement croissante (les non-datés en fin).
 */
export async function listSocialPings(): Promise<SocialPing[]> {
  const { data, error } = await supabase
    .from('social_pings' as never)
    .select('*' as never)
    .eq('is_published', true);

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
    'partner_location',
    'filming_location',
    'host_experience',
  ];
  return order
    .map((kind) => ({ kind, items: pings.filter((p) => p.kind === kind) }))
    .filter((g) => g.items.length > 0);
}
