/**
 * Lieux de l'écosystème OXV (specs v4 §08) : partenaires, hébergements, restaurants.
 *
 * Lecture seule des lignes PUBLIÉES (`is_published = true`) — donnée publique de
 * lieu, pas de donnée personnelle pilote (pas de gate RGPD). Les tables existent
 * en prod (vides pour l'instant) ; un état vide explicite est attendu (doctrine :
 * ne jamais maquiller l'absence).
 */

import { supabase } from '@/lib/supabase';

export type PlaceKind = 'partner' | 'lodging' | 'restaurant';

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  /** partner_type / lodging_type / cuisine_type selon le genre. */
  category: string | null;
  city: string | null;
  region: string | null;
  url: string | null;
  /** Indicatif €/€€/€€€ (hébergements, restaurants). */
  priceRange: string | null;
  isPremium: boolean;
  /** Partenaire officiel OXV (partenaires uniquement). */
  isOfficialPartner: boolean;
}

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  partner: 'Partenaires',
  lodging: 'Hébergements',
  restaurant: 'Restaurants',
};

/** Regroupe les lieux par genre, dans l'ordre Partenaires → Hébergements → Restaurants. */
export function groupPlacesByKind(places: Place[]): { kind: PlaceKind; items: Place[] }[] {
  const order: PlaceKind[] = ['partner', 'lodging', 'restaurant'];
  return order
    .map((kind) => ({ kind, items: places.filter((p) => p.kind === kind) }))
    .filter((g) => g.items.length > 0);
}

export async function fetchPublishedPlaces(): Promise<Place[]> {
  const [partners, lodgings, restaurants] = await Promise.all([
    supabase
      .from('partners')
      .select('id, name, partner_type, city, region, url, is_premium, is_official_partner')
      .eq('is_published', true),
    supabase
      .from('lodgings')
      .select('id, name, lodging_type, city, region, url, price_range, is_premium')
      .eq('is_published', true),
    supabase
      .from('restaurants')
      .select('id, name, cuisine_type, city, region, url, price_range, is_premium')
      .eq('is_published', true),
  ]);

  const places: Place[] = [];

  for (const r of partners.data ?? []) {
    places.push({
      id: r.id,
      kind: 'partner',
      name: r.name,
      category: r.partner_type,
      city: r.city,
      region: r.region,
      url: r.url,
      priceRange: null,
      isPremium: !!r.is_premium,
      isOfficialPartner: !!r.is_official_partner,
    });
  }
  for (const r of lodgings.data ?? []) {
    places.push({
      id: r.id,
      kind: 'lodging',
      name: r.name,
      category: r.lodging_type,
      city: r.city,
      region: r.region,
      url: r.url,
      priceRange: r.price_range,
      isPremium: !!r.is_premium,
      isOfficialPartner: false,
    });
  }
  for (const r of restaurants.data ?? []) {
    places.push({
      id: r.id,
      kind: 'restaurant',
      name: r.name,
      category: r.cuisine_type,
      city: r.city,
      region: r.region,
      url: r.url,
      priceRange: r.price_range,
      isPremium: !!r.is_premium,
      isOfficialPartner: false,
    });
  }

  // Premium d'abord, puis ordre alphabétique.
  return places.sort((a, b) => {
    if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });
}
