/**
 * Tests — logique pure de l'onglet Roulages (club, Mission B).
 *
 * DOCTRINE : « roulé ensemble ×{n} » est un FAIT de présence partagé, jamais
 * une performance. On vérifie qu'aucun chrono n'entre dans le calcul et que
 * seules les présences CONFIRMÉES sur des coachs RÉSOLUS sont comptées.
 */

import {
  buildRoulagesView,
  coachDisplayName,
  coachInitials,
  historyStatusLabel,
  isAttended,
  isPending,
  rolledTogetherByCoach,
  type CoachRef,
  type PilotInvitationPair,
} from '../roulagesLogic';

import type { Roulage, RoulageInvitation } from '@/services/roulagesLogic';

// --- Fabriques -------------------------------------------------------------

function makeRoulage(over: Partial<Roulage> = {}): Roulage {
  return {
    id: 'r1',
    coachId: 'coach-a',
    title: 'Roulage matinal',
    circuitName: 'Haute Saintonge',
    startsAt: '2026-08-01T09:00:00.000Z',
    endsAt: '2026-08-01T17:00:00.000Z',
    location: 'La Genétouze',
    maxPilots: 12,
    pricePerPilot: 15000,
    notes: null,
    status: 'open',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

function makeInvitation(over: Partial<RoulageInvitation> = {}): RoulageInvitation {
  return {
    id: 'i1',
    roulageId: 'r1',
    pilotId: 'me',
    status: 'invited',
    invitedAt: '2026-07-01T00:00:00.000Z',
    respondedAt: null,
    ...over,
  };
}

function pair(
  roulageOver: Partial<Roulage>,
  invitationOver: Partial<RoulageInvitation> = {}
): PilotInvitationPair {
  const roulage = makeRoulage(roulageOver);
  return {
    roulage,
    invitation: makeInvitation({ roulageId: roulage.id, ...invitationOver }),
  };
}

const COACH_A: CoachRef = {
  coachId: 'coach-a',
  firstName: 'Léa',
  lastName: 'Marchand',
  email: 'lea@oxv.fr',
};
const COACH_B: CoachRef = {
  coachId: 'coach-b',
  firstName: null,
  lastName: null,
  email: 'bruno@oxv.fr',
};

const NOW = '2026-07-19T12:00:00.000Z';

// --- Coach display ---------------------------------------------------------

describe('coachDisplayName / coachInitials', () => {
  it('assemble prénom + nom, repli e-mail', () => {
    expect(coachDisplayName(COACH_A)).toBe('Léa Marchand');
    expect(coachDisplayName(COACH_B)).toBe('bruno@oxv.fr');
  });

  it('initiales depuis prénom + nom, repli première lettre e-mail', () => {
    expect(coachInitials(COACH_A)).toBe('LM');
    expect(coachInitials(COACH_B)).toBe('B');
  });
});

// --- Classement à venir / attendu -----------------------------------------

describe('isPending', () => {
  const nowMs = Date.parse(NOW);

  it('invitation non répondue sur roulage ouvert et à venir → en attente', () => {
    expect(isPending(pair({ startsAt: '2026-08-01T09:00:00.000Z', endsAt: null }), nowMs)).toBe(
      true
    );
  });

  it('roulage déjà écoulé → plus en attente', () => {
    expect(
      isPending(
        pair({ startsAt: '2026-06-01T09:00:00.000Z', endsAt: '2026-06-01T17:00:00.000Z' }),
        nowMs
      )
    ).toBe(false);
  });

  it('déjà répondue → plus en attente', () => {
    expect(isPending(pair({}, { status: 'accepted' }), nowMs)).toBe(false);
  });

  it('roulage annulé → plus en attente', () => {
    expect(isPending(pair({ status: 'cancelled' }), nowMs)).toBe(false);
  });
});

describe('isAttended', () => {
  it('acceptée et non annulée → présence confirmée', () => {
    expect(isAttended(pair({ status: 'done' }, { status: 'accepted' }))).toBe(true);
  });
  it('acceptée mais annulée → non comptée', () => {
    expect(isAttended(pair({ status: 'cancelled' }, { status: 'accepted' }))).toBe(false);
  });
  it('déclinée → non comptée', () => {
    expect(isAttended(pair({ status: 'done' }, { status: 'declined' }))).toBe(false);
  });
});

describe('historyStatusLabel', () => {
  it('roulage annulé prime', () => {
    expect(historyStatusLabel(pair({ status: 'cancelled' }, { status: 'accepted' }))).toBe(
      'Annulé'
    );
  });
  it('présence confirmée', () => {
    expect(historyStatusLabel(pair({ status: 'done' }, { status: 'accepted' }))).toBe('Présent');
  });
  it('absence', () => {
    expect(historyStatusLabel(pair({ status: 'done' }, { status: 'declined' }))).toBe('Absent');
  });
  it('passé sans réponse → Passé', () => {
    expect(historyStatusLabel(pair({ status: 'done' }, { status: 'invited' }))).toBe('Passé');
  });
});

// --- Roulé ensemble --------------------------------------------------------

describe('rolledTogetherByCoach', () => {
  const coachesById = new Map<string, CoachRef>([
    [COACH_A.coachId, COACH_A],
    [COACH_B.coachId, COACH_B],
  ]);

  it('compte les présences confirmées par coach résolu, trié décroissant', () => {
    const pairs = [
      pair({ id: 'r1', coachId: 'coach-a', status: 'done' }, { id: 'i1', status: 'accepted' }),
      pair({ id: 'r2', coachId: 'coach-a', status: 'done' }, { id: 'i2', status: 'accepted' }),
      pair({ id: 'r3', coachId: 'coach-b', status: 'done' }, { id: 'i3', status: 'accepted' }),
      // déclinée : ignorée
      pair({ id: 'r4', coachId: 'coach-b', status: 'done' }, { id: 'i4', status: 'declined' }),
    ];
    const rows = rolledTogetherByCoach(pairs, coachesById);
    expect(rows).toEqual([
      { coachId: 'coach-a', name: 'Léa Marchand', initials: 'LM', count: 2 },
      { coachId: 'coach-b', name: 'bruno@oxv.fr', initials: 'B', count: 1 },
    ]);
  });

  it('ignore un coach non résolu (aucune attribution à l’aveugle)', () => {
    const pairs = [
      pair({ id: 'r1', coachId: 'coach-x', status: 'done' }, { id: 'i1', status: 'accepted' }),
    ];
    expect(rolledTogetherByCoach(pairs, coachesById)).toEqual([]);
  });

  it('aucune donnée chronométrique n’entre dans le calcul (fait de présence)', () => {
    // Le type PilotInvitationPair n’expose aucun champ de chrono : la garantie
    // est structurelle. On confirme qu’un pilote « présent » compte 1, point.
    const rows = rolledTogetherByCoach(
      [pair({ id: 'r1', coachId: 'coach-a', status: 'done' }, { status: 'accepted' })],
      coachesById
    );
    expect(rows[0].count).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['coachId', 'count', 'initials', 'name']);
  });
});

// --- Vue complète ----------------------------------------------------------

describe('buildRoulagesView', () => {
  const coachesById = new Map<string, CoachRef>([[COACH_A.coachId, COACH_A]]);

  it('sépare à venir / historique et trie (à venir asc, historique desc)', () => {
    const pairs = [
      // à venir (deux dates → tri croissant)
      pair({ id: 'r-late', startsAt: '2026-09-10T09:00:00.000Z', endsAt: null }, { id: 'i1' }),
      pair({ id: 'r-soon', startsAt: '2026-08-05T09:00:00.000Z', endsAt: null }, { id: 'i2' }),
      // historique (passé accepté + annulé)
      pair(
        {
          id: 'r-old',
          startsAt: '2026-06-01T09:00:00.000Z',
          endsAt: '2026-06-01T17:00:00.000Z',
          status: 'done',
        },
        { id: 'i3', status: 'accepted' }
      ),
      pair(
        { id: 'r-cancel', startsAt: '2026-10-01T09:00:00.000Z', status: 'cancelled' },
        { id: 'i4' }
      ),
    ];
    const view = buildRoulagesView(pairs, coachesById, NOW);

    expect(view.pending.map((c) => c.roulageId)).toEqual(['r-soon', 'r-late']);
    expect(view.history.map((c) => c.roulageId)).toEqual(['r-cancel', 'r-old']);
    expect(view.rolledTogether).toEqual([
      { coachId: 'coach-a', name: 'Léa Marchand', initials: 'LM', count: 1 },
    ]);
  });

  it('résout le coach sur chaque carte à venir', () => {
    const view = buildRoulagesView([pair({ id: 'r1' }, { id: 'i1' })], coachesById, NOW);
    expect(view.pending[0].coach).toEqual({
      coachId: 'coach-a',
      name: 'Léa Marchand',
      initials: 'LM',
    });
  });
});
