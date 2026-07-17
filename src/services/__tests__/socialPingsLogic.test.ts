/**
 * Logique pure de La carte OXV — catégories fondateur (build 23) et
 * regroupement par kind. Aucune I/O : le client Supabase est mocké pour
 * charger le module sous Node.
 */

import {
  type SocialPing,
  type SocialPingKind,
  CARTE_CATEGORIES,
  PING_KIND_LABELS,
  categoryOfKind,
  countPingsByCategory,
  filterPingsByCategory,
  groupPingsByKind,
} from '../socialPingsService';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const ALL_KINDS: SocialPingKind[] = [
  'event_oxv',
  'event_partner',
  'soiree',
  'partner_location',
  'filming_location',
  'host_experience',
  'garage',
  'restaurant',
  'hotel',
  'autre',
];

function mk(id: string, kind: SocialPingKind): SocialPing {
  return {
    id,
    kind,
    title: `Point ${id}`,
    description: null,
    lat: 45.6,
    lon: -0.4,
    address: null,
    contactEmail: null,
    liveUrl: null,
    eventUrl: null,
    startsAt: null,
    endsAt: null,
    websiteUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    youtubeUrl: null,
    imageUrl: null,
    isPublished: true,
    partnerId: null,
  };
}

describe('categoryOfKind', () => {
  it('affecte chaque kind à exactement une catégorie (aucun orphelin)', () => {
    for (const kind of ALL_KINDS) {
      const key = categoryOfKind(kind);
      const cat = CARTE_CATEGORIES.find((c) => c.key === key);
      expect(cat).toBeDefined();
      expect(cat?.kinds).toContain(kind);
    }
  });

  it('mappe les kinds fondateur sur leurs onglets', () => {
    expect(categoryOfKind('event_oxv')).toBe('evenements');
    expect(categoryOfKind('event_partner')).toBe('evenements');
    expect(categoryOfKind('soiree')).toBe('evenements');
    expect(categoryOfKind('garage')).toBe('garages');
    expect(categoryOfKind('restaurant')).toBe('restaurants');
    expect(categoryOfKind('hotel')).toBe('hotels');
    expect(categoryOfKind('autre')).toBe('autres');
    expect(categoryOfKind('partner_location')).toBe('autres');
  });

  it('aucun kind ne figure dans deux catégories', () => {
    const seen = new Set<string>();
    for (const cat of CARTE_CATEGORIES) {
      for (const kind of cat.kinds) {
        expect(seen.has(kind)).toBe(false);
        seen.add(kind);
      }
    }
    expect(seen.size).toBe(ALL_KINDS.length);
  });
});

describe('countPingsByCategory', () => {
  it('compte réellement par catégorie (chips masquées à zéro côté écran)', () => {
    const counts = countPingsByCategory([
      mk('1', 'event_oxv'),
      mk('2', 'soiree'),
      mk('3', 'garage'),
      mk('4', 'hotel'),
      mk('5', 'autre'),
      mk('6', 'host_experience'),
    ]);
    expect(counts).toEqual({
      evenements: 2,
      garages: 1,
      restaurants: 0,
      hotels: 1,
      autres: 2,
    });
  });

  it('renvoie zéro partout pour aucune entrée', () => {
    expect(countPingsByCategory([])).toEqual({
      evenements: 0,
      garages: 0,
      restaurants: 0,
      hotels: 0,
      autres: 0,
    });
  });
});

describe('filterPingsByCategory', () => {
  const pings = [mk('1', 'garage'), mk('2', 'restaurant'), mk('3', 'event_oxv')];

  it('« tout » renvoie la liste inchangée', () => {
    expect(filterPingsByCategory(pings, 'tout')).toEqual(pings);
  });

  it('filtre sur la catégorie demandée uniquement', () => {
    expect(filterPingsByCategory(pings, 'garages').map((p) => p.id)).toEqual(['1']);
    expect(filterPingsByCategory(pings, 'restaurants').map((p) => p.id)).toEqual(['2']);
    expect(filterPingsByCategory(pings, 'hotels')).toEqual([]);
  });
});

describe('groupPingsByKind (kinds fondateur inclus)', () => {
  it('regroupe les nouveaux kinds et omet les groupes vides', () => {
    const groups = groupPingsByKind([
      mk('1', 'restaurant'),
      mk('2', 'garage'),
      mk('3', 'garage'),
      mk('4', 'autre'),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['garage', 'restaurant', 'autre']);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe('PING_KIND_LABELS', () => {
  it('tous les kinds ont un libellé FR non vide (zéro emoji, sobre)', () => {
    for (const kind of ALL_KINDS) {
      const label = PING_KIND_LABELS[kind];
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
