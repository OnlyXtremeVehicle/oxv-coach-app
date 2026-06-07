import {
  type Roulage,
  type RoulageInvitation,
  INVITATION_STATUS_LABELS,
  ROULAGE_STATUS_LABELS,
  remainingPlaces,
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
