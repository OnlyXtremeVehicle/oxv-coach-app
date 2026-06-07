import {
  type Roulage,
  type RoulageInvitation,
  INVITATION_STATUS_LABELS,
  ROULAGE_STATUS_LABELS,
  computeCoachBusinessSummary,
  remainingPlaces,
  roulageRevenueCents,
  splitRoulagesByTime,
  summarizeInvitations,
  validateRoulageInput,
} from '../roulagesLogic';

const NOW = '2026-07-01T10:00:00.000Z';

function makeRoulage(over: Partial<Roulage> = {}): Roulage {
  return {
    id: 'r1',
    coachId: 'c1',
    title: 'Roulage test',
    circuitName: 'Circuit de Haute Saintonge',
    startsAt: '2026-07-10T09:00:00.000Z',
    endsAt: null,
    location: null,
    maxPilots: null,
    pricePerPilot: null,
    notes: null,
    status: 'open',
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function makeInvitation(over: Partial<RoulageInvitation> = {}): RoulageInvitation {
  return {
    id: 'i1',
    roulageId: 'r1',
    pilotId: 'p1',
    status: 'invited',
    invitedAt: NOW,
    respondedAt: null,
    ...over,
  };
}

describe('validateRoulageInput', () => {
  const future = '2026-08-01T09:00:00.000Z';

  it('accepte une saisie valide', () => {
    expect(validateRoulageInput({ title: 'Journée piste', startsAt: future }, NOW)).toBeNull();
  });

  it('refuse un titre vide', () => {
    expect(validateRoulageInput({ title: '   ', startsAt: future }, NOW)).toMatch(/titre/i);
  });

  it('refuse un titre trop long', () => {
    const long = 'a'.repeat(121);
    expect(validateRoulageInput({ title: long, startsAt: future }, NOW)).toMatch(/trop long/i);
  });

  it('refuse une date de début invalide', () => {
    expect(validateRoulageInput({ title: 'x', startsAt: 'pas-une-date' }, NOW)).toMatch(
      /invalide/i
    );
  });

  it('refuse une date de début déjà passée', () => {
    const past = '2026-06-01T09:00:00.000Z';
    expect(validateRoulageInput({ title: 'x', startsAt: past }, NOW)).toMatch(/passée/i);
  });

  it('refuse une date de fin avant le début', () => {
    expect(
      validateRoulageInput(
        { title: 'x', startsAt: future, endsAt: '2026-07-31T09:00:00.000Z' },
        NOW
      )
    ).toMatch(/précède/i);
  });

  it('refuse un nombre de places non entier ou négatif', () => {
    expect(validateRoulageInput({ title: 'x', startsAt: future, maxPilots: 0 }, NOW)).toMatch(
      /places/i
    );
    expect(validateRoulageInput({ title: 'x', startsAt: future, maxPilots: -3 }, NOW)).toMatch(
      /places/i
    );
    expect(validateRoulageInput({ title: 'x', startsAt: future, maxPilots: 2.5 }, NOW)).toMatch(
      /places/i
    );
  });

  it('accepte maxPilots null/absent', () => {
    expect(validateRoulageInput({ title: 'x', startsAt: future, maxPilots: null }, NOW)).toBeNull();
  });

  it('refuse un prix négatif ou non entier', () => {
    expect(
      validateRoulageInput({ title: 'x', startsAt: future, pricePerPilot: -100 }, NOW)
    ).toMatch(/prix/i);
    expect(
      validateRoulageInput({ title: 'x', startsAt: future, pricePerPilot: 12.34 }, NOW)
    ).toMatch(/prix/i);
  });

  it('accepte un prix entier positif ou nul', () => {
    expect(
      validateRoulageInput({ title: 'x', startsAt: future, pricePerPilot: 0 }, NOW)
    ).toBeNull();
    expect(
      validateRoulageInput({ title: 'x', startsAt: future, pricePerPilot: 15000 }, NOW)
    ).toBeNull();
  });
});

describe('splitRoulagesByTime', () => {
  it('sépare à venir et passés selon nowISO', () => {
    const upcoming = makeRoulage({ id: 'up', startsAt: '2026-07-10T09:00:00.000Z' });
    const past = makeRoulage({ id: 'past', startsAt: '2026-06-10T09:00:00.000Z' });
    const result = splitRoulagesByTime([past, upcoming], NOW);
    expect(result.upcoming.map((r) => r.id)).toEqual(['up']);
    expect(result.past.map((r) => r.id)).toEqual(['past']);
  });

  it('utilise endsAt si présent pour classer', () => {
    // commence avant now mais finit après → considéré à venir
    const ongoing = makeRoulage({
      id: 'ongoing',
      startsAt: '2026-06-30T09:00:00.000Z',
      endsAt: '2026-07-02T18:00:00.000Z',
    });
    const result = splitRoulagesByTime([ongoing], NOW);
    expect(result.upcoming.map((r) => r.id)).toEqual(['ongoing']);
  });

  it('trie les à venir au plus tôt et les passés au plus récent', () => {
    const a = makeRoulage({ id: 'a', startsAt: '2026-07-20T09:00:00.000Z' });
    const b = makeRoulage({ id: 'b', startsAt: '2026-07-10T09:00:00.000Z' });
    const c = makeRoulage({ id: 'c', startsAt: '2026-06-01T09:00:00.000Z' });
    const d = makeRoulage({ id: 'd', startsAt: '2026-06-20T09:00:00.000Z' });
    const result = splitRoulagesByTime([a, b, c, d], NOW);
    expect(result.upcoming.map((r) => r.id)).toEqual(['b', 'a']);
    expect(result.past.map((r) => r.id)).toEqual(['d', 'c']);
  });
});

describe('summarizeInvitations', () => {
  it('compte par statut', () => {
    const invs = [
      makeInvitation({ id: '1', status: 'invited' }),
      makeInvitation({ id: '2', status: 'accepted' }),
      makeInvitation({ id: '3', status: 'accepted' }),
      makeInvitation({ id: '4', status: 'declined' }),
    ];
    expect(summarizeInvitations(invs)).toEqual({ total: 4, invited: 1, accepted: 2, declined: 1 });
  });

  it('gère une liste vide', () => {
    expect(summarizeInvitations([])).toEqual({ total: 0, invited: 0, accepted: 0, declined: 0 });
  });
});

describe('remainingPlaces', () => {
  it('retourne null si pas de limite', () => {
    expect(remainingPlaces(makeRoulage({ maxPilots: null }), 5)).toBeNull();
  });

  it('calcule les places restantes', () => {
    expect(remainingPlaces(makeRoulage({ maxPilots: 10 }), 3)).toBe(7);
  });

  it('ne descend jamais sous zéro', () => {
    expect(remainingPlaces(makeRoulage({ maxPilots: 4 }), 9)).toBe(0);
  });
});

describe('roulageRevenueCents', () => {
  it('multiplie prix par place et présences', () => {
    expect(roulageRevenueCents(makeRoulage({ pricePerPilot: 15000 }), 4)).toBe(60000);
  });

  it('retourne 0 si non tarifé', () => {
    expect(roulageRevenueCents(makeRoulage({ pricePerPilot: null }), 4)).toBe(0);
  });

  it('retourne 0 si annulé', () => {
    expect(roulageRevenueCents(makeRoulage({ pricePerPilot: 15000, status: 'cancelled' }), 4)).toBe(
      0
    );
  });
});

describe('computeCoachBusinessSummary', () => {
  it('agrège pilotes, roulages, présences et revenu', () => {
    const r1 = makeRoulage({ id: 'r1', pricePerPilot: 10000 });
    const r2 = makeRoulage({ id: 'r2', pricePerPilot: 20000, status: 'done' });
    const r3 = makeRoulage({ id: 'r3', pricePerPilot: 5000, status: 'cancelled' });
    const accepted = new Map([
      ['r1', 3],
      ['r2', 2],
      ['r3', 4],
    ]);
    const summary = computeCoachBusinessSummary(7, [r1, r2, r3], accepted);
    expect(summary.pilotCount).toBe(7);
    expect(summary.roulageCount).toBe(3);
    expect(summary.activeRoulageCount).toBe(2); // r3 annulé exclu
    expect(summary.totalAccepted).toBe(9); // 3+2+4 (annulé compté en présences brutes)
    // revenu : r1 3×10000 + r2 2×20000 + r3 annulé 0 = 30000 + 40000 = 70000
    expect(summary.totalRevenueCents).toBe(70000);
  });

  it('gère un coach sans roulage', () => {
    const summary = computeCoachBusinessSummary(0, [], new Map());
    expect(summary).toEqual({
      pilotCount: 0,
      roulageCount: 0,
      activeRoulageCount: 0,
      totalRevenueCents: 0,
      totalAccepted: 0,
    });
  });
});

describe('labels', () => {
  it('expose des libellés FR sobres', () => {
    expect(ROULAGE_STATUS_LABELS.open).toBe('Ouvert');
    expect(ROULAGE_STATUS_LABELS.cancelled).toBe('Annulé');
    expect(ROULAGE_STATUS_LABELS.done).toBe('Passé');
    expect(INVITATION_STATUS_LABELS.invited).toBe('En attente');
    expect(INVITATION_STATUS_LABELS.accepted).toBe('Présent');
    expect(INVITATION_STATUS_LABELS.declined).toBe('Absent');
  });
});
