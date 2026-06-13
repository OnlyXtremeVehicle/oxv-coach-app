import { groupPlacesByKind, type Place, type PlaceKind } from '../placesService';

// Le module importe le client Supabase (qui throw sans env) ; on le mocke pour
// charger le module sous test en Node. On ne teste ici que la logique pure.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

function mk(id: string, kind: PlaceKind, name: string): Place {
  return {
    id,
    kind,
    name,
    category: null,
    city: null,
    region: null,
    url: null,
    priceRange: null,
    isPremium: false,
    isOfficialPartner: false,
  };
}

describe('groupPlacesByKind', () => {
  it('regroupe dans l’ordre partenaires → hébergements → restaurants, genres vides omis', () => {
    const groups = groupPlacesByKind([
      mk('1', 'restaurant', 'R'),
      mk('2', 'partner', 'P'),
      mk('3', 'restaurant', 'R2'),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['partner', 'restaurant']); // lodging absent → omis
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].items).toHaveLength(2);
  });

  it('renvoie une liste vide pour aucune entrée', () => {
    expect(groupPlacesByKind([])).toEqual([]);
  });
});
