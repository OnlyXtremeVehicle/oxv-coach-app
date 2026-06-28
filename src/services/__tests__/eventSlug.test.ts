/**
 * Tests du slug d'événement (PR-21).
 */

import { slugify } from '../eventSlug';

describe('slugify', () => {
  it('minuscule, accents retirés, tirets', () => {
    expect(slugify('Balade Découverte OXV — 5 juillet 2026')).toBe(
      'balade-decouverte-oxv-5-juillet-2026'
    );
  });

  it('compacte la ponctuation et coupe les tirets de bord', () => {
    expect(slugify('  Événement !! Test  ')).toBe('evenement-test');
  });

  it('borne à 80 caractères', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
