import {
  type CircuitService,
  type DirectoryCircuit,
  SERVICE_KIND_LABELS,
  circuitCenter,
  circuitSubtitle,
  groupServicesByKind,
} from '../ecosystemLogic';

function makeService(over: Partial<CircuitService> = {}): CircuitService {
  return {
    id: 's1',
    circuitId: 'c1',
    kind: 'restaurant',
    name: 'Service',
    description: null,
    address: null,
    lat: null,
    lon: null,
    url: null,
    contactEmail: null,
    contactPhone: null,
    organizer: null,
    isPremium: false,
    ...over,
  };
}

function makeCircuit(over: Partial<DirectoryCircuit> = {}): DirectoryCircuit {
  return {
    id: 'c1',
    name: 'Circuit',
    officialName: null,
    city: null,
    region: null,
    lengthKm: null,
    turnsCount: null,
    finishLineLat: null,
    finishLineLon: null,
    bboxMinLat: null,
    bboxMaxLat: null,
    bboxMinLon: null,
    bboxMaxLon: null,
    ...over,
  };
}

describe('groupServicesByKind', () => {
  it('regroupe par type dans l’ordre roulage → hébergement → resto → loisirs → autres', () => {
    const services = [
      makeService({ id: '1', kind: 'restaurant', name: 'Bistrot' }),
      makeService({ id: '2', kind: 'roulage', name: 'Journée OXV' }),
      makeService({ id: '3', kind: 'entertainment', name: 'Karting' }),
      makeService({ id: '4', kind: 'lodging', name: 'Hôtel' }),
    ];
    const groups = groupServicesByKind(services);
    expect(groups.map((g) => g.kind)).toEqual([
      'roulage',
      'lodging',
      'restaurant',
      'entertainment',
    ]);
  });

  it('omet les groupes vides', () => {
    const groups = groupServicesByKind([makeService({ kind: 'restaurant' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('restaurant');
  });

  it('trie chaque groupe par nom', () => {
    const services = [
      makeService({ id: '1', kind: 'restaurant', name: 'Zinc' }),
      makeService({ id: '2', kind: 'restaurant', name: 'Auberge' }),
    ];
    const [group] = groupServicesByKind(services);
    expect(group.items.map((s) => s.name)).toEqual(['Auberge', 'Zinc']);
  });
});

describe('circuitCenter', () => {
  it('retourne le centre de la bounding box si disponible', () => {
    const c = makeCircuit({
      bboxMinLat: 45,
      bboxMaxLat: 46,
      bboxMinLon: -1,
      bboxMaxLon: 1,
    });
    expect(circuitCenter(c)).toEqual({ lat: 45.5, lon: 0 });
  });

  it('retombe sur la ligne d’arrivée sans bbox', () => {
    const c = makeCircuit({ finishLineLat: 45.3, finishLineLon: -0.4 });
    expect(circuitCenter(c)).toEqual({ lat: 45.3, lon: -0.4 });
  });

  it('retourne null sans donnée géographique', () => {
    expect(circuitCenter(makeCircuit())).toBeNull();
  });
});

describe('circuitSubtitle', () => {
  it('assemble lieu, longueur et virages', () => {
    const c = makeCircuit({
      city: 'Bouteville',
      region: 'Nouvelle-Aquitaine',
      lengthKm: 3.6,
      turnsCount: 7,
    });
    expect(circuitSubtitle(c)).toBe('Bouteville, Nouvelle-Aquitaine · 3.6 km · 7 virages');
  });

  it('gère les champs manquants', () => {
    expect(circuitSubtitle(makeCircuit({ city: 'Nogaro' }))).toBe('Nogaro');
    expect(circuitSubtitle(makeCircuit())).toBe('');
  });
});

describe('SERVICE_KIND_LABELS', () => {
  it('expose des libellés FR sobres', () => {
    expect(SERVICE_KIND_LABELS.roulage).toBe('Journées de roulage');
    expect(SERVICE_KIND_LABELS.lodging).toBe('Hébergement');
    expect(SERVICE_KIND_LABELS.restaurant).toBe('Restauration');
    expect(SERVICE_KIND_LABELS.entertainment).toBe('Loisirs');
    expect(SERVICE_KIND_LABELS.other).toBe('Autres services');
  });
});
