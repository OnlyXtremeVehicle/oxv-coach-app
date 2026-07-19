import {
  enqueue,
  enqueueIncident,
  INCIDENT_QUEUE_KEY,
  loadQueue,
  parseQueue,
  removeById,
  replayQueue,
  saveQueue,
  serializeQueue,
  type KVStorage,
  type PendingIncident,
} from '../incidentOffline';

/** MMKV factice adossé à une Map (mêmes signatures que react-native-mmkv). */
function fakeStorage(): KVStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getString: (k) => map.get(k),
    set: (k, v) => {
      map.set(k, v);
    },
    delete: (k) => {
      map.delete(k);
    },
  };
}

function incident(localId: string, over: Partial<PendingIncident> = {}): PendingIncident {
  return {
    localId,
    sessionId: 's1',
    occurredAt: '2026-07-19T14:10:00.000Z',
    description: 'Sortie de piste au virage 4, sans dommage.',
    photoUri: null,
    queuedAt: '2026-07-19T14:11:00.000Z',
    ...over,
  };
}

describe('parseQueue — robustesse', () => {
  it('rend [] sur entrée vide, JSON invalide ou non-tableau', () => {
    expect(parseQueue(undefined)).toEqual([]);
    expect(parseQueue('')).toEqual([]);
    expect(parseQueue('{pas du json')).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
  });
  it('écarte les entrées inexploitables (sans localId/description)', () => {
    const raw = JSON.stringify([
      incident('ok'),
      { localId: '', description: 'x', occurredAt: 'y' },
      { description: 'orpheline', occurredAt: 'y' },
    ]);
    const parsed = parseQueue(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].localId).toBe('ok');
  });
  it('sérialise puis désérialise fidèlement', () => {
    const q = [incident('a'), incident('b')];
    expect(parseQueue(serializeQueue(q))).toEqual(q);
  });
});

describe('enqueue / removeById — idempotence par uuid local', () => {
  it('ajoute une nouvelle entrée', () => {
    const q = enqueue([], incident('a'));
    expect(q).toHaveLength(1);
  });
  it('ne duplique jamais un même localId', () => {
    const q1 = enqueue(
      [incident('a')],
      incident('a', { description: 'variante ignorée mais longue' })
    );
    expect(q1).toHaveLength(1);
    expect(q1[0].description).toContain('Sortie de piste');
  });
  it('retire par localId sans toucher aux autres', () => {
    const q = removeById([incident('a'), incident('b')], 'a');
    expect(q.map((x) => x.localId)).toEqual(['b']);
  });
});

describe('enqueueIncident — persistance MMKV injectée', () => {
  it('persiste la file dédupliquée sous la clé du registre', () => {
    const storage = fakeStorage();
    enqueueIncident(storage, incident('a'));
    enqueueIncident(storage, incident('a')); // doublon idempotent
    enqueueIncident(storage, incident('b'));
    expect(loadQueue(storage).map((x) => x.localId)).toEqual(['a', 'b']);
    expect(storage.map.has(INCIDENT_QUEUE_KEY)).toBe(true);
  });
});

describe('replayQueue — rejeu au retour réseau', () => {
  it('envoie tout et vide la file quand tout réussit', async () => {
    const storage = fakeStorage();
    saveQueue(storage, [incident('a'), incident('b')]);
    const seen: string[] = [];
    const res = await replayQueue(storage, async (item) => {
      seen.push(item.localId);
      return { ok: true };
    });
    expect(seen).toEqual(['a', 'b']);
    expect(res.sent).toEqual(['a', 'b']);
    expect(res.remaining).toEqual([]);
    expect(loadQueue(storage)).toEqual([]);
  });

  it('garde les échecs en file, retire les succès (persistance incrémentale)', async () => {
    const storage = fakeStorage();
    saveQueue(storage, [incident('a'), incident('b'), incident('c')]);
    const res = await replayQueue(storage, async (item) => ({ ok: item.localId !== 'b' }));
    expect(res.sent).toEqual(['a', 'c']);
    expect(res.remaining.map((x) => x.localId)).toEqual(['b']);
    expect(loadQueue(storage).map((x) => x.localId)).toEqual(['b']);
  });

  it('traite un reporter qui rejette comme un échec (entrée conservée)', async () => {
    const storage = fakeStorage();
    saveQueue(storage, [incident('a')]);
    const res = await replayQueue(storage, async () => {
      throw new Error('réseau coupé');
    });
    expect(res.sent).toEqual([]);
    expect(loadQueue(storage).map((x) => x.localId)).toEqual(['a']);
  });

  it('ne renvoie pas ce qui est déjà parti si on rejoue après une reprise partielle', async () => {
    const storage = fakeStorage();
    saveQueue(storage, [incident('a'), incident('b')]);
    // 1er rejeu : a réussit, b échoue.
    await replayQueue(storage, async (item) => ({ ok: item.localId === 'a' }));
    // 2e rejeu : seul b doit être retenté.
    const seen: string[] = [];
    await replayQueue(storage, async (item) => {
      seen.push(item.localId);
      return { ok: true };
    });
    expect(seen).toEqual(['b']);
    expect(loadQueue(storage)).toEqual([]);
  });
});
