import { SHAREABLE_METRICS, sanitizeIncludedMetrics } from '../sharesService';

// Le service importe le client Supabase (throw sans env) ; on le mocke.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('sanitizeIncludedMetrics (liste blanche RGPD)', () => {
  it('ne garde que des clés connues, sans doublon', () => {
    expect(sanitizeIncludedMetrics(['best_lap', 'inconnu', 'regularity', 'best_lap'])).toEqual([
      'best_lap',
      'regularity',
    ]);
  });

  it('liste vide → vide (défaut = rien de partagé)', () => {
    expect(sanitizeIncludedMetrics([])).toEqual([]);
  });

  it('rejette toute clé inconnue (jamais plus que la liste blanche)', () => {
    expect(sanitizeIncludedMetrics(['n_importe_quoi', 'service_role'])).toEqual([]);
  });
});

describe('SHAREABLE_METRICS', () => {
  it('clés uniques et non vides', () => {
    const keys = SHAREABLE_METRICS.map((m) => m.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
