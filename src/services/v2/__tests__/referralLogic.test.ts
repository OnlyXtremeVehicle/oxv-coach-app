/**
 * Tests — mapping d'erreurs pur du parrainage (écuries A3).
 * Chaque code serveur → message FR vouvoyé ; idempotence de « deja_dans_une_ecurie ».
 */

import {
  interpretRedeem,
  isIdempotentRedeemError,
  isKnownRedeemError,
  REDEEM_ERROR_MESSAGES,
  REDEEM_UNKNOWN_ERROR,
} from '../referralLogic';

describe('isKnownRedeemError', () => {
  it('reconnaît les quatre codes serveur', () => {
    expect(isKnownRedeemError('code_invalide')).toBe(true);
    expect(isKnownRedeemError('auto_parrainage_interdit')).toBe(true);
    expect(isKnownRedeemError('deja_dans_une_ecurie')).toBe(true);
    expect(isKnownRedeemError('auth_required')).toBe(true);
  });

  it('rejette un code inconnu', () => {
    expect(isKnownRedeemError('boom')).toBe(false);
    expect(isKnownRedeemError('')).toBe(false);
  });
});

describe('isIdempotentRedeemError', () => {
  it('seul « deja_dans_une_ecurie » est idempotent', () => {
    expect(isIdempotentRedeemError('deja_dans_une_ecurie')).toBe(true);
    expect(isIdempotentRedeemError('code_invalide')).toBe(false);
    expect(isIdempotentRedeemError('auto_parrainage_interdit')).toBe(false);
    expect(isIdempotentRedeemError('auth_required')).toBe(false);
  });
});

describe('interpretRedeem — succès', () => {
  it('renvoie le crewId depuis {ok:true, crew_id}', () => {
    const r = interpretRedeem({ ok: true, crew_id: 'crew-123' });
    expect(r).toEqual({ ok: true, crewId: 'crew-123', alreadyMember: false });
  });

  it('succès sans crew_id : crewId absent, jamais d’erreur', () => {
    const r = interpretRedeem({ ok: true });
    expect(r.ok).toBe(true);
    expect(r.crewId).toBeUndefined();
    expect(r.error).toBeUndefined();
    expect(r.alreadyMember).toBe(false);
  });
});

describe('interpretRedeem — échecs mappés', () => {
  it('code_invalide → message FR', () => {
    const r = interpretRedeem({ ok: false, error: 'code_invalide' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe(REDEEM_ERROR_MESSAGES.code_invalide);
    expect(r.alreadyMember).toBe(false);
  });

  it('auto_parrainage_interdit → message FR', () => {
    const r = interpretRedeem({ ok: false, error: 'auto_parrainage_interdit' });
    expect(r.error).toBe(REDEEM_ERROR_MESSAGES.auto_parrainage_interdit);
  });

  it('auth_required → message FR', () => {
    const r = interpretRedeem({ ok: false, error: 'auth_required' });
    expect(r.error).toBe(REDEEM_ERROR_MESSAGES.auth_required);
  });

  it('code inconnu → message de repli', () => {
    const r = interpretRedeem({ ok: false, error: 'quelque_chose_dautre' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe(REDEEM_UNKNOWN_ERROR);
    expect(r.alreadyMember).toBe(false);
  });
});

describe('interpretRedeem — idempotence', () => {
  it('« deja_dans_une_ecurie » n’est pas un échec dur', () => {
    const r = interpretRedeem({ ok: false, error: 'deja_dans_une_ecurie' });
    expect(r.ok).toBe(true);
    expect(r.alreadyMember).toBe(true);
    expect(r.error).toBeUndefined();
  });
});

describe('interpretRedeem — payload malformé', () => {
  it('null → échec doux de repli', () => {
    const r = interpretRedeem(null);
    expect(r.ok).toBe(false);
    expect(r.error).toBe(REDEEM_UNKNOWN_ERROR);
  });

  it('objet sans ok ni error → échec doux de repli', () => {
    const r = interpretRedeem({});
    expect(r.ok).toBe(false);
    expect(r.error).toBe(REDEEM_UNKNOWN_ERROR);
  });

  it('crew_id non-string ignoré', () => {
    const r = interpretRedeem({ ok: true, crew_id: 42 });
    expect(r.ok).toBe(true);
    expect(r.crewId).toBeUndefined();
  });
});
