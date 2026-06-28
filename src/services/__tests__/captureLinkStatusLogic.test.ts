/**
 * Tests du mapping statut de lien capture → message (PR-08).
 */

import { captureLinkMessage } from '../captureLinkStatusLogic';

describe('captureLinkMessage', () => {
  it('ne montre rien quand le lien est nominal', () => {
    expect(captureLinkMessage('recording')).toBeNull();
    expect(captureLinkMessage('idle')).toBeNull();
  });

  it('annonce honnêtement une interruption (reconnexion)', () => {
    const m = captureLinkMessage('interrupted');
    expect(m).not.toBeNull();
    expect(m?.tone).toBe('warn');
    expect(m?.title).toBe('LIEN INTERROMPU');
    expect(m?.sub.toLowerCase()).toContain('reconnexion');
  });

  it('annonce une perte de lien sans prétendre enregistrer', () => {
    const m = captureLinkMessage('lost');
    expect(m).not.toBeNull();
    expect(m?.tone).toBe('lost');
    expect(m?.title).toBe('LIEN PERDU');
    expect(m?.sub.toLowerCase()).toContain('enregistrée');
  });
});
