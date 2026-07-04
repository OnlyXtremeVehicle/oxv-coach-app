import {
  isPairingCodeComplete,
  normalizePairingCode,
  pairingErrorMessage,
} from '@/services/pairingLogic';

describe('normalizePairingCode', () => {
  it('majuscule et retire espaces/tirets/caractères hors alphabet', () => {
    expect(normalizePairingCode(' ab2-3 cd4 ')).toBe('AB23CD4');
    expect(normalizePairingCode('abcd efgh')).toBe('ABCDEFGH');
  });

  it("retire les chiffres exclus de l'alphabet (0 et 1)", () => {
    // L'alphabet edge exclut 0/1 ; la validité réelle du code est tranchée
    // par le serveur — la normalisation reflète simplement l'alphabet.
    expect(normalizePairingCode('AB01CD23')).toBe('ABCD23');
  });

  it('entrée vide ou null-ish → chaîne vide', () => {
    expect(normalizePairingCode('')).toBe('');
  });
});

describe('isPairingCodeComplete', () => {
  it('exactement 8 caractères après normalisation', () => {
    expect(isPairingCodeComplete('AB23CD45')).toBe(true);
    expect(isPairingCodeComplete('ab23 cd45')).toBe(true);
    expect(isPairingCodeComplete('AB23CD4')).toBe(false);
    expect(isPairingCodeComplete('AB23CD456')).toBe(false);
  });
});

describe('pairingErrorMessage', () => {
  it('chaque code produit un libellé vouvoyé non vide', () => {
    for (const code of [
      'invalid_or_expired',
      'rate_limited',
      'user_not_found',
      'link_failed',
      'network',
      'unknown',
    ] as const) {
      const msg = pairingErrorMessage(code);
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toMatch(/\btu\b/i);
    }
  });
});
