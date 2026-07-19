/**
 * Tests — logique pure de l'onglet Amis (club, Mission B).
 *
 * TEST DOCTRINAL EXPLICITE (le cœur de ce lot) : « pas de chrono d'autrui
 * dans le fil ». `toFriendFacts` DOIT dépouiller toute donnée chronométrique
 * d'une séance d'ami — seuls le circuit et la date survivent. Aucun libellé
 * affiché (méta, dernier circuit) ne doit jamais porter un chrono.
 */

import {
  crewMemberIds,
  friendDisplayName,
  friendInitials,
  friendLastCircuit,
  friendMetaLine,
  isInCrew,
  isSearchable,
  normalizeHandleQuery,
  toFriendFacts,
  type FriendSessionFact,
  type FriendSessionInput,
} from '../amisLogic';

// --- DOCTRINE : pas de chrono d'autrui dans le fil -------------------------

describe('toFriendFacts — dépouillement chrono (doctrine)', () => {
  const rows: FriendSessionInput[] = [
    {
      circuitName: 'Haute Saintonge',
      startedAt: '2026-07-16T09:00:00.000Z',
      bestLapSeconds: 82.147,
      maxSpeedKmh: 213,
      marginGlobal: 71,
    },
  ];

  it('ne laisse survivre QUE le circuit et la date', () => {
    const facts = toFriendFacts(rows);
    expect(facts).toEqual([
      { circuitName: 'Haute Saintonge', startedAt: '2026-07-16T09:00:00.000Z' },
    ]);
    expect(Object.keys(facts[0]).sort()).toEqual(['circuitName', 'startedAt']);
  });

  it('aucune valeur ni clé chronométrique ne subsiste (sérialisation)', () => {
    const serialized = JSON.stringify(toFriendFacts(rows));
    expect(serialized).not.toMatch(/bestLap|maxSpeed|margin|82\.147|213|71/i);
  });

  it('gère une séance sans chrono à l’identique', () => {
    const facts = toFriendFacts([{ circuitName: 'Nogaro', startedAt: '2026-05-01T10:00:00.000Z' }]);
    expect(facts).toEqual([{ circuitName: 'Nogaro', startedAt: '2026-05-01T10:00:00.000Z' }]);
  });
});

// --- Dernier circuit factuel ----------------------------------------------

describe('friendLastCircuit', () => {
  it('retient la séance la plus récente PORTANT un circuit', () => {
    const facts: FriendSessionFact[] = [
      { circuitName: 'Nogaro', startedAt: '2026-05-01T10:00:00.000Z' },
      { circuitName: 'Haute Saintonge', startedAt: '2026-07-16T09:00:00.000Z' },
      { circuitName: null, startedAt: '2026-08-01T09:00:00.000Z' },
    ];
    expect(friendLastCircuit(facts)).toEqual({
      circuitLabel: 'Haute Saintonge',
      dateISO: '2026-07-16T09:00:00.000Z',
    });
  });

  it('aucun circuit nommé → libellé null (jamais fabriqué)', () => {
    expect(
      friendLastCircuit([{ circuitName: null, startedAt: '2026-08-01T09:00:00.000Z' }])
    ).toEqual({ circuitLabel: null, dateISO: null });
  });

  it('liste vide → null', () => {
    expect(friendLastCircuit([])).toEqual({ circuitLabel: null, dateISO: null });
  });
});

// --- Identité --------------------------------------------------------------

describe('friendInitials / friendDisplayName', () => {
  it('initiales depuis le @handle (« thomas.m » → TM)', () => {
    expect(friendInitials({ friendId: 'x', friendHandle: 'thomas.m', friendFirstName: null })).toBe(
      'TM'
    );
  });

  it('repli prénom puis identifiant court', () => {
    expect(friendDisplayName({ friendId: 'x', friendHandle: 'zoe', friendFirstName: 'Zoé' })).toBe(
      'Zoé'
    );
    expect(friendDisplayName({ friendId: 'x', friendHandle: 'zoe', friendFirstName: null })).toBe(
      'zoe'
    );
    expect(
      friendDisplayName({ friendId: 'abcdef123', friendHandle: null, friendFirstName: null })
    ).toBe('Pilote abcdef');
  });
});

// --- Ligne méta (jamais de chrono) ----------------------------------------

describe('friendMetaLine', () => {
  it('assemble @handle · dernier circuit', () => {
    expect(friendMetaLine('thomas.m', 'Haute Saintonge')).toBe('@thomas.m · Haute Saintonge');
  });

  it('handle seul si pas de circuit', () => {
    expect(friendMetaLine('thomas.m', null)).toBe('@thomas.m');
  });

  it('vide si rien ne la porte', () => {
    expect(friendMetaLine(null, null)).toBe('');
  });

  it('ne contient jamais de chrono (que des faits)', () => {
    const line = friendMetaLine('lea', 'Nogaro');
    expect(line).not.toMatch(/\d+[.,]\d+\s*s|km\/h|×|marge/i);
  });
});

// --- Écurie ----------------------------------------------------------------

describe('crewMemberIds / isInCrew', () => {
  it('extrait les identifiants membres', () => {
    const ids = crewMemberIds({ members: [{ userId: 'a' }, { userId: 'b' }] });
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('pas d’écurie → ensemble vide, personne dedans', () => {
    const ids = crewMemberIds(null);
    expect(ids.size).toBe(0);
    expect(isInCrew('a', ids)).toBe(false);
  });

  it('détecte l’appartenance', () => {
    const ids = crewMemberIds({ members: [{ userId: 'a' }] });
    expect(isInCrew('a', ids)).toBe(true);
    expect(isInCrew('z', ids)).toBe(false);
  });
});

// --- Recherche @handle -----------------------------------------------------

describe('normalizeHandleQuery / isSearchable', () => {
  it('retire l’arobase et les espaces', () => {
    expect(normalizeHandleQuery('  @Thomas ')).toBe('Thomas');
    expect(normalizeHandleQuery('@@zoe')).toBe('zoe');
  });

  it('recherche seulement à partir de 2 caractères utiles', () => {
    expect(isSearchable('@')).toBe(false);
    // Un seul caractère utile (l’arobase ne compte pas) → pas encore de recherche.
    expect(isSearchable('@z')).toBe(false);
    expect(isSearchable('@zo')).toBe(true);
    expect(isSearchable('zo')).toBe(true);
    expect(isSearchable('  ')).toBe(false);
  });
});
