import type { KVStorage } from '@/features/rec/biometryCaptureBuffer';
import { loadPendingSessions, loadSamples } from '@/features/rec/biometryCaptureBuffer';
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
    await flushPendingBiometry(d);
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
    await flushPendingBiometry({
      storage: st,
      isFlagEnabled: async () => false,
      saveSamples: async (sid) => {
        saved.push(sid);
        return { saved: 1 };
      },
    });
    expect(saved).toEqual([]);
    expect(loadPendingSessions(st)).toEqual(['S1']); // toujours en attente
  });
});
