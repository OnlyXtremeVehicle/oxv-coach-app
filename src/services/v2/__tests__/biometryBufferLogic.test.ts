import {
  RR_TREND_BAND,
  chunkSamples,
  qualityFromSamples,
  rrTrendLabel,
  type BioContact,
  type BioSample,
} from '../biometryBufferLogic';

/** Construit une série d'échantillons à `spacingS` secondes, contact constant. */
function series(count: number, spacingS: number, contact: BioContact, startS = 0): BioSample[] {
  const out: BioSample[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      ts: (startS + i * spacingS) * 1000,
      hrBpm: 140,
      rrMs: [428],
      contact,
    });
  }
  return out;
}

describe('qualityFromSamples', () => {
  it('contact plein + densité pleine → proche de 100', () => {
    // 60 échantillons à 1 Hz, tous « ok » : contactRatio = 1, densité ≈ 1.
    const full = series(60, 1, 'ok');
    expect(qualityFromSamples(full, { expectedHz: 1 })).toBeGreaterThanOrEqual(95);
  });

  it('contact plein via une fenêtre explicite → proche de 100', () => {
    const full = series(60, 1, 'ok');
    // windowMs = 60 s, 60 échantillons attendus à 1 Hz → densité ≈ 1.
    expect(qualityFromSamples(full, { windowMs: 60_000, expectedHz: 1 })).toBeGreaterThanOrEqual(
      95
    );
  });

  it('tous les contacts « poor » → 0 (fait mesuré, pas un empty)', () => {
    const poor = series(60, 1, 'poor');
    expect(qualityFromSamples(poor, { expectedHz: 1 })).toBe(0);
  });

  it('tous les contacts « unsupported » → 0', () => {
    const unsupported = series(30, 1, 'unsupported');
    expect(qualityFromSamples(unsupported, { expectedHz: 1 })).toBe(0);
  });

  it('contact plein mais moitié de la densité → proche de 50', () => {
    // 30 échantillons espacés de 2 s (moitié d'un flux 1 Hz), tous « ok ».
    const half = series(30, 2, 'ok');
    const q = qualityFromSamples(half, { expectedHz: 1 });
    expect(q).not.toBeNull();
    expect(q as number).toBeGreaterThanOrEqual(40);
    expect(q as number).toBeLessThanOrEqual(60);
  });

  it('contact partiel abaisse la qualité de façon monotone', () => {
    const allOk = series(60, 1, 'ok');
    const mixed: BioSample[] = allOk.map((s, i) => ({
      ...s,
      contact: i < 30 ? 'ok' : 'poor',
    }));
    const qAll = qualityFromSamples(allOk, { expectedHz: 1 }) as number;
    const qHalf = qualityFromSamples(mixed, { expectedHz: 1 }) as number;
    expect(qHalf).toBeLessThan(qAll);
    expect(qHalf).toBeGreaterThan(0);
  });

  it('tableau vide → null (jamais un 0 fabriqué)', () => {
    expect(qualityFromSamples([])).toBeNull();
  });

  it('expectedHz invalide retombe sur le défaut 1 Hz (pas de crash)', () => {
    const full = series(60, 1, 'ok');
    expect(qualityFromSamples(full, { expectedHz: 0 })).toBeGreaterThanOrEqual(95);
    expect(qualityFromSamples(full, { expectedHz: Number.NaN })).toBeGreaterThanOrEqual(95);
  });

  it('sur-échantillonnage plafonne la densité à 1 (qualité ≤ 100)', () => {
    // 200 échantillons à 5 Hz alors qu'on n'en attend qu'1 Hz.
    const dense = series(200, 0.2, 'ok');
    const q = qualityFromSamples(dense, { expectedHz: 1 }) as number;
    expect(q).toBeLessThanOrEqual(100);
    expect(q).toBeGreaterThanOrEqual(95);
  });
});

describe('chunkSamples', () => {
  it('découpe en lots de la taille demandée, dernier lot partiel inclus', () => {
    expect(chunkSamples([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('un lot exactement plein ne produit pas de lot vide', () => {
    expect(chunkSamples([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('chunkSize de 1 → un lot par élément', () => {
    expect(chunkSamples(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
  });

  it('entrée vide → []', () => {
    expect(chunkSamples([], 500)).toEqual([]);
  });

  it('rejette un chunkSize < 1 ou non entier', () => {
    expect(() => chunkSamples([1], 0)).toThrow();
    expect(() => chunkSamples([1], -2)).toThrow();
    expect(() => chunkSamples([1], 1.5)).toThrow();
  });
});

describe('rrTrendLabel', () => {
  /** Dispersion faible : écarts R-R de ±5 ms. RMSSD ≈ 5. */
  const lowDispersion = [800, 805, 800, 805, 800];
  /** Dispersion forte : écarts R-R de ±100 ms. RMSSD ≈ 100. */
  const highDispersion = [800, 900, 800, 900, 800];

  it('dispersions comparables → stable', () => {
    expect(rrTrendLabel([...lowDispersion], [...lowDispersion])).toBe('stable');
  });

  it('un léger écart dans la bande ±10 % reste stable', () => {
    // RMSSD récent ≈ 5,25 vs référence 5 → ratio ≈ 1,05 < 1 + bande.
    const slightly = [800, 805.25, 800, 805.25, 800];
    expect(RR_TREND_BAND).toBe(0.1);
    expect(rrTrendLabel(slightly, lowDispersion)).toBe('stable');
  });

  it('variabilité récente nettement supérieure → en hausse', () => {
    expect(rrTrendLabel(highDispersion, lowDispersion)).toBe('en hausse');
  });

  it('variabilité récente nettement inférieure → en baisse', () => {
    expect(rrTrendLabel(lowDispersion, highDispersion)).toBe('en baisse');
  });

  it('variabilité récente effondrée (RMSSD 0) → en baisse', () => {
    expect(rrTrendLabel([800, 800, 800, 800], highDispersion)).toBe('en baisse');
  });

  it('données insuffisantes (fenêtre récente vide) → stable', () => {
    expect(rrTrendLabel([], lowDispersion)).toBe('stable');
  });

  it('données insuffisantes (un seul R-R) → stable', () => {
    expect(rrTrendLabel([800], lowDispersion)).toBe('stable');
    expect(rrTrendLabel(lowDispersion, [800])).toBe('stable');
  });

  it('référence sans dispersion (RMSSD 0) → stable, jamais une alerte inventée', () => {
    expect(rrTrendLabel(highDispersion, [700, 700, 700, 700])).toBe('stable');
  });

  it('ignore les R-R non finis ou non positifs', () => {
    const noisyLow = [800, Number.NaN, 805, -10, 800, 805, 800];
    const noisyHigh = [800, 900, Number.NaN, 800, 900, 800];
    expect(rrTrendLabel(noisyHigh, noisyLow)).toBe('en hausse');
  });
});
