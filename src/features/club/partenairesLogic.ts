/**
 * Logique pure — écran PARTENAIRES de la porte CLUB (lot V2-L5, Mission B).
 *
 * Mapping des cartes partenaire (catégorie, monogramme de repli, résumé
 * d'offre publiée) et phrase de consentement EXPLICITE de mise en relation.
 *
 * GARDE-FOU v1 CONSERVÉ (non négociable) : JAMAIS de push télémétrique vers
 * un partenaire. La mise en relation transmet UNIQUEMENT les coordonnées du
 * pilote, sur consentement explicite — la phrase le dit mot pour mot. Ce
 * module ne référence AUCUNE donnée de pilotage, par construction.
 *
 * Aucune I/O : module .ts pur, testable sous jest node.
 */

import type { MarketplacePartner, PartnerOffer } from '@/services/partnerService';

/** Libellés FR sobres des catégories partenaire (repris de la v1). */
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  photographe: 'Photographe / vidéaste',
  garage: 'Garage / préparateur',
  hotel: 'Hébergement',
  restaurant: 'Restaurant',
  transport: 'Transport véhicule',
  assurance: 'Assurance piste',
  loueur: 'Location véhicule',
  autre: 'Partenaire',
};

/** Libellé de catégorie, repli « Partenaire » pour un type inconnu. */
export function partnerCategoryLabel(type: string): string {
  return PARTNER_TYPE_LABELS[type] ?? 'Partenaire';
}

/** Monogramme de repli (2 lettres) quand la carte n'a pas de visuel. */
export function partnerMonogram(displayName: string): string {
  const letters = displayName
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || displayName.trim().charAt(0).toUpperCase() || '—';
}

/**
 * Résumé d'une offre : « {titre} · {prix} € » si le prix est renseigné,
 * sinon le titre seul. Jamais un prix fabriqué.
 */
export function offerSummaryLabel(offer: Pick<PartnerOffer, 'title' | 'priceEur'>): string {
  if (offer.priceEur != null) return `${offer.title} · ${offer.priceEur} €`;
  return offer.title;
}

/** Carte partenaire prête à afficher (FlashList). */
export interface PartnerCardVM {
  id: string;
  name: string;
  category: string;
  /** Visuel du partenaire, ou null → repli monogramme. */
  logoUrl: string | null;
  monogram: string;
  /** Résumé de la 1re offre publiée, ou null (aucune offre). */
  offerLabel: string | null;
  offerCount: number;
  /** Le pilote a déjà demandé une mise en relation. */
  requested: boolean;
}

/**
 * Mappe un partenaire marketplace + l'ensemble des partenaires déjà
 * sollicités vers une carte affichable.
 */
export function toPartnerCard(
  partner: MarketplacePartner,
  requestedIds: ReadonlySet<string>
): PartnerCardVM {
  const first = partner.offers[0];
  return {
    id: partner.id,
    name: partner.displayName,
    category: partnerCategoryLabel(partner.type),
    logoUrl: partner.logoUrl ?? null,
    monogram: partnerMonogram(partner.displayName),
    offerLabel: first ? offerSummaryLabel(first) : null,
    offerCount: partner.offers.length,
    requested: requestedIds.has(partner.id),
  };
}

/** Mappe la liste complète. */
export function toPartnerCards(
  partners: readonly MarketplacePartner[],
  requestedIds: ReadonlySet<string>
): PartnerCardVM[] {
  return partners.map((p) => toPartnerCard(p, requestedIds));
}

/**
 * Identifiant de l'offre à joindre à la demande de contact : la 1re offre
 * publiée du partenaire, ou null (mise en relation sans offre précise).
 */
export function primaryOfferId(partner: Pick<MarketplacePartner, 'offers'>): string | null {
  return partner.offers[0]?.id ?? null;
}

/**
 * Phrase de consentement EXPLICITE, affichée avant toute mise en relation.
 * Énonce exactement le périmètre transmis — et ce qui ne l'est JAMAIS.
 * Toute reformulation qui laisserait entendre un partage de données de
 * pilotage romprait la doctrine (verrouillé par test).
 */
export const PARTNER_CONSENT_SENTENCE =
  'Vos coordonnées — jamais vos données de pilotage — seront transmises.';
