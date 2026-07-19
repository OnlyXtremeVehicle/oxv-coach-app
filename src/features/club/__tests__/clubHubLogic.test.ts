/**
 * Tests — logique pure du CLUB HUB (V2-L5). Verrou DOCTRINAL central :
 * le fil de faits d'écurie ne laisse JAMAIS passer un chrono d'autrui.
 */

import {
  bookingWhenLabel,
  crewCardTitle,
  crewFactFeed,
  crewFactLine,
  crewOwnerName,
  frenchWeekday,
  memberDisplayName,
  messagePreview,
  relativeDayLabel,
  shortDayLabel,
  type CrewMemberProfile,
} from '../clubHubLogic';

const PIERRE: CrewMemberProfile = {
  userId: 'u1',
  firstName: 'Pierre',
  handle: 'pierrot',
  avatarUrl: null,
  role: 'member',
};

describe('frenchWeekday', () => {
  it('rend le bon jour de semaine (jeudi 16 juil. 2026)', () => {
    expect(frenchWeekday('2026-07-16')).toBe('jeudi');
    expect(frenchWeekday('2026-07-17')).toBe('vendredi');
    expect(frenchWeekday('2026-07-18')).toBe('samedi');
    expect(frenchWeekday('2026-07-19')).toBe('dimanche');
  });
  it('renvoie null sur une date illisible', () => {
    expect(frenchWeekday('pas-une-date')).toBeNull();
  });
});

describe('relativeDayLabel', () => {
  it("distingue aujourd'hui, hier, la semaine, l'ancien", () => {
    expect(relativeDayLabel('2026-07-19', '2026-07-19')).toBe("aujourd'hui");
    expect(relativeDayLabel('2026-07-18', '2026-07-19')).toBe('hier');
    expect(relativeDayLabel('2026-07-16', '2026-07-19')).toBe('jeudi');
    expect(relativeDayLabel('2026-06-10', '2026-07-19')).toBe('le 10 juin');
  });
});

describe('shortDayLabel', () => {
  it('rend « dim. 19 juil. »', () => {
    expect(shortDayLabel('2026-07-19')).toBe('dim. 19 juil.');
  });
});

describe('memberDisplayName', () => {
  it('privilégie le prénom, puis @handle, puis « Un pilote »', () => {
    expect(memberDisplayName(PIERRE)).toBe('Pierre');
    expect(memberDisplayName({ ...PIERRE, firstName: null })).toBe('@pierrot');
    expect(memberDisplayName({ ...PIERRE, firstName: null, handle: null })).toBe('Un pilote');
  });
});

describe('crewOwnerName / crewCardTitle', () => {
  const members: CrewMemberProfile[] = [
    PIERRE,
    { userId: 'u2', firstName: 'Alice', handle: null, avatarUrl: null, role: 'captain' },
  ];
  it('résout le capitaine', () => {
    expect(crewOwnerName(members)).toBe('Alice');
    expect(crewOwnerName([PIERRE])).toBeNull();
  });
  it('titre : nom d’écurie > « Le groupe de {owner} » > repli neutre', () => {
    expect(crewCardTitle('Les Sangliers', 'Alice')).toBe('Les Sangliers');
    expect(crewCardTitle(null, 'Alice')).toBe('Le groupe de Alice');
    expect(crewCardTitle(null, null)).toBe('Votre écurie');
  });
});

describe('crewFactFeed — DOCTRINE : le fait de rouler, jamais le chrono', () => {
  it('n’expose AUCUN chrono même si la présence brute en transporte un', () => {
    // Ligne brute polluée par des champs de performance (comme si une source
    // future les ajoutait). Ils NE DOIVENT PAS traverser.
    const rows = [
      {
        userId: 'u1',
        dayIso: '2026-07-16',
        circuitName: 'Haute Saintonge',
        bestMs: 92345,
        lapMs: 92345,
        chrono: '1:32.345',
        speedKmh: 210,
        position: 1,
      },
    ] as unknown as Parameters<typeof crewFactFeed>[1];

    const facts = crewFactFeed([PIERRE], rows, { nowIso: '2026-07-19' });
    expect(facts).toHaveLength(1);

    const fact = facts[0];
    expect(fact.displayName).toBe('Pierre');
    expect(fact.dayLabel).toBe('jeudi');
    expect(fact.circuitName).toBe('Haute Saintonge');

    // Aucune clé de performance sur le fait produit.
    for (const forbidden of ['bestMs', 'lapMs', 'chrono', 'speedKmh', 'position']) {
      expect(fact).not.toHaveProperty(forbidden);
    }
    // Aucune valeur de performance dans la sérialisation.
    const serialized = JSON.stringify(facts);
    for (const needle of ['92345', '1:32', 'chrono', 'speedKmh', 'position', '210']) {
      expect(serialized).not.toContain(needle);
    }

    // La ligne rendue est un FAIT, sans motif de temps au tour.
    const line = crewFactLine(fact);
    expect(line).toBe('Pierre a roulé jeudi · Haute Saintonge');
    expect(line).not.toMatch(/\d+:\d{2}/);
    expect(line).not.toMatch(/\d+\.\d{3}/);
  });

  it('garde un seul fait par membre (le plus récent) et trie décroissant', () => {
    const members: CrewMemberProfile[] = [
      PIERRE,
      { userId: 'u2', firstName: 'Alice', handle: null, avatarUrl: null, role: 'captain' },
    ];
    const rows = [
      { userId: 'u1', dayIso: '2026-07-14', circuitName: 'A' },
      { userId: 'u1', dayIso: '2026-07-16', circuitName: 'B' },
      { userId: 'u2', dayIso: '2026-07-15', circuitName: 'C' },
    ];
    const facts = crewFactFeed(members, rows, { nowIso: '2026-07-19' });
    expect(facts.map((f) => `${f.userId}:${f.dayIso}`)).toEqual(['u1:2026-07-16', 'u2:2026-07-15']);
    // u1 : la présence du 14 est écartée au profit du 16.
    expect(facts[0].circuitName).toBe('B');
  });

  it('ignore les faits d’un non-membre (borne à l’écurie)', () => {
    const rows = [{ userId: 'stranger', dayIso: '2026-07-16', circuitName: 'X' }];
    expect(crewFactFeed([PIERRE], rows, { nowIso: '2026-07-19' })).toHaveLength(0);
  });

  it('respecte la limite', () => {
    const members: CrewMemberProfile[] = Array.from({ length: 6 }, (_, i) => ({
      userId: `m${i}`,
      firstName: `P${i}`,
      handle: null,
      avatarUrl: null,
      role: 'member',
    }));
    const rows = members.map((m, i) => ({
      userId: m.userId,
      dayIso: `2026-07-${String(10 + i).padStart(2, '0')}`,
      circuitName: null,
    }));
    expect(crewFactFeed(members, rows, { nowIso: '2026-07-19', limit: 3 })).toHaveLength(3);
  });
});

describe('crewFactLine', () => {
  it('omet le circuit s’il est inconnu', () => {
    const facts = crewFactFeed(
      [PIERRE],
      [{ userId: 'u1', dayIso: '2026-07-16', circuitName: null }],
      { nowIso: '2026-07-19' }
    );
    expect(crewFactLine(facts[0])).toBe('Pierre a roulé jeudi');
  });
});

describe('bookingWhenLabel', () => {
  it('formate date + heure, ou null', () => {
    expect(bookingWhenLabel('2026-07-19T09:00:00Z')).toBe('dim. 19 juil. · 09:00');
    expect(bookingWhenLabel(null)).toBeNull();
  });
});

describe('messagePreview', () => {
  it('coupe proprement les longs messages, garde les courts, rejette le vide', () => {
    expect(messagePreview('Bonjour')).toBe('Bonjour');
    expect(messagePreview(null)).toBeNull();
    expect(messagePreview('   ')).toBeNull();
    const long = 'a'.repeat(120);
    const out = messagePreview(long, 20);
    expect(out).not.toBeNull();
    expect((out as string).endsWith('…')).toBe(true);
    expect((out as string).length).toBeLessThanOrEqual(20);
  });
});
