import {
  GAP_THRESHOLD_S,
  chunk,
  computeQuality,
  toMillis,
  type QualitySample,
} from '../biometryLogic';

/** Série pleine à `hz` Hz sur `count` échantillons, à partir de `startS` secondes. */
function series(count: number, spacingS: number, startS = 0): QualitySample[] {
  const out: QualitySample[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ ts: (startS + i * spacingS) * 1000, hr: 140 });
  }
  return out;
}

describe('toMillis', () => {
  it('laisse un number inchangé et parse une chaîne ISO', () => {
    expect(toMillis(1500)).toBe(1500);
    expect(toMillis('1970-01-01T00:00:01.000Z')).toBe(1000);
  });
});

describe('chunk', () => {
  it('découpe en lots de la taille demandée, dernier lot partiel inclus', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('renvoie un tableau vide pour une entrée vide', () => {
    expect(chunk([], 500)).toEqual([]);
  });

  it('rejette une taille non entière ou nulle', () => {
    expect(() => chunk([1], 0)).toThrow();
    expect(() => chunk([1], -3)).toThrow();
    expect(() => chunk([1], 1.5)).toThrow();
  });
});

describe('computeQuality', () => {
  it('densité pleine → proche de 100', () => {
    // 60 échantillons à 1 Hz, aucun trou.
    const full = series(60, 1);
    expect(computeQuality(full, 1)).toBeGreaterThanOrEqual(95);
  });

  it('moitié des échantillons → proche de 50', () => {
    // 30 échantillons espacés de 2 s (moitié d'un flux 1 Hz), aucun trou > 10 s.
    const half = series(30, 2);
    const q = computeQuality(half, 1);
    expect(q).toBeGreaterThanOrEqual(40);
    expect(q).toBeLessThanOrEqual(60);
  });

  it('un trou de 15 s est pénalisé à densité et durée égales', () => {
    // Deux séries : 12 échantillons, même durée couverte (25 s).
    // « even » : réparti régulièrement, aucun intervalle > 10 s.
    const even: QualitySample[] = [];
    for (let i = 0; i < 12; i++) {
      even.push({ ts: Math.round((i * 25000) / 11), hr: 140 });
    }
    // « bunched » : 6 échantillons [0..5 s] + trou de 15 s + 6 échantillons [20..25 s].
    const bunched = [...series(6, 1, 0), ...series(6, 1, 20)];

    const qEven = computeQuality(even, 1);
    const qBunched = computeQuality(bunched, 1);

    expect(qBunched).toBeLessThan(qEven);
    expect(qBunched).toBeGreaterThan(0);
  });

  it('des intervalles sous le seuil ne déclenchent pas la pénalité de trou', () => {
    // Espacement 10 s pile (= GAP_THRESHOLD_S) : aucun excédent, pénalité nulle.
    const atThreshold = series(6, GAP_THRESHOLD_S);
    // La qualité ne reflète alors que la densité (1 échantillon / 10 s attendu à 1 Hz).
    expect(computeQuality(atThreshold, 1)).toBeGreaterThan(0);
    expect(computeQuality(atThreshold, 1)).toBeLessThanOrEqual(100);
  });

  it('tableau vide → 0', () => {
    expect(computeQuality([], 1)).toBe(0);
  });

  it('un seul échantillon ou durée nulle → 0', () => {
    expect(computeQuality([{ ts: 1000, hr: 140 }], 1)).toBe(0);
    expect(
      computeQuality(
        [
          { ts: 1000, hr: 140 },
          { ts: 1000, hr: 141 },
        ],
        1
      )
    ).toBe(0);
  });

  it('expectedHz invalide → 0', () => {
    const full = series(10, 1);
    expect(computeQuality(full, 0)).toBe(0);
    expect(computeQuality(full, -1)).toBe(0);
  });
});
