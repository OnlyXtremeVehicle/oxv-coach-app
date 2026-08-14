/**
 * @deprecated DÉCISION GABIN 2026-06 — le modèle `places`
 * (partners/lodgings/restaurants, tables vides en prod) est déprécié au profit
 * de `social_pings`. La découverte du territoire vit dans `carte-oxv` (écran
 * unique carte + liste) ; `lieux.tsx` est une coquille `<Redirect>`. Plus aucun
 * écran ne consomme ce service — seul `placesService.test.ts` le référence
 * encore. Suppression définitive planifiée dans `10_PLAN_MIGRATION` (blast
 * radius nul). Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 *
 * Lieux de l'écosystème OXV (specs v4 §08) : partenaires, hébergements, restaurants.
 * Lecture seule des lignes PUBLIÉES (`is_published = true`) — donnée publique de
 * lieu, pas de donnée personnelle pilote (pas de gate RGPD).
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

  /**
   * ORDRE ALPHABÉTIQUE, ET RIEN D'AUTRE.
   *
   * Ce tri disait « premium d'abord », c'est-à-dire : un lieu qui a payé passe
   * devant. La décision du 12 juillet 2026 — *« régie 100 % saison »* — l'a
   * rendu caduc, et le dossier l'écrit sans ambiguïté : **un lieu ne se
   * distingue jamais par ce qu'il a payé.**
   *
   * Le plan range cette ligne parmi les gestes de schéma, donc parmi les
   * bloqués — la colonne `is_premium` attend en effet un arbitrage. Mais
   * l'ordre achetable, lui, vivait en TypeScript. Il part aujourd'hui.
   *
   * `ecosystemService`, la voie qui a un consommateur réel, triait déjà par
   * nom : c'est bien ce module-ci, sans appelant de production, qui portait le
   * dernier endroit où un partenaire achetait un rang.
   */
  return places.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
