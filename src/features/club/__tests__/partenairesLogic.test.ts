/**
 * Tests — logique pure de l'écran Partenaires (club, Mission B).
 *
 * DOCTRINE / GARDE-FOU : la phrase de consentement énonce que SEULES les
 * coordonnées sont transmises — JAMAIS de donnée de pilotage. On verrouille
 * ce libellé, et le mapping des cartes (catégorie, monogramme, offre).
 */

import {
  offerSummaryLabel,
  PARTNER_CONSENT_SENTENCE,
  partnerCategoryLabel,
  partnerMonogram,
  primaryOfferId,
  toPartnerCard,
  toPartnerCards,
} from '../partenairesLogic';

import type { MarketplacePartner, PartnerOffer } from '@/services/partnerService';

// --- Fabriques -------------------------------------------------------------

function makeOffer(over: Partial<PartnerOffer> = {}): PartnerOffer {
  return {
    id: 'o1',
    partnerId: 'p1',
    title: 'Stage photo',
    description: null,
    priceEur: 120,
    quota: null,
    status: 'published',
    category: null,
    validUntil: null,
    conditions: null,
    imageUrl: null,
    ...over,
  };
}

function makePartner(over: Partial<MarketplacePartner> = {}): MarketplacePartner {
  return {
    id: 'p1',
    displayName: 'Studio Apex',
    type: 'photographe',
    description: 'Photographe de piste au Circuit de Haute Saintonge.',
    logoUrl: 'https://cdn/apex.jpg',
    offers: [makeOffer()],
    ...over,
  };
}

// --- Catégories ------------------------------------------------------------

describe('partnerCategoryLabel', () => {
  it('libellé connu', () => {
    expect(partnerCategoryLabel('photographe')).toBe('Photographe / vidéaste');
    expect(partnerCategoryLabel('garage')).toBe('Garage / préparateur');
  });
  it('type inconnu → repli « Partenaire »', () => {
    expect(partnerCategoryLabel('licorne')).toBe('Partenaire');
  });
});

// --- Monogramme ------------------------------------------------------------

describe('partnerMonogram', () => {
  it('deux initiales max', () => {
    expect(partnerMonogram('Studio Apex')).toBe('SA');
    expect(partnerMonogram('garage-du-circuit')).toBe('GD');
    expect(partnerMonogram('Nogaro')).toBe('N');
  });
});

// --- Résumé d'offre --------------------------------------------------------

describe('offerSummaryLabel', () => {
  it('titre + prix quand le prix existe', () => {
    expect(offerSummaryLabel({ title: 'Stage photo', priceEur: 120 })).toBe('Stage photo · 120 €');
  });
  it('titre seul si prix absent (jamais fabriqué)', () => {
    expect(offerSummaryLabel({ title: 'Stage photo', priceEur: null })).toBe('Stage photo');
  });
});

// --- Mapping de carte ------------------------------------------------------

describe('toPartnerCard', () => {
  it('mappe catégorie, monogramme, 1re offre, drapeau demandé', () => {
    const card = toPartnerCard(makePartner(), new Set(['p1']));
    expect(card).toEqual({
      id: 'p1',
      name: 'Studio Apex',
      category: 'Photographe / vidéaste',
      logoUrl: 'https://cdn/apex.jpg',
      monogram: 'SA',
      offerLabel: 'Stage photo · 120 €',
      offerCount: 1,
      requested: true,
    });
  });

  it('sans offre : offerLabel null, offerCount 0', () => {
    const card = toPartnerCard(makePartner({ offers: [] }), new Set());
    expect(card.offerLabel).toBeNull();
    expect(card.offerCount).toBe(0);
    expect(card.requested).toBe(false);
  });

  it('sans visuel : logoUrl null (repli monogramme côté écran)', () => {
    const card = toPartnerCard(makePartner({ logoUrl: null }), new Set());
    expect(card.logoUrl).toBeNull();
    expect(card.monogram).toBe('SA');
  });

  it('toPartnerCards mappe la liste', () => {
    const cards = toPartnerCards(
      [
        makePartner(),
        makePartner({ id: 'p2', displayName: 'Hôtel Nord', type: 'hotel', offers: [] }),
      ],
      new Set(['p2'])
    );
    expect(cards.map((c) => c.id)).toEqual(['p1', 'p2']);
    expect(cards[1].requested).toBe(true);
    expect(cards[1].category).toBe('Hébergement');
  });
});

// --- Offre primaire --------------------------------------------------------

describe('primaryOfferId', () => {
  it('id de la 1re offre publiée', () => {
    expect(primaryOfferId(makePartner({ offers: [makeOffer({ id: 'o42' })] }))).toBe('o42');
  });
  it('aucune offre → null', () => {
    expect(primaryOfferId(makePartner({ offers: [] }))).toBeNull();
  });
});

// --- DOCTRINE : phrase de consentement -------------------------------------

describe('PARTNER_CONSENT_SENTENCE (garde-fou)', () => {
  it('énonce les coordonnées ET l’exclusion explicite des données de pilotage', () => {
    expect(PARTNER_CONSENT_SENTENCE).toContain('coordonnées');
    expect(PARTNER_CONSENT_SENTENCE).toContain('jamais vos données de pilotage');
  });

  it('ne laisse entendre AUCUN partage de télémétrie / données de pilotage', () => {
    // Aucune formulation de partage télémétrique. Le mot « pilotage » n’apparaît
    // qu’au sein de la négation « jamais vos données de pilotage ».
    expect(PARTNER_CONSENT_SENTENCE).not.toMatch(/télémétri|vitesse|chrono|marge/i);
    expect(PARTNER_CONSENT_SENTENCE.replace('jamais vos données de pilotage', '')).not.toMatch(
      /pilotage/i
    );
  });
});
