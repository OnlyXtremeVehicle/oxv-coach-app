import type { KVStorage } from '@/features/rec/biometryCaptureBuffer';
import {
  loadPendingSessions,
  loadSamples,
  persistSamples,
} from '@/features/rec/biometryCaptureBuffer';
import type { HeartRateSample } from '@/services/v2/heartRateParser';
import {
  type BiometryCaptureDeps,
  discardBiometryCapture,
  flushPendingBiometry,
  startBiometryCapture,
  stopBiometryCapture,
} from '@/services/biometryCaptureRunner';

function fakeStorage(): KVStorage {
  const m = new Map<string, string>();
  return {
    getString: (k) => m.get(k),
    set: (k, v) => void m.set(k, v),
    delete: (k) => void m.delete(k),
  };
}

function makeEmitter() {
  let cb: ((s: HeartRateSample) => void) | null = null;
  return {
    onBiometry: (fn: (s: HeartRateSample) => void) => {
      cb = fn;
      return () => {
        cb = null;
      };
    },
    emit: (s: HeartRateSample) => cb?.(s),
    subscribed: () => cb !== null,
  };
}

function hr(hrBpm: number, contact: HeartRateSample['contact'] = 'ok'): HeartRateSample {
  return { hrBpm, contact, rrMs: [] };
}

/** Deps de base : flag ON, consentement capture ON, tout injecté. */
function deps(over: Partial<BiometryCaptureDeps> = {}): {
  d: Partial<BiometryCaptureDeps>;
  saved: { sessionId: string; count: number }[];
} {
  const saved: { sessionId: string; count: number }[] = [];
  const d: Partial<BiometryCaptureDeps> = {
    storage: fakeStorage(),
    isFlagEnabled: async () => true,
    loadConsents: async () => ({ capture: true }),
    saveSamples: async (sessionId, samples) => {
      saved.push({ sessionId, count: samples.length });
      return { saved: samples.length };
    },
    nowMs: () => 1000,
    ...over,
  };
  return { d, saved };
}

afterEach(() => {
  discardBiometryCapture(); // remet l'état module à zéro entre les tests
});

describe('biometryCaptureRunner — verrous fail-closed', () => {
  it('flag OFF → dormant : aucun abonnement, aucune préservation', async () => {
    const em = makeEmitter();
    const { d, saved } = deps({ isFlagEnabled: async () => false, onBiometry: em.onBiometry });
    await startBiometryCapture({ sessionId: 'S', pilotId: 'P' }, d);
    expect(em.subscribed()).toBe(false); // rien n'écoute la santé
    em.emit(hr(150));
    await stopBiometryCapture();
    expect(saved).toHaveLength(0);
  });

  it('consentement capture absent → dormant', async () => {
    const em = makeEmitter();
    const { d, saved } = deps({
      loadConsents: async () => ({ capture: false }),
      onBiometry: em.onBiometry,
    });
    await startBiometryCapture({ sessionId: 'S', pilotId: 'P' }, d);
    expect(em.subscribed()).toBe(false);
    await stopBiometryCapture();
    expect(saved).toHaveLength(0);
  });

  it('flag + consentement ON → capture, puis préserve à l’arrêt et PURGE le local', async () => {
    const em = makeEmitter();
    const { d, saved } = deps({ onBiometry: em.onBiometry });
    await startBiometryCapture({ sessionId: 'S', pilotId: 'P' }, d);
    expect(em.subscribed()).toBe(true);
    em.emit(hr(150));
    em.emit(hr(152));
    await stopBiometryCapture();
    expect(saved).toEqual([{ sessionId: 'S', count: 2 }]);
    // Minimisation : après préservation confirmée, le local est vidé.
    expect(loadSamples(d.storage!, 'S')).toEqual([]);
    expect(loadPendingSessions(d.storage!)).toEqual([]);
  });

  it('abandon → purge le local, ne préserve JAMAIS', async () => {
    const em = makeEmitter();
    const { d, saved } = deps({ onBiometry: em.onBiometry });
    await startBiometryCapture({ sessionId: 'S', pilotId: 'P' }, d);
    em.emit(hr(150));
    discardBiometryCapture();
    expect(saved).toHaveLength(0);
    expect(loadPendingSessions(d.storage!)).toEqual([]);
  });

  it('préservation hors-ligne : saveSamples échoue → le local est CONSERVÉ pour rejeu', async () => {
    const em = makeEmitter();
    const { d } = deps({
      onBiometry: em.onBiometry,
      saveSamples: async () => {
        throw new Error('offline');
      },
    });
    await startBiometryCapture({ sessionId: 'S', pilotId: 'P' }, d);
    em.emit(hr(150));
    await stopBiometryCapture();
    // Échec réseau : rien n'est perdu, la séance reste en attente.
    expect(loadSamples(d.storage!, 'S')).toHaveLength(1);
    expect(loadPendingSessions(d.storage!)).toEqual(['S']);
  });

  it('flushPendingBiometry rejoue une séance orpheline et la purge au succès', async () => {
    const em = makeEmitter();
    let online = false;
    const saved: string[] = [];
    const d: Partial<BiometryCaptureDeps> = {
      storage: fakeStorage(),
      isFlagEnabled: async () => true,
      loadConsents: async () => ({ capture: true }),
      onBiometry: em.onBiometry,
      saveSamples: async (sessionId) => {
        if (!online) throw new Error('offline');
        saved.push(sessionId);
        return { saved: 1 };
      },
      nowMs: () => 1000,
    };
    // 1re séance capturée hors-ligne → reste en attente.
    await startBiometryCapture({ sessionId: 'S1', pilotId: 'P' }, d);
    em.emit(hr(150));
    await stopBiometryCapture();
    expect(loadPendingSessions(d.storage!)).toEqual(['S1']);
    // Réseau revenu : le rejeu préserve puis purge.
    online = true;
    await flushPendingBiometry('P', d);
    expect(saved).toEqual(['S1']);
    expect(loadPendingSessions(d.storage!)).toEqual([]);
  });

  it('flag OFF au rejeu → ne touche pas la santé (aucune préservation)', async () => {
    const em = makeEmitter();
    const st = fakeStorage();
    const saved: string[] = [];
    // Amorce un pending avec le flag ON.
    await startBiometryCapture(
      { sessionId: 'S1', pilotId: 'P' },
      {
        storage: st,
        isFlagEnabled: async () => true,
        loadConsents: async () => ({ capture: true }),
        onBiometry: em.onBiometry,
        saveSamples: async () => {
          throw new Error('offline');
        },
        nowMs: () => 1000,
      }
    );
    em.emit(hr(150));
    await stopBiometryCapture();
    expect(loadPendingSessions(st)).toEqual(['S1']);
    // Flag retiré : le rejeu ne fait rien.
    await flushPendingBiometry('P', {
      storage: st,
      isFlagEnabled: async () => false,
      loadConsents: async () => ({ capture: true }),
      saveSamples: async (sid: string) => {
        saved.push(sid);
        return { saved: 1 };
      },
    });
    expect(saved).toEqual([]);
    expect(loadPendingSessions(st)).toEqual(['S1']); // toujours en attente
  });

  /**
   * ===========================================================================
   * LE RETRAIT DE CONSENTEMENT — CE QUI N'ÉTAIT PAS TESTÉ, ET NE MARCHAIT PAS
   * ===========================================================================
   *
   * Le consentement n'était lu QU'UNE FOIS, à l'armement. Un pilote qui
   * décochait « Capter ma fréquence cardiaque » entre deux runs voyait quand
   * même son tampon téléversé à la clôture.
   *
   * Le document validé par le conseil promet pourtant : « à la révocation, la
   * mesure s'arrête et la lecture des données cesse immédiatement ».
   */
  it('un consentement retiré empêche le téléversement ET purge le local', async () => {
    const em = makeEmitter();
    const st = fakeStorage();
    const saved: string[] = [];
    let consenti = true;

    await startBiometryCapture(
      { sessionId: 'S1', pilotId: 'P' },
      {
        storage: st,
        isFlagEnabled: async () => true,
        loadConsents: async () => ({ capture: consenti }),
        onBiometry: em.onBiometry,
        saveSamples: async (sid: string) => {
          saved.push(sid);
          return { saved: 1 };
        },
        nowMs: () => 1000,
      }
    );
    em.emit(hr(150));

    // Le pilote décoche entre deux runs.
    consenti = false;
    await stopBiometryCapture();

    expect(saved).toEqual([]); // rien n'a quitté l'appareil
    expect(loadPendingSessions(st)).toEqual([]); // et rien ne reste en local
  });

  it('une séance orpheline d’un pilote qui a retiré son accord est purgée, jamais rejouée', async () => {
    const st = fakeStorage();
    const saved: string[] = [];
    persistSamples(st, 'ORPHELINE', [{ ts: 1000, hrBpm: 150, rrMs: [], contact: 'ok' as const }]);

    await flushPendingBiometry('P', {
      storage: st,
      isFlagEnabled: async () => true,
      loadConsents: async () => ({ capture: false }),
      saveSamples: async (sid: string) => {
        saved.push(sid);
        return { saved: 1 };
      },
    });

    expect(saved).toEqual([]);
    expect(loadPendingSessions(st)).toEqual([]);
  });

  /**
   * FAIL-CLOSED SUR L'ENVOI, PAS SUR LE LOCAL. Une panne réseau n'est pas un
   * retrait de consentement : purger le tampon détruirait une donnée que le
   * pilote a acceptée de fournir. On ne téléverse pas, on garde, on rejouera.
   */
  it('un consentement illisible ne téléverse rien et ne purge rien', async () => {
    const st = fakeStorage();
    const saved: string[] = [];
    persistSamples(st, 'S9', [{ ts: 1000, hrBpm: 150, rrMs: [], contact: 'ok' as const }]);

    await flushPendingBiometry('P', {
      storage: st,
      isFlagEnabled: async () => true,
      loadConsents: async () => {
        throw new Error('offline');
      },
      saveSamples: async (sid: string) => {
        saved.push(sid);
        return { saved: 1 };
      },
    });

    expect(saved).toEqual([]);
    expect(loadPendingSessions(st)).toEqual(['S9']); // gardé pour un rejeu
  });
});
