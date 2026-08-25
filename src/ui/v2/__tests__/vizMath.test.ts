/**
 * Tests vizMath — logique pure des data-viz V2 (lot L0, livrable 7) :
 * radar QDI, sparkline biométrique, projection de tracé, piliers.
 */

import { colors, motion } from '../tokens';
import {
  DOT_STAGGER_MS,
  PULSE_PERIOD_MAX_MS,
  PULSE_PERIOD_MIN_MS,
  QDI_BRANCHES,
  QDI_BRANCH_LABELS,
  QDI_MAX,
  centerlineToTrace,
  cleanSamples,
  fitPointsToBox,
  fitTransform,
  formatPillarValue,
  meanBpm,
  normalizeSparkline,
  pillarRatio,
  pointAtRatio,
  pointsToSvgPath,
  pulsePeriodMs,
  radarAngle,
  radarLayout,
  radarRingPath,
  radarVertex,
  sparklinePath,
  traceLength,
  type BiometrySample,
  type XY,
} from '../vizMath';

// ---------------------------------------------------------------------------
// Radar QDI
// ---------------------------------------------------------------------------

describe('QDI_BRANCHES', () => {
  it('couvre exactement les clés de colors.qdi, dans le même ordre canonique', () => {
    expect([...QDI_BRANCHES]).toEqual(Object.keys(colors.qdi));
  });

  it('a un libellé français pour chaque branche', () => {
    for (const branch of QDI_BRANCHES) {
      expect(QDI_BRANCH_LABELS[branch].length).toBeGreaterThan(0);
    }
  });

  it('fixe le pas de séquencement des puces à 80 ms (spec L1)', () => {
    expect(DOT_STAGGER_MS).toBe(80);
  });
});

describe('radarAngle / radarVertex', () => {
  it('la première branche pointe vers le haut (-90°), pas régulier de 2π/5', () => {
    expect(radarAngle(0)).toBeCloseTo(-Math.PI / 2);
    expect(radarAngle(1) - radarAngle(0)).toBeCloseTo((2 * Math.PI) / 5);
  });

  it('sommet plein de la branche 0 : droit au-dessus du centre', () => {
    const v = radarVertex(50, 50, 40, 0, 1);
    expect(v.x).toBeCloseTo(50);
    expect(v.y).toBeCloseTo(10);
  });

  it('borne value01 dans [0, 1]', () => {
    const over = radarVertex(50, 50, 40, 0, 2);
    expect(over.y).toBeCloseTo(10);
    const under = radarVertex(50, 50, 40, 0, -1);
    expect(under.x).toBeCloseTo(50);
    expect(under.y).toBeCloseTo(50);
  });
});

describe('radarRingPath', () => {
  it('pentagone fermé (M … Z) à la fraction demandée', () => {
    const path = radarRingPath(50, 50, 40, 1);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith(' Z')).toBe(true);
    expect(path.split(' L ').length).toBe(5); // 5 sommets
  });
});

describe('radarLayout', () => {
  const full = { trajectoire: 80, fluidite: 60, freinage: 40, acceleration: 100, regularite: 0 };

  it('5 branches mesurées → 5 axes, 5 points, polygone fermé', () => {
    const layout = radarLayout(full, 200);
    expect(layout.measuredCount).toBe(5);
    expect(layout.axes).toHaveLength(5);
    expect(layout.points).toHaveLength(5);
    expect(layout.polygonPath.endsWith(' Z')).toBe(true);
  });

  it('valeur 0 : point au centre (mesuré, pas masqué)', () => {
    const layout = radarLayout(full, 200);
    const reg = layout.points.find((p) => p.branch === 'regularite');
    expect(reg?.point.x).toBeCloseTo(100);
    expect(reg?.point.y).toBeCloseTo(100);
  });

  it('branche absente ou non finie → MASQUÉE (ni axe, ni point), index canonique conservé', () => {
    const layout = radarLayout({ trajectoire: 80, freinage: 40, regularite: NaN }, 200);
    expect(layout.measuredCount).toBe(2);
    expect(layout.axes.map((a) => a.branch)).toEqual(['trajectoire', 'freinage']);
    expect(layout.axes.map((a) => a.index)).toEqual([0, 2]);
  });

  it('2 branches mesurées → segment ouvert ; 1 seule → pas de polygone', () => {
    const two = radarLayout({ trajectoire: 80, freinage: 40 }, 200);
    expect(two.polygonPath.startsWith('M ')).toBe(true);
    expect(two.polygonPath.endsWith(' Z')).toBe(false);
    const one = radarLayout({ fluidite: 50 }, 200);
    expect(one.polygonPath).toBe('');
    expect(one.points).toHaveLength(1);
  });

  it('borne les valeurs à QDI_MAX (jamais hors grille)', () => {
    const layout = radarLayout({ trajectoire: 140 }, 200, 10);
    const p = layout.points[0];
    expect(p.value).toBe(QDI_MAX);
    expect(p.point.y).toBeCloseTo(100 - layout.r);
  });
});

// ---------------------------------------------------------------------------
// Sparkline biométrique
// ---------------------------------------------------------------------------

describe('cleanSamples / meanBpm', () => {
  const raw: BiometrySample[] = [
    { ts: 30, hr: 150 },
    { ts: 10, hr: 120 },
    { ts: 20, hr: NaN },
    { ts: 40, hr: 0 },
  ];

  it('filtre les échantillons invalides (non finis, bpm nul) et trie par ts', () => {
    const clean = cleanSamples(raw);
    expect(clean).toEqual([
      { ts: 10, hr: 120 },
      { ts: 30, hr: 150 },
    ]);
  });

  it('meanBpm : moyenne des valides, null si rien d’exploitable', () => {
    expect(meanBpm(raw)).toBeCloseTo(135);
    expect(meanBpm([])).toBeNull();
    expect(meanBpm([{ ts: 1, hr: 0 }])).toBeNull();
  });
});

describe('normalizeSparkline', () => {
  const samples: BiometrySample[] = [
    { ts: 0, hr: 100 },
    { ts: 50, hr: 180 },
    { ts: 100, hr: 140 },
  ];

  it('mappe le temps sur x (pad → width-pad) et inverse y (bpm haut = point haut)', () => {
    const pts = normalizeSparkline(samples, 100, 40, 4);
    expect(pts[0].x).toBeCloseTo(4);
    expect(pts[2].x).toBeCloseTo(96);
    expect(pts[1].y).toBeCloseTo(4); // 180 bpm → haut
    expect(pts[0].y).toBeCloseTo(36); // 100 bpm → bas
  });

  it('série plate → mi-hauteur ; échantillon unique → centré en x', () => {
    const flat = normalizeSparkline(
      [
        { ts: 0, hr: 120 },
        { ts: 10, hr: 120 },
      ],
      100,
      40
    );
    expect(flat[0].y).toBeCloseTo(20);
    expect(flat[1].y).toBeCloseTo(20);
    const single = normalizeSparkline([{ ts: 5, hr: 130 }], 100, 40);
    expect(single).toHaveLength(1);
    expect(single[0].x).toBeCloseTo(50);
    expect(single[0].y).toBeCloseTo(20);
  });

  it('vide ou cadre dégénéré → []', () => {
    expect(normalizeSparkline([], 100, 40)).toEqual([]);
    expect(normalizeSparkline(samples, 0, 40)).toEqual([]);
  });

  it('sparklinePath : ouvert, jamais fermé ; « » sous 2 points', () => {
    const pts = normalizeSparkline(samples, 100, 40);
    const path = sparklinePath(pts);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith(' Z')).toBe(false);
    expect(sparklinePath([{ x: 1, y: 1 }])).toBe('');
  });
});

describe('pulsePeriodMs', () => {
  it('période = 60/bpm en secondes', () => {
    expect(pulsePeriodMs(60)).toBe(1000);
    expect(pulsePeriodMs(120)).toBe(500);
  });

  it('bornée à des valeurs animables', () => {
    expect(pulsePeriodMs(10)).toBe(PULSE_PERIOD_MAX_MS);
    expect(pulsePeriodMs(400)).toBe(PULSE_PERIOD_MIN_MS);
  });

  it('bpm inconnu → cadence neutre motion.pulse (pas une donnée)', () => {
    expect(pulsePeriodMs(null)).toBe(motion.pulse);
    expect(pulsePeriodMs(0)).toBe(motion.pulse);
    expect(pulsePeriodMs(NaN)).toBe(motion.pulse);
  });
});

// ---------------------------------------------------------------------------
// Tracé circuit
// ---------------------------------------------------------------------------

describe('fitPointsToBox', () => {
  const square: XY[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('échelle uniforme (aspect préservé), centré, dans le cadre', () => {
    const fitted = fitPointsToBox(square, 100, 50, 5);
    // échelle = min(90/10, 40/10) = 4 → carré de 40 px centré.
    for (const p of fitted) {
      expect(p.x).toBeGreaterThanOrEqual(5);
      expect(p.x).toBeLessThanOrEqual(95);
      expect(p.y).toBeGreaterThanOrEqual(5);
      expect(p.y).toBeLessThanOrEqual(45);
    }
    expect(fitted[1].x - fitted[0].x).toBeCloseTo(40);
  });

  it('inverse y : le nord (y métrique grand) est en haut de l’écran', () => {
    const fitted = fitPointsToBox(square, 100, 50, 5);
    expect(fitted[3].y).toBeLessThan(fitted[0].y); // (0,10) au-dessus de (0,0)
  });

  it('points confondus → tous au centre ; non finis filtrés', () => {
    const same = fitPointsToBox(
      [
        { x: 3, y: 3 },
        { x: 3, y: 3 },
      ],
      100,
      50
    );
    expect(same[0]).toEqual({ x: 50, y: 25 });
    expect(fitPointsToBox([{ x: NaN, y: 1 }], 100, 50)).toEqual([]);
  });
});

describe('fitTransform', () => {
  const square: XY[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('est exactement la transformation de fitPointsToBox', () => {
    const t = fitTransform(square, 100, 50, 5);
    expect(t).not.toBeNull();
    expect(square.map(t!)).toEqual(fitPointsToBox(square, 100, 50, 5));
  });

  it('projette une sous-polyligne dans le cadre du tracé COMPLET', () => {
    const t = fitTransform(square, 100, 50, 5)!;
    // Le milieu du côté bas (5, 0) — cadré sur le carré entier, pas sur lui-même.
    const p = t({ x: 5, y: 0 });
    expect(p.x).toBeCloseTo(50); // centre horizontal
    expect(p.y).toBeCloseTo(45); // bas du carré de 40 px centré dans 50
  });

  it('aucun point exploitable → null, jamais une transformation inventée', () => {
    expect(fitTransform([], 100, 50, 5)).toBeNull();
    expect(fitTransform([{ x: NaN, y: 1 }], 100, 50, 5)).toBeNull();
  });
});

describe('pointsToSvgPath / traceLength / pointAtRatio', () => {
  const square: XY[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it('chemin fermé avec Z, ouvert sans ; « » sous 2 points', () => {
    expect(pointsToSvgPath(square, true)).toBe('M 0 0 L 1 0 L 1 1 L 0 1 Z');
    expect(pointsToSvgPath(square, false).endsWith(' Z')).toBe(false);
    expect(pointsToSvgPath([{ x: 0, y: 0 }])).toBe('');
  });

  it('traceLength : périmètre fermé, longueur ouverte', () => {
    expect(traceLength(square, true)).toBeCloseTo(4);
    expect(traceLength(square, false)).toBeCloseTo(3);
  });

  it('pointAtRatio : abscisse curviligne sur le périmètre', () => {
    expect(pointAtRatio(square, 0)).toEqual({ x: 0, y: 0 });
    const quart = pointAtRatio(square, 0.25);
    expect(quart?.x).toBeCloseTo(1);
    expect(quart?.y).toBeCloseTo(0);
    const half = pointAtRatio(square, 0.5);
    expect(half?.x).toBeCloseTo(1);
    expect(half?.y).toBeCloseTo(1);
    const loop = pointAtRatio(square, 1);
    expect(loop?.x).toBeCloseTo(0);
    expect(loop?.y).toBeCloseTo(0);
  });

  it('pointAtRatio : liste vide → null (rien d’inventé)', () => {
    expect(pointAtRatio([], 0.5)).toBeNull();
    expect(pointAtRatio([{ x: 2, y: 3 }], 0.5)).toEqual({ x: 2, y: 3 });
  });
});

describe('centerlineToTrace', () => {
  // Petit quadrilatère lat/lon autour du Circuit de Haute Saintonge.
  const latlon = [
    { lat: 45.4, lon: -0.44 },
    { lat: 45.401, lon: -0.44 },
    { lat: 45.401, lon: -0.438 },
    { lat: 45.4, lon: -0.438 },
  ];

  it('projette lat/lon (projectToMeters réutilisé) et remplit le cadre', () => {
    const trace = centerlineToTrace(latlon, 200, 120, 10);
    expect(trace.points).toHaveLength(4);
    expect(trace.path.startsWith('M ')).toBe(true);
    expect(trace.path.endsWith(' Z')).toBe(true);
    for (const p of trace.points) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(190);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(110);
    }
  });

  it('accepte des points déjà métriques {x, y}', () => {
    const trace = centerlineToTrace(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 8 },
      ],
      100,
      100
    );
    expect(trace.points).toHaveLength(3);
    expect(trace.path).not.toBe('');
  });

  it('centerline inexploitable → géométrie vide, jamais un tracé inventé', () => {
    expect(centerlineToTrace([], 100, 100)).toEqual({ path: '', points: [] });
    expect(centerlineToTrace([{ x: 1, y: 1 }], 100, 100)).toEqual({ path: '', points: [] });
    expect(centerlineToTrace(latlon, 0, 100)).toEqual({ path: '', points: [] });
  });
});

// ---------------------------------------------------------------------------
// Piliers
// ---------------------------------------------------------------------------

describe('pillarRatio / formatPillarValue', () => {
  it('ratio borné 0..1 sur l’échelle donnée', () => {
    expect(pillarRatio(50)).toBe(0.5);
    expect(pillarRatio(120)).toBe(1);
    expect(pillarRatio(-5)).toBe(0);
    expect(pillarRatio(30, 60)).toBe(0.5);
  });

  it('valeur absente ou échelle invalide → 0 (barre vide, pas une invention)', () => {
    expect(pillarRatio(null)).toBe(0);
    expect(pillarRatio(undefined)).toBe(0);
    expect(pillarRatio(NaN)).toBe(0);
    expect(pillarRatio(50, 0)).toBe(0);
  });

  it('affichage : entier arrondi (+ unité), « — » si absente', () => {
    expect(formatPillarValue(62.4)).toBe('62');
    expect(formatPillarValue(62.5, '%')).toBe('63 %');
    expect(formatPillarValue(null)).toBe('—');
    expect(formatPillarValue(NaN)).toBe('—');
  });
});
