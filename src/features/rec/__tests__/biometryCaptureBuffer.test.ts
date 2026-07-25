import type { BioSample } from '@/services/v2/biometryBufferLogic';
import {
  type KVStorage,
  clearSession,
  loadPendingSessions,
  loadSamples,
  parsePending,
  parseSamples,
  persistSamples,
  samplesKey,
  toBiometryInput,
} from '@/features/rec/biometryCaptureBuffer';

/** Faux MMKV en mémoire (mêmes garanties synchrones que le réel injecté). */
function fakeStorage(): KVStorage & { dump: () => Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getString: (k) => m.get(k),
    set: (k, v) => void m.set(k, v),
    delete: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

function s(over: Partial<BioSample> & { ts: number }): BioSample {
  return {
    hrBpm: over.hrBpm ?? 150,
    rrMs: over.rrMs ?? [],
    contact: over.contact ?? 'ok',
    ts: over.ts,
  };
}

describe('biometryCaptureBuffer — réducteurs purs', () => {
  it('parseSamples : JSON invalide / non-array → []', () => {
    expect(parseSamples(undefined)).toEqual([]);
    expect(parseSamples('')).toEqual([]);
    expect(parseSamples('{oops')).toEqual([]);
    expect(parseSamples('{"a":1}')).toEqual([]);
  });

  it('parseSamples : écarte les entrées mal formées, garde les valides', () => {
    const raw = JSON.stringify([
      { ts: 1, hrBpm: 150, rrMs: [800], contact: 'ok' },
      { ts: 'x', hrBpm: 150, rrMs: [], contact: 'ok' }, // ts invalide
      { ts: 2, hrBpm: 'z', rrMs: [], contact: 'ok' }, // hr invalide
      { ts: 3, hrBpm: 140, rrMs: [810], contact: 'poor' },
    ]);
    const out = parseSamples(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ ts: 1, hrBpm: 150, rrMs: [800], contact: 'ok' });
    expect(out[1].contact).toBe('poor');
  });

  it('parsePending : JSON invalide → [] ; filtre les non-chaînes', () => {
    expect(parsePending(undefined)).toEqual([]);
    expect(parsePending(JSON.stringify(['a', 2, '', 'b']))).toEqual(['a', 'b']);
  });

  it('toBiometryInput : écarte les FC non physiologiques ([25,250]) — sinon l’upsert échouerait', () => {
    const input = toBiometryInput([
      s({ ts: 1, hrBpm: 0 }), // décrochage → écarté
      s({ ts: 2, hrBpm: 300 }), // aberrant → écarté
      s({ ts: 3, hrBpm: 150 }),
      s({ ts: 4, hrBpm: 25 }), // borne basse OK
      s({ ts: 5, hrBpm: 250 }), // borne haute OK
    ]);
    expect(input.map((i) => i.hr)).toEqual([150, 25, 250]);
  });

  it('toBiometryInput : rrMs vide → null ; ts et hr propagés', () => {
    const input = toBiometryInput([
      s({ ts: 10, hrBpm: 140, rrMs: [] }),
      s({ ts: 11, hrBpm: 141, rrMs: [820] }),
    ]);
    expect(input[0]).toMatchObject({ ts: 10, hr: 140, rrMs: null });
    expect(input[1].rrMs).toEqual([820]);
  });

  it('toBiometryInput : chaque insert porte la qualité de séance (0-100 ou null), jamais fabriquée', () => {
    const input = toBiometryInput([s({ ts: 1, contact: 'ok' }), s({ ts: 2, contact: 'ok' })], 2000);
    expect(input.every((i) => typeof i.quality === 'number' || i.quality === null)).toBe(true);
  });

  it('toBiometryInput : aucune lecture exploitable → []', () => {
    expect(toBiometryInput([s({ ts: 1, hrBpm: 0 })])).toEqual([]);
    expect(toBiometryInput([])).toEqual([]);
  });
});

describe('biometryCaptureBuffer — registre MMKV injecté', () => {
  it('persist puis load : round-trip fidèle', () => {
    const st = fakeStorage();
    const samples = [s({ ts: 1, hrBpm: 150 }), s({ ts: 2, hrBpm: 152 })];
    persistSamples(st, 'sess-A', samples);
    expect(loadSamples(st, 'sess-A')).toEqual(samples);
  });

  it('persist inscrit la séance au registre en attente (idempotent)', () => {
    const st = fakeStorage();
    persistSamples(st, 'sess-A', [s({ ts: 1 })]);
    persistSamples(st, 'sess-A', [s({ ts: 1 }), s({ ts: 2 })]); // ré-écrit, pas de doublon d'ID
    persistSamples(st, 'sess-B', [s({ ts: 3 })]);
    expect(loadPendingSessions(st).sort()).toEqual(['sess-A', 'sess-B']);
  });

  it('clearSession : efface les échantillons ET retire du registre', () => {
    const st = fakeStorage();
    persistSamples(st, 'sess-A', [s({ ts: 1 })]);
    persistSamples(st, 'sess-B', [s({ ts: 2 })]);
    clearSession(st, 'sess-A');
    expect(loadSamples(st, 'sess-A')).toEqual([]);
    expect(st.dump()[samplesKey('sess-A')]).toBeUndefined();
    expect(loadPendingSessions(st)).toEqual(['sess-B']);
  });
});
