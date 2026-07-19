/**
 * Tests purs — logique de l'écran TERRITOIRE (V2-L5, mission C, 4/7).
 *
 * Points verrouillés (exigés par le prompt) : pins visibles (bbox synchronisée
 * au pan), routes certifiées (tri/dédup), gating fail-closed du convoi. Plus un
 * verrou DOCTRINAL explicite : aucune sortie de ce module n'expose de rang, de
 * gagnant, ni de chrono d'autrui.
 */

import {
  convoysForRoute,
  curvinessLabel,
  distanceKmLabel,
  filterInView,
  isCertified,
  isParticipant,
  isWithinBBox,
  mergeRoutes,
  participantsLabel,
  regionToBBox,
  shouldOfferConvoy,
  sinuosityLabel,
  type BBox,
} from '../territoireLogic';

// --- Bbox / pins visibles ---------------------------------------------------

describe('regionToBBox', () => {
  it('centre + deltas → cadre symétrique', () => {
    const box = regionToBBox({
      latitude: 45,
      longitude: -0.4,
      latitudeDelta: 2,
      longitudeDelta: 4,
    });
    expect(box).toEqual({ minLat: 44, maxLat: 46, minLon: -2.4, maxLon: 1.6 });
  });

  it('tolère des deltas négatifs (abs)', () => {
    const box = regionToBBox({
      latitude: 0,
      longitude: 0,
      latitudeDelta: -2,
      longitudeDelta: -2,
    });
    expect(box).toEqual({ minLat: -1, maxLat: 1, minLon: -1, maxLon: 1 });
  });
});

describe('isWithinBBox', () => {
  const box: BBox = { minLat: 44, maxLat: 46, minLon: -2, maxLon: 2 };

  it('point à l’intérieur → vrai', () => {
    expect(isWithinBBox(45, 0, box)).toBe(true);
  });

  it('bords inclus', () => {
    expect(isWithinBBox(44, -2, box)).toBe(true);
    expect(isWithinBBox(46, 2, box)).toBe(true);
  });

  it('hors cadre → faux', () => {
    expect(isWithinBBox(43.9, 0, box)).toBe(false);
    expect(isWithinBBox(45, 2.1, box)).toBe(false);
  });

  it('coordonnée non finie → faux (défensif)', () => {
    expect(isWithinBBox(Number.NaN, 0, box)).toBe(false);
    expect(isWithinBBox(45, Number.POSITIVE_INFINITY, box)).toBe(false);
  });
});

describe('filterInView', () => {
  const box: BBox = { minLat: 44, maxLat: 46, minLon: -2, maxLon: 2 };
  const circuits = [
    { id: 'a', finishLineLat: 45, finishLineLon: 0 },
    { id: 'b', finishLineLat: 40, finishLineLon: 0 },
  ];

  it('applique l’accesseur et ne garde que les points visibles', () => {
    const visible = filterInView(circuits, box, (c) => ({
      lat: c.finishLineLat,
      lon: c.finishLineLon,
    }));
    expect(visible.map((c) => c.id)).toEqual(['a']);
  });
});

// --- Routes -----------------------------------------------------------------

describe('isCertified', () => {
  it('status certified → vrai, autre → faux', () => {
    expect(isCertified({ status: 'certified' })).toBe(true);
    expect(isCertified({ status: 'pending_review' })).toBe(false);
    expect(isCertified({ status: 'draft' })).toBe(false);
  });
});

describe('mergeRoutes', () => {
  it('dédoublonne par id (la route à soi déjà certifiée n’apparaît qu’une fois)', () => {
    const mine = [
      { id: 'r1', status: 'certified' },
      { id: 'r2', status: 'draft' },
    ];
    const certified = [
      { id: 'r1', status: 'certified' },
      { id: 'r3', status: 'certified' },
    ];
    const merged = mergeRoutes(mine, certified);
    expect(merged.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('place les certifiées en tête, ordre préservé dans chaque groupe', () => {
    const mine = [
      { id: 'r2', status: 'draft' },
      { id: 'r1', status: 'certified' },
    ];
    const certified = [{ id: 'r3', status: 'certified' }];
    const merged = mergeRoutes(mine, certified);
    // certifiées d'abord (r1 puis r3), non-certifiées ensuite (r2).
    expect(merged.map((r) => r.id)).toEqual(['r1', 'r3', 'r2']);
  });
});

describe('libellés factuels', () => {
  it('curvinessLabel — connu, inconnu, absent', () => {
    expect(curvinessLabel('sinueuse')).toBe('Route sinueuse');
    expect(curvinessLabel('inconnu')).toBe('inconnu');
    expect(curvinessLabel(null)).toBeNull();
  });

  it('distanceKmLabel — arrondi, « — » si absent', () => {
    expect(distanceKmLabel(42.4)).toBe('42 km');
    expect(distanceKmLabel(null)).toBe('—');
    expect(distanceKmLabel(Number.NaN)).toBe('—');
  });

  it('sinuosityLabel — virgule FR, null si absent', () => {
    expect(sinuosityLabel(1.423)).toBe('sinuosité 1,42');
    expect(sinuosityLabel(null)).toBeNull();
  });
});

// --- C2 Convoi (gating fail-closed) ----------------------------------------

describe('shouldOfferConvoy', () => {
  const certified = { status: 'certified' };

  it('drapeau + certifiée + journée résolue → vrai', () => {
    expect(shouldOfferConvoy(certified, { flagEnabled: true, daySessionId: 's1' })).toBe(true);
  });

  it('drapeau OFF → faux (fail-closed)', () => {
    expect(shouldOfferConvoy(certified, { flagEnabled: false, daySessionId: 's1' })).toBe(false);
  });

  it('route non certifiée → faux', () => {
    expect(shouldOfferConvoy({ status: 'draft' }, { flagEnabled: true, daySessionId: 's1' })).toBe(
      false
    );
  });

  it('aucune journée résolue (null ou vide) → faux', () => {
    expect(shouldOfferConvoy(certified, { flagEnabled: true, daySessionId: null })).toBe(false);
    expect(shouldOfferConvoy(certified, { flagEnabled: true, daySessionId: '' })).toBe(false);
  });
});

describe('convoysForRoute', () => {
  const convoys = [
    { id: 'c1', routeId: 'r1', participants: [] },
    { id: 'c2', routeId: null, participants: [] },
    { id: 'c3', routeId: 'r1', participants: [] },
  ];

  it('ne retient que les convois rattachés à la route', () => {
    expect(convoysForRoute(convoys, 'r1').map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  it('route sans convoi → liste vide', () => {
    expect(convoysForRoute(convoys, 'rX')).toEqual([]);
  });
});

describe('isParticipant / participantsLabel', () => {
  const convoy = { participants: [{ userId: 'u1' }, { userId: 'u2' }] };

  it('membre → vrai, non-membre / anon → faux', () => {
    expect(isParticipant(convoy, 'u1')).toBe(true);
    expect(isParticipant(convoy, 'u9')).toBe(false);
    expect(isParticipant(convoy, null)).toBe(false);
  });

  it('participantsLabel — singulier / pluriel / plancher', () => {
    expect(participantsLabel(1)).toBe('1 participant');
    expect(participantsLabel(3)).toBe('3 participants');
    expect(participantsLabel(-2)).toBe('0 participant');
  });
});

// --- Verrou DOCTRINAL -------------------------------------------------------

describe('doctrine — aucun classement ni chrono d’autrui', () => {
  it('les sorties du module ne portent aucun champ de rang / score / chrono', () => {
    const merged = mergeRoutes(
      [{ id: 'r1', status: 'certified', distanceKm: 30 }],
      [{ id: 'r2', status: 'certified', distanceKm: 12 }]
    );
    const forbidden = ['rank', 'score', 'lapTime', 'chrono', 'position', 'winner', 'ranking'];
    for (const route of merged) {
      for (const key of Object.keys(route)) {
        expect(forbidden).not.toContain(key);
      }
    }
    // Un convoi ne transporte qu'un id de pilote + un horodatage d'adhésion —
    // jamais une performance.
    const convoys = convoysForRoute(
      [{ routeId: 'r1', participants: [{ userId: 'u1', joinedAt: 't' }] }],
      'r1'
    );
    expect(Object.keys(convoys[0].participants[0]).sort()).toEqual(['joinedAt', 'userId']);
  });
});
