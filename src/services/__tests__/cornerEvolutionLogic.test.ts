import {
  buildCornerEvolution,
  sliceAndNormalize,
  type CornerPassInput,
  type CornerWindow,
} from '@/services/cornerEvolutionLogic';
import type { SessionFrame } from '@/services/sessionTelemetryMapping';

/**
 * Fabrique une frame minimale. Coordonnées abstraites : le cœur pur ne fait que
 * du min-max, il est indépendant du référentiel géographique réel.
 */
function frame(lat: number | null, lon: number | null): SessionFrame {
  return {
    elapsedMs: 0,
    lat,
    lon,
    speedKmh: null,
    gLat: null,
    gLong: null,
    gVert: null,
    yawRateRadS: null,
  };
}

const FULL: CornerWindow = { startProgress: 0, endProgress: 1 };

describe('sliceAndNormalize — boîte unité, ratio préservé', () => {
  it('normalise le segment dans [0..1] × [0..1] avec une échelle partagée', () => {
    // span lat = 1, span lon = 2 → échelle = 0.5 (l'axe dominant lon atteint 1).
    const frames = [frame(0, 0), frame(0, 2), frame(1, 2)];
    const points = sliceAndNormalize(frames, FULL);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 }, // lat 0.5 = ratio 1/2 préservé
    ]);
  });

  it('découpe sur la fenêtre de progression (les points hors fenêtre sont ignorés)', () => {
    // 5 frames → progress 0, 0.25, 0.5, 0.75, 1. Fenêtre [0.4, 0.8] garde i2 et i3.
    const frames = [
      frame(100, 100), // exclu (outlier volontaire)
      frame(100, 100), // exclu
      frame(0, 0), // i2, gardé
      frame(0, 4), // i3, gardé
      frame(100, 100), // exclu
    ];
    const points = sliceAndNormalize(frames, { startProgress: 0.4, endProgress: 0.8 });
    // Si les outliers avaient fuité, la normalisation serait tout autre.
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it('écarte un segment à < 2 points GPS valides', () => {
    expect(sliceAndNormalize([frame(0, 0), frame(null, null)], FULL)).toEqual([]);
    expect(sliceAndNormalize([frame(null, null), frame(null, null)], FULL)).toEqual([]);
  });

  it('écarte un segment d’étendue nulle (points identiques → pas de division par 0)', () => {
    const points = sliceAndNormalize([frame(45, 5), frame(45, 5)], FULL);
    expect(points).toEqual([]);
  });
});

describe('buildCornerEvolution — ordre, isCurrent, plafond', () => {
  const validFrames = [frame(0, 0), frame(0, 2), frame(1, 2)];

  it('trie le plus récent d’abord et marque isCurrent sur le premier survivant', () => {
    const passes: CornerPassInput[] = [
      { sessionId: 'A', startedAt: '2026-07-01T10:00:00Z', frames: validFrames },
      { sessionId: 'B', startedAt: '2026-07-10T10:00:00Z', frames: validFrames },
      { sessionId: 'C', startedAt: '2026-07-05T10:00:00Z', frames: validFrames },
    ];
    const { passes: out } = buildCornerEvolution(passes, FULL);

    expect(out.map((p) => p.sessionId)).toEqual(['B', 'C', 'A']); // antéchronologique
    expect(out.map((p) => p.isCurrent)).toEqual([true, false, false]);
  });

  it('plafonne aux maxPasses plus récents (défaut 5, on écarte les plus vieux)', () => {
    const passes: CornerPassInput[] = Array.from({ length: 6 }, (_, i) => ({
      sessionId: `S${i}`,
      // S0 le plus vieux, S5 le plus récent.
      startedAt: `2026-07-0${i + 1}T10:00:00Z`,
      frames: validFrames,
    }));
    const { passes: out } = buildCornerEvolution(passes, FULL);

    expect(out).toHaveLength(5);
    expect(out.map((p) => p.sessionId)).toEqual(['S5', 'S4', 'S3', 'S2', 'S1']); // S0 écarté
    expect(out[0].isCurrent).toBe(true);
  });

  it('respecte un maxPasses explicite', () => {
    const passes: CornerPassInput[] = [
      { sessionId: 'A', startedAt: '2026-07-01T10:00:00Z', frames: validFrames },
      { sessionId: 'B', startedAt: '2026-07-10T10:00:00Z', frames: validFrames },
      { sessionId: 'C', startedAt: '2026-07-05T10:00:00Z', frames: validFrames },
    ];
    const { passes: out } = buildCornerEvolution(passes, FULL, { maxPasses: 2 });
    expect(out.map((p) => p.sessionId)).toEqual(['B', 'C']);
  });

  it('écarte les passages indigents ; le survivant le plus récent devient courant', () => {
    const passes: CornerPassInput[] = [
      // Le plus récent est indigent (0 point GPS) → écarté.
      { sessionId: 'RECENT_EMPTY', startedAt: '2026-07-20T10:00:00Z', frames: [frame(null, null)] },
      { sessionId: 'OLDER_OK', startedAt: '2026-07-10T10:00:00Z', frames: validFrames },
    ];
    const { passes: out } = buildCornerEvolution(passes, FULL);
    expect(out).toHaveLength(1);
    expect(out[0].sessionId).toBe('OLDER_OK');
    expect(out[0].isCurrent).toBe(true);
  });

  it('tout écarté → { passes: [] } (vide assumé)', () => {
    const passes: CornerPassInput[] = [
      { sessionId: 'X', startedAt: '2026-07-10T10:00:00Z', frames: [frame(null, null)] },
    ];
    expect(buildCornerEvolution(passes, FULL)).toEqual({ passes: [] });
  });

  it('aucun passage en entrée → { passes: [] }', () => {
    expect(buildCornerEvolution([], FULL)).toEqual({ passes: [] });
  });
});
