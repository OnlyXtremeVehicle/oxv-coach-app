/**
 * Tests de la politique de reconnexion BLE (chantier 5 — coupure BLE sans
 * clôture forcée). Deux garanties vérifiées :
 *   1. backoff PROGRESSIF PLAFONNÉ : croît puis plafonne à 30 s, jamais au-delà ;
 *   2. décision d'ABANDON : jamais en mode illimité (capture armée), bornée sinon.
 */

import {
  RECONNECT_BACKOFF_BASE_MS,
  RECONNECT_BACKOFF_MAX_MS,
  RECONNECT_MAX_ATTEMPTS,
  nextReconnectDelayMs,
  shouldGiveUpReconnect,
} from '../reconnectPolicy';

describe('nextReconnectDelayMs — backoff progressif plafonné', () => {
  it('part du délai de base à la première tentative (attempt 0)', () => {
    expect(nextReconnectDelayMs(0)).toBe(RECONNECT_BACKOFF_BASE_MS);
    expect(nextReconnectDelayMs(0)).toBe(2_000);
  });

  it('croît géométriquement (×2) tant qu’on est sous le plafond', () => {
    expect(nextReconnectDelayMs(1)).toBe(4_000);
    expect(nextReconnectDelayMs(2)).toBe(8_000);
    expect(nextReconnectDelayMs(3)).toBe(16_000);
  });

  it('plafonne à RECONNECT_BACKOFF_MAX_MS (30 s) et ne le dépasse jamais', () => {
    // attempt 4 → 32 s brut, ramené au plafond 30 s.
    expect(nextReconnectDelayMs(4)).toBe(RECONNECT_BACKOFF_MAX_MS);
    expect(nextReconnectDelayMs(4)).toBe(30_000);
    for (const attempt of [5, 6, 10, 50, 1000]) {
      expect(nextReconnectDelayMs(attempt)).toBe(RECONNECT_BACKOFF_MAX_MS);
      expect(nextReconnectDelayMs(attempt)).toBeLessThanOrEqual(RECONNECT_BACKOFF_MAX_MS);
    }
  });

  it('est monotone non décroissant puis stable au plafond', () => {
    let prev = 0;
    for (let attempt = 0; attempt <= 20; attempt++) {
      const d = nextReconnectDelayMs(attempt);
      expect(d).toBeGreaterThanOrEqual(prev);
      expect(d).toBeLessThanOrEqual(RECONNECT_BACKOFF_MAX_MS);
      prev = d;
    }
    expect(prev).toBe(RECONNECT_BACKOFF_MAX_MS);
  });

  it('retombe sur le délai de base pour des entrées aberrantes (négatif/NaN)', () => {
    expect(nextReconnectDelayMs(-3)).toBe(RECONNECT_BACKOFF_BASE_MS);
    expect(nextReconnectDelayMs(Number.NaN)).toBe(RECONNECT_BACKOFF_BASE_MS);
  });
});

describe('shouldGiveUpReconnect — décision d’abandon selon le mode', () => {
  it('en mode ILLIMITÉ (capture armée), n’abandonne JAMAIS', () => {
    for (const attempt of [0, 1, RECONNECT_MAX_ATTEMPTS, RECONNECT_MAX_ATTEMPTS + 100, 10_000]) {
      expect(shouldGiveUpReconnect(attempt, true)).toBe(false);
    }
  });

  it('en mode BORNÉ, tient tant qu’on est sous le seuil', () => {
    for (let attempt = 0; attempt < RECONNECT_MAX_ATTEMPTS; attempt++) {
      expect(shouldGiveUpReconnect(attempt, false)).toBe(false);
    }
  });

  it('en mode BORNÉ, abandonne une fois le seuil atteint', () => {
    expect(shouldGiveUpReconnect(RECONNECT_MAX_ATTEMPTS, false)).toBe(true);
    expect(shouldGiveUpReconnect(RECONNECT_MAX_ATTEMPTS + 1, false)).toBe(true);
  });
});
