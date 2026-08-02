/**
 * Tests du service de mesure d'audience (§9).
 * Vérifie les garde-fous RGPD : inactif sans domaine, sans accord, opt-out, no-op.
 *
 * ---
 *
 * LE CONTRAT A CHANGÉ LE 02/08/2026 — CES TESTS ENCODAIENT L'ANCIEN.
 *
 * Ils tenaient pour acquis qu'un domaine configuré suffisait à émettre. C'était
 * exactement le défaut : la mesure partait sans que personne ait rien accepté,
 * dès le montage de la racine, avant même l'écran de connexion.
 *
 * Il fallait donc les corriger, PAS assouplir la garde. Les cas nominaux
 * déclarent maintenant l'accord explicitement — ce que fait l'application à
 * l'acceptation des CGU. Le fail-closed, lui, est éprouvé dans
 * `analyticsConsentement.test.ts`.
 */

// Mock MMKV (indisponible en environnement Jest).
import {
  isAnalyticsEnabled,
  isAnalyticsOptedOut,
  setAnalyticsConsent,
  setAnalyticsOptOut,
  trackEvent,
} from '../analyticsService';

const store: Record<string, boolean> = {};
jest.mock('@/lib/mmkv', () => ({
  storage: {
    getBoolean: (k: string) => store[k],
    set: (k: string, v: boolean) => {
      store[k] = v;
    },
  },
}));

describe('analyticsService', () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN;
    // L'accord est le point de départ des cas nominaux ci-dessous : ils testent
    // le DOMAINE et l'OPT-OUT, pas le consentement. Sans cette ligne ils
    // vérifieraient la garde de consentement par accident, et ne diraient plus
    // rien de ce qu'ils prétendent couvrir.
    setAnalyticsConsent(true);
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
