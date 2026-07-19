/**
 * Tests purs — logique de l'écran PRÉPARATION (V2-L2, 2/8).
 *
 * Points verrouillés (exigés par le prompt L2) : progression x/N de la
 * check-list, mapping des inscrits « Qui roule » (dédup + tri + défensif),
 * gating fail-closed du convoi. Plus : hydratation MMKV tolérante, bascule,
 * sélection du pass, état du compte à rebours.
 */

import {
  CHECKLIST_ITEMS,
  checklistProgress,
  checklistStorageKey,
  convoyGate,
  filterByCrew,
  heroCountdownKind,
  hydrateChecklist,
  mapAttendanceRows,
  pickActivePass,
  qrCheckinPayload,
  serializeChecklist,
  toggleChecklistAt,
  type AttendanceRow,
  type PassCandidate,
} from '../preparationLogic';

describe('checklistProgress — barre x/N', () => {
  it('aucune coche → 0/N, ratio 0', () => {
    const p = checklistProgress(CHECKLIST_ITEMS.map(() => false));
    expect(p).toEqual({ done: 0, total: CHECKLIST_ITEMS.length, ratio: 0 });
  });

  it('toutes cochées → N/N, ratio 1', () => {
    const p = checklistProgress(CHECKLIST_ITEMS.map(() => true));
    expect(p.done).toBe(CHECKLIST_ITEMS.length);
    expect(p.ratio).toBe(1);
  });

  it('partiel → done exact et ratio proportionnel', () => {
    const p = checklistProgress([true, false, true, false]);
    expect(p.done).toBe(2);
    expect(p.total).toBe(4);
    expect(p.ratio).toBeCloseTo(0.5, 5);
  });

  it('ne compte jamais au-delà de total (état plus long que N)', () => {
    const p = checklistProgress([true, true, true, true, true, true], 4);
    expect(p.done).toBe(4);
    expect(p.total).toBe(4);
  });

  it('total 0 → ratio 0 sans division par zéro', () => {
    expect(checklistProgress([], 0)).toEqual({ done: 0, total: 0, ratio: 0 });
  });
});

describe('hydrateChecklist / serialize / toggle — persistance MMKV', () => {
  it('absent → tout décoché de bonne longueur', () => {
    expect(hydrateChecklist(null, 4)).toEqual([false, false, false, false]);
    expect(hydrateChecklist(undefined)).toHaveLength(CHECKLIST_ITEMS.length);
  });

  it('JSON corrompu → tout décoché (jamais de crash)', () => {
    expect(hydrateChecklist('{pas du json', 3)).toEqual([false, false, false]);
  });

  it('longueur stockée < N → complété par false ; > N → tronqué', () => {
    expect(hydrateChecklist(JSON.stringify([true]), 3)).toEqual([true, false, false]);
    expect(hydrateChecklist(JSON.stringify([true, true, true, true]), 2)).toEqual([true, true]);
  });

  it('valeurs non booléennes ne cochent pas (seul true coche)', () => {
    expect(hydrateChecklist(JSON.stringify([1, 'x', null, true]), 4)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it('round-trip serialize → hydrate stable', () => {
    const state = [true, false, true, false];
    expect(hydrateChecklist(serializeChecklist(state), 4)).toEqual(state);
  });

  it('toggle bascule uniquement l’index visé', () => {
    expect(toggleChecklistAt([false, false, false], 1)).toEqual([false, true, false]);
    expect(toggleChecklistAt([true, true], 5)).toEqual([true, true]);
  });

  it('clé MMKV namespacée par pilote', () => {
    expect(checklistStorageKey('u1')).toBe('prep:checklist:u1');
    expect(checklistStorageKey(null)).toBe('prep:checklist:anon');
  });
});

describe('mapAttendanceRows — inscrits « Qui roule »', () => {
  const row = (over: Partial<AttendanceRow>): AttendanceRow => ({
    user_id: 'u',
    public_handle: null,
    avatar_url: null,
    crew_id: null,
    ...over,
  });

  it('mappe snake_case → camelCase et marque soi', () => {
    const out = mapAttendanceRows(
      [row({ user_id: 'me', public_handle: 'zoe', avatar_url: 'http://a', crew_id: 'c1' })],
      { selfUserId: 'me' }
    );
    expect(out).toEqual([
      { userId: 'me', handle: 'zoe', avatarUrl: 'http://a', crewId: 'c1', isSelf: true },
    ]);
  });

  it('déduplique par user_id (pilote multi-écurie via LEFT JOIN)', () => {
    const out = mapAttendanceRows([
      row({ user_id: 'u1', public_handle: 'ana', crew_id: 'cA' }),
      row({ user_id: 'u1', public_handle: 'ana', crew_id: 'cB' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].crewId).toBe('cA'); // première occurrence conservée
  });

  it('trie soi d’abord puis @handle alpha, handles nuls en fin', () => {
    const out = mapAttendanceRows(
      [
        row({ user_id: 'b', public_handle: 'bruno' }),
        row({ user_id: 'z', public_handle: null }),
        row({ user_id: 'a', public_handle: 'ana' }),
        row({ user_id: 'me', public_handle: 'yann' }),
      ],
      { selfUserId: 'me' }
    );
    expect(out.map((m) => m.userId)).toEqual(['me', 'a', 'b', 'z']);
  });

  it('défensif : rejette lignes sans user_id, chaînes vides → null', () => {
    const out = mapAttendanceRows([
      null,
      42,
      { user_id: '' },
      { user_id: 'ok', public_handle: '', avatar_url: '' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ userId: 'ok', handle: null, avatarUrl: null });
  });
});

describe('filterByCrew — chip « Mon groupe »', () => {
  const members = [
    { userId: 'a', handle: 'a', avatarUrl: null, crewId: 'c1', isSelf: false },
    { userId: 'b', handle: 'b', avatarUrl: null, crewId: 'c2', isSelf: false },
    { userId: 'c', handle: 'c', avatarUrl: null, crewId: null, isSelf: false },
  ];

  it('crewId null → tout le monde (copie)', () => {
    expect(filterByCrew(members, null)).toHaveLength(3);
  });

  it('crewId donné → uniquement la même écurie', () => {
    expect(filterByCrew(members, 'c1').map((m) => m.userId)).toEqual(['a']);
  });
});

describe('convoyGate — fail-closed', () => {
  it('vrai seulement si flag === true', () => {
    expect(convoyGate(true)).toBe(true);
    expect(convoyGate(false)).toBe(false);
    expect(convoyGate(null)).toBe(false);
    expect(convoyGate(undefined)).toBe(false);
  });
});

describe('pickActivePass — pass à présenter', () => {
  const NOW = Date.parse('2026-07-19T09:00:00Z');
  const cand = (over: Partial<PassCandidate>): PassCandidate => ({
    registrationId: 'r',
    status: 'registered',
    event: { startsAt: '2026-07-19T08:00:00Z', endsAt: '2026-07-19T18:00:00Z' },
    ...over,
  });

  it('retient un événement en cours, inscrit', () => {
    expect(pickActivePass([cand({})], NOW)?.registrationId).toBe('r');
  });

  it('écarte statut annulé et événement terminé', () => {
    const regs = [
      cand({ registrationId: 'cancelled', status: 'cancelled' }),
      cand({
        registrationId: 'past',
        event: { startsAt: '2026-07-01T08:00:00Z', endsAt: '2026-07-01T18:00:00Z' },
      }),
    ];
    expect(pickActivePass(regs, NOW)).toBeNull();
  });

  it('choisit le plus proche dans le temps', () => {
    const regs = [
      cand({
        registrationId: 'later',
        event: { startsAt: '2026-07-25T08:00:00Z', endsAt: '2026-07-25T18:00:00Z' },
      }),
      cand({ registrationId: 'today' }),
    ];
    expect(pickActivePass(regs, NOW)?.registrationId).toBe('today');
  });

  it('événement null → écarté', () => {
    expect(pickActivePass([cand({ event: null })], NOW)).toBeNull();
  });
});

describe('qrCheckinPayload — charge utile', () => {
  it('préfixe oxv:checkin:<id>', () => {
    expect(qrCheckinPayload('abc')).toBe('oxv:checkin:abc');
  });
});

describe('heroCountdownKind — héros journée', () => {
  it('null → none, 0 ou passé → today, positif → countdown', () => {
    expect(heroCountdownKind(null)).toBe('none');
    expect(heroCountdownKind(0)).toBe('today');
    expect(heroCountdownKind(-2)).toBe('today');
    expect(heroCountdownKind(3)).toBe('countdown');
  });
});
