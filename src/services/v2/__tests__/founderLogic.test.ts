/**
 * Tests de la logique pure des candidatures fondateur (lot BE-1, Mission B).
 * Aucun réseau : validation de la motivation + libellés de statut.
 */

import {
  validateMotivation,
  founderStatusLabel,
  normalizeFounderStatus,
  FOUNDER_MOTIVATION_MIN,
  FOUNDER_MOTIVATION_MAX,
} from '../founderLogic';

describe('validateMotivation', () => {
  it('refuse une motivation trop courte', () => {
    const res = validateMotivation('trop court');
    expect(res.ok).toBe(false);
    expect(res.error).toContain(String(FOUNDER_MOTIVATION_MIN));
  });

  it('refuse un texte fait uniquement d’espaces (mesure après trim)', () => {
    expect(validateMotivation('   '.repeat(20)).ok).toBe(false);
  });

  it('refuse une motivation trop longue', () => {
    const res = validateMotivation('a'.repeat(FOUNDER_MOTIVATION_MAX + 1));
    expect(res.ok).toBe(false);
    expect(res.error).toContain(String(FOUNDER_MOTIVATION_MAX));
  });

  it('accepte une motivation dans les bornes', () => {
    expect(validateMotivation('a'.repeat(FOUNDER_MOTIVATION_MIN)).ok).toBe(true);
    expect(validateMotivation('Je souhaite rejoindre les fondateurs OXV.').ok).toBe(true);
    expect(validateMotivation('a'.repeat(FOUNDER_MOTIVATION_MAX)).ok).toBe(true);
  });

  it('accepte pile à la borne min après trim', () => {
    expect(validateMotivation(`  ${'a'.repeat(FOUNDER_MOTIVATION_MIN)}  `).ok).toBe(true);
  });
});

describe('founderStatusLabel', () => {
  it('rend un libellé vouvoyé pour chacun des trois statuts', () => {
    expect(founderStatusLabel('pending')).toBe('Votre candidature est en cours d’examen.');
    expect(founderStatusLabel('approved')).toBe('Votre candidature a été retenue.');
    expect(founderStatusLabel('declined')).toBe('Votre candidature n’a pas été retenue.');
  });
});

describe('normalizeFounderStatus', () => {
  it('conserve les statuts connus', () => {
    expect(normalizeFounderStatus('approved')).toBe('approved');
    expect(normalizeFounderStatus('declined')).toBe('declined');
    expect(normalizeFounderStatus('pending')).toBe('pending');
  });

  it('retombe sur pending pour une valeur inattendue', () => {
    expect(normalizeFounderStatus('bizarre')).toBe('pending');
  });
});
