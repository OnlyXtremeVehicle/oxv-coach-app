/**
 * Garde PII analytics (SEC-1) : aucune clé d'événement parmi
 * [email, name, first_name, last_name, handle, phone, iban].
 * Logique pure — pas de réseau, MMKV mocké comme dans analytics.test.ts.
 */

import {
  FORBIDDEN_ANALYTICS_PROP_KEYS,
  findForbiddenAnalyticsKeys,
  trackEvent,
} from '../analyticsService';

jest.mock('@/lib/mmkv', () => ({
  storage: {
    getBoolean: () => undefined,
    set: () => undefined,
  },
}));

describe('findForbiddenAnalyticsKeys (pur)', () => {
  it('accepte des props catégorielles saines', () => {
    expect(findForbiddenAnalyticsKeys({ ecran: 'bilan', couche: 'gg', niveau: 'detail' })).toEqual(
      []
    );
  });

  it('accepte l absence de props', () => {
    expect(findForbiddenAnalyticsKeys(undefined)).toEqual([]);
  });

  it.each(FORBIDDEN_ANALYTICS_PROP_KEYS.map((k) => [k]))('détecte la clé interdite « %s »', (k) => {
    expect(findForbiddenAnalyticsKeys({ [k]: 'x' })).toEqual([k]);
  });

  it('est insensible à la casse (Email, IBAN…)', () => {
    expect(findForbiddenAnalyticsKeys({ Email: 'a@b.fr', IBAN: 'FR76…' })).toEqual([
      'Email',
      'IBAN',
    ]);
  });

  it('remonte toutes les clés fautives, pas seulement la première', () => {
    expect(findForbiddenAnalyticsKeys({ email: 'x', phone: 'y', ecran: 'ok' })).toEqual([
      'email',
      'phone',
    ]);
  });
});

describe('trackEvent — garde DEV', () => {
  // ts-jest node ne définit pas __DEV__ (contrairement au runtime RN) : on le
  // pose explicitement pour exercer la branche DEV de la garde.
  const g = globalThis as { __DEV__?: boolean };

  beforeEach(() => {
    g.__DEV__ = true;
  });

  afterEach(() => {
    delete g.__DEV__;
  });

  it('jette en DEV si une clé PII est passée en prop', () => {
    expect(() => trackEvent('test_event', { email: 'a@b.fr' } as never)).toThrow(/email/);
  });

  it('ne jette pas pour des props saines', () => {
    expect(() => trackEvent('test_event', { ecran: 'bilan' })).not.toThrow();
  });

  it('reste silencieuse hors DEV (prod : no-op, jamais de crash)', () => {
    delete g.__DEV__;
    expect(() => trackEvent('test_event', { email: 'a@b.fr' } as never)).not.toThrow();
  });
});
