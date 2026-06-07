/**
 * Tests du service de mesure d'audience (§9).
 * Vérifie les garde-fous RGPD : inactif sans domaine, opt-out, no-op.
 */

// Mock MMKV (indisponible en environnement Jest).
const store: Record<string, boolean> = {};
jest.mock('@/lib/mmkv', () => ({
  storage: {
    getBoolean: (k: string) => store[k],
    set: (k: string, v: boolean) => {
      store[k] = v;
    },
  },
}));

import {
  isAnalyticsEnabled,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
  trackEvent,
} from '../analyticsService';

describe('analyticsService', () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN;
  });

  it('est INACTIF tant que le domaine Plausible n est pas configuré', () => {
    expect(isAnalyticsEnabled()).toBe(false);
    trackEvent('test');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie un événement quand le domaine est configuré et pas d opt-out', () => {
    process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN = 'oxvehicle.fr';
    expect(isAnalyticsEnabled()).toBe(true);
    trackEvent('session_analysee');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respecte l opt-out : aucun envoi même domaine configuré', () => {
    process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN = 'oxvehicle.fr';
    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
    expect(isAnalyticsEnabled()).toBe(false);
    trackEvent('session_analysee');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne fait jamais échouer l app si fetch rejette', () => {
    process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN = 'oxvehicle.fr';
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('network')));
    expect(() => trackEvent('test')).not.toThrow();
  });

  it('n envoie jamais de PII dans le body (pas d email/user_id)', () => {
    process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN = 'oxvehicle.fr';
    trackEvent('ecran_vu', { ecran: 'bilan' });
    const call = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const body = call[1].body.toLowerCase();
    for (const pii of ['email', 'user_id', 'userid', 'first_name', 'lat', 'lon']) {
      expect(body).not.toContain(pii);
    }
    // La prop métier non-identifiante doit bien être présente.
    expect(body).toContain('bilan');
  });
});
