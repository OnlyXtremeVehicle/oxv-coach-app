/**
 * @deprecated DÉCISION GABIN 2026-06 — le modèle `places`
 * (partners/lodgings/restaurants, tables vides en prod) est déprécié au profit
 * de `social_pings`. La découverte du territoire vit dans `carte-oxv` (écran
 * unique carte + liste) ; `lieux.tsx` est une coquille `<Redirect>`.
 * Voir `roadmap/rapports/pr-08-fusion-carte-oxv.md`.
 *
 * ---
 *
 * LA DÉPRÉCIATION N'EST PLUS TOTALE — 17/08/2026.
 *
 * Cet en-tête disait « plus aucun écran ne consomme ce service » et annonçait
 * une « suppression définitive, blast radius nul ». Les deux phrases sont
 * devenues fausses : `fetchRestaurantsSortie` est appelée par la sortie
 * d'écurie (`app/(app2)/club/sortie.tsx`) pour composer le trajet, et le module
 * est sorti de la liste des orphelins connus.
 *
 * Ce qui reste déprécié : `Place`, `PLACE_KIND_LABELS`, `groupPlacesByKind` et
 * `fetchPublishedPlaces` — l'annuaire. Ce qui vit : la lecture des restaurants
 * avec leurs coordonnées, ci-dessous. Supprimer ce fichier casserait désormais
 * une fonctionnalité, et non plus rien.
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

/** Un restaurant utilisable comme ÉTAPE d'un trajet — donc avec ses coordonnées. */
export interface RestaurantSortie {
  id: string;
  name: string;
  city: string | null;
  lat: number;
  lon: number;
  /** Distance au circuit, en km, telle que la table la porte. `null` si inconnue. */
  distanceCircuitKm: number | null;
}

/**
 * Restaurants publiés utilisables comme étape d'une sortie d'écurie.
 *
 * `fetchPublishedPlaces` ne sélectionne PAS `lat`/`lon` — son `Place` sert un
 * annuaire, pas un itinéraire. Plutôt que d'élargir ce type pour tout le monde,
 * cette lecture rend exactement ce qu'un trajet demande.
 *
 * Le filtre `not(lat, is, null)` n'est pas une précaution de style : un
 * restaurant sans coordonnées ne peut pas être une étape, et le proposer au
 * capitaine reviendrait à lui offrir un choix qui ne changerait rien au tracé.
 *
 * Tri par distance au circuit quand elle est connue — l'écurie mange en chemin,
 * pas à l'autre bout de la région. Les distances inconnues passent en dernier
 * plutôt que d'être écartées : la colonne est souvent vide, et un restaurant
 * réel vaut mieux qu'une liste courte.
 */
export async function fetchRestaurantsSortie(
  circuitId?: string | null
): Promise<RestaurantSortie[]> {
  let q = supabase
    .from('restaurants')
    .select('id, name, city, lat, lon, distance_to_circuit_km')
    .eq('is_published', true)
    .not('lat', 'is', null)
    .not('lon', 'is', null);

  if (circuitId) q = q.eq('circuit_id', circuitId);

  const { data, error } = await q.order('distance_to_circuit_km', {
    ascending: true,
    nullsFirst: false,
  });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
    .map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city ?? null,
      lat: r.lat as number,
      lon: r.lon as number,
      distanceCircuitKm: r.distance_to_circuit_km ?? null,
    }));
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
