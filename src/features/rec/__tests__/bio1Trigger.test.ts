import { SOURCE_MONTRE } from '@/features/biometrie/sourcesBiometrie';
import { bio1GuardKey, BIO1_EXPECTED_HZ, runBio1, type Bio1Deps } from '../bio1Trigger';

/** Deps par défaut : tout permis, une lecture non vide, garde en mémoire. */
function makeDeps(overrides: Partial<Bio1Deps> = {}): {
  deps: Bio1Deps;
  marked: Set<string>;
  calls: Record<string, number>;
} {
  const marked = new Set<string>();
  const calls: Record<string, number> = {
    isFlagEnabled: 0,
    loadCaptureConsent: 0,
    readHeartRate: 0,
    saveSamples: 0,
    captureError: 0,
  };
  const base: Bio1Deps = {
    guardHas: (id) => marked.has(id),
    guardMark: (id) => {
      marked.add(id);
    },
    isFlagEnabled: async () => {
      calls.isFlagEnabled++;
      return true;
    },
    loadCaptureConsent: async () => {
      calls.loadCaptureConsent++;
      return true;
    },
    readHeartRate: async () => {
      calls.readHeartRate++;
      return [
        { ts: 1000, hr: 120 },
        { ts: 2000, hr: 128 },
      ];
    },
    saveSamples: async (_id, samples) => {
      calls.saveSamples++;
      return { saved: samples.length };
    },
    computeQuality: () => 82,
    captureError: () => {
      calls.captureError++;
    },
  };
  return { deps: { ...base, ...overrides }, marked, calls };
}

const input = {
  sessionId: 's1',
  start: new Date('2026-07-19T14:00:00'),
  end: new Date('2026-07-19T14:20:00'),
};

describe('bio1GuardKey', () => {
  it('dérive la clé de garde par séance', () => {
    expect(bio1GuardKey('s1')).toBe('bio1-read:s1');
    // LOT 10a — l'attente n'est plus celle de la ceinture. Elle valait 1 Hz,
    // ce qui faisait tomber la qualité de la montre autour de 20 (« basse »)
    // à chaque séance : la montre rend ~1 point / 5 s, pas 1 point / s.
    expect(BIO1_EXPECTED_HZ).toBe(SOURCE_MONTRE.cadenceNominaleHz);
    expect(BIO1_EXPECTED_HZ).toBeLessThan(1);
  });
});

describe('runBio1 — idempotence', () => {
  it('ne touche à AUCUN service si la garde est déjà posée', async () => {
    const { deps, calls } = makeDeps({ guardHas: () => true });
    const out = await runBio1(input, deps);
    expect(out).toEqual({ ran: false, reason: 'already' });
    expect(calls.isFlagEnabled).toBe(0);
    expect(calls.readHeartRate).toBe(0);
    expect(calls.saveSamples).toBe(0);
  });

  it('pose la garde après une lecture réussie, puis se bloque au 2e appel', async () => {
    const { deps, marked, calls } = makeDeps();
    const first = await runBio1(input, deps);
    expect(first).toEqual({ ran: true, reason: 'ok', saved: 2 });
    expect(marked.has('s1')).toBe(true);
    expect(calls.saveSamples).toBe(1);

    const second = await runBio1(input, deps);
    expect(second.reason).toBe('already');
    expect(calls.saveSamples).toBe(1); // pas de 2e persistance
  });
});

describe('runBio1 — fail-closed', () => {
  it('flag OFF → aucune donnée approchée, aucune garde', async () => {
    const { deps, marked, calls } = makeDeps({ isFlagEnabled: async () => false });
    const out = await runBio1(input, deps);
    expect(out).toEqual({ ran: false, reason: 'flag-off' });
    expect(calls.readHeartRate).toBe(0);
    expect(marked.has('s1')).toBe(false);
  });

  it('consentement absent → aucune lecture, aucune garde', async () => {
    const { deps, marked, calls } = makeDeps({ loadCaptureConsent: async () => false });
    const out = await runBio1(input, deps);
    expect(out).toEqual({ ran: false, reason: 'consent-off' });
    expect(calls.readHeartRate).toBe(0);
    expect(marked.has('s1')).toBe(false);
  });

  it('sessionId vide → invalid, sans I/O', async () => {
    const { deps, calls } = makeDeps();
    const out = await runBio1({ ...input, sessionId: '' }, deps);
    expect(out.reason).toBe('invalid');
    expect(calls.isFlagEnabled).toBe(0);
  });
});

describe('runBio1 — no-op phase A (HealthKit indisponible)', () => {
  it('zéro échantillon → no-samples, PAS de garde (réessayable)', async () => {
    const { deps, marked, calls } = makeDeps({ readHeartRate: async () => [] });
    const out = await runBio1(input, deps);
    expect(out).toEqual({ ran: false, reason: 'no-samples' });
    expect(calls.saveSamples).toBe(0);
    expect(marked.has('s1')).toBe(false);
  });
});

describe('runBio1 — jamais bloquant', () => {
  it('une erreur de lecture est capturée et rendue silencieuse (résout, ne rejette pas)', async () => {
    const { deps, marked, calls } = makeDeps({
      readHeartRate: async () => {
        throw new Error('healthkit indisponible');
      },
    });
    const out = await runBio1(input, deps);
    expect(out.reason).toBe('error');
    expect(out.ran).toBe(false);
    expect(calls.captureError).toBe(1);
    expect(marked.has('s1')).toBe(false);
  });

  it('une erreur de persistance ne rejette pas non plus', async () => {
    const { deps, calls } = makeDeps({
      saveSamples: async () => {
        throw new Error('réseau');
      },
    });
    await expect(runBio1(input, deps)).resolves.toEqual({ ran: false, reason: 'error' });
    expect(calls.captureError).toBe(1);
  });
});
