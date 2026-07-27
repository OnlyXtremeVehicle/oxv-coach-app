import { sceneDistance, type ScenePoint } from '../projection';
import { buildRibbon, perVertex } from '../ribbon';

/** Distance d'un point au segment [a, b]. Sert à mesurer les débordements. */
function distanceAuSegment(p: ScenePoint, a: ScenePoint, b: ScenePoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return sceneDistance(p, a);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return sceneDistance(p, { x: a.x + t * vx, y: a.y + t * vy });
}

describe('buildRibbon — garanties', () => {
  it('rend null en dessous de deux points distincts', () => {
    expect(buildRibbon([], { width: 4 })).toBeNull();
    expect(buildRibbon([{ x: 0, y: 0 }], { width: 4 })).toBeNull();
    // Deux points confondus ne portent aucune direction.
    expect(
      buildRibbon(
        [
          { x: 3, y: 3 },
          { x: 3, y: 3 },
        ],
        { width: 4 }
      )
    ).toBeNull();
  });

  it('émet exactement deux sommets par point retenu', () => {
    const r = buildRibbon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      { width: 4 }
    )!;
    expect(r.count).toBe(3);
    expect(r.vertices).toHaveLength(6);
  });

  it('écarte les doublons consécutifs sans casser la trace', () => {
    const r = buildRibbon(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      { width: 4 }
    )!;
    expect(r.count).toBe(3);
  });

  it('respecte la largeur demandée sur une droite', () => {
    const largeur = 6;
    const r = buildRibbon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      { width: largeur }
    )!;
    for (let i = 0; i < r.count; i++) {
      const g = r.vertices[i * 2];
      const d = r.vertices[i * 2 + 1];
      expect(sceneDistance(g, d)).toBeCloseTo(largeur, 9);
    }
  });

  it('centre le ruban sur la trace', () => {
    const trace = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ];
    const r = buildRibbon(trace, { width: 8 })!;
    for (let i = 0; i < r.count; i++) {
      const g = r.vertices[i * 2];
      const d = r.vertices[i * 2 + 1];
      expect((g.x + d.x) / 2).toBeCloseTo(trace[i].x, 9);
      expect((g.y + d.y) / 2).toBeCloseTo(trace[i].y, 9);
    }
  });

  it('accepte une largeur variable point par point', () => {
    const trace = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const r = buildRibbon(trace, { width: (i) => 2 + i * 2 })!;
    for (let i = 0; i < r.count; i++) {
      expect(sceneDistance(r.vertices[i * 2], r.vertices[i * 2 + 1])).toBeCloseTo(2 + i * 2, 9);
    }
  });
});

describe('buildRibbon — la jointure, raison d’être du module', () => {
  // Sans onglet, les bords des deux segments ne se rejoignent pas au coin :
  // le ruban s'ouvre à l'extérieur. L'onglet allonge le décalage juste assez.
  it('allonge le décalage au coin pour que les bords se rejoignent', () => {
    const trace = [
      { x: -10, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -10 }, // virage à 90°
    ];
    const largeur = 4;
    const r = buildRibbon(trace, { width: largeur })!;

    const gCoin = r.vertices[2];
    const dCoin = r.vertices[3];
    const ecart = sceneDistance(gCoin, dCoin);

    // À 90°, l'onglet vaut 1/cos(45°) = √2 : la diagonale du coin est plus
    // longue que la largeur nominale, et c'est exactement ce qu'il faut.
    expect(ecart).toBeCloseTo(largeur * Math.SQRT2, 6);
  });

  it('garde le coin centré sur la trace malgré l’allongement', () => {
    const trace = [
      { x: -10, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -10 },
    ];
    const r = buildRibbon(trace, { width: 4 })!;
    expect((r.vertices[2].x + r.vertices[3].x) / 2).toBeCloseTo(0, 9);
    expect((r.vertices[2].y + r.vertices[3].y) / 2).toBeCloseTo(0, 9);
  });

  // Le garde-fou : sans bride, une épingle projetterait une pointe de plusieurs
  // dizaines de mètres hors du circuit.
  it('bride l’onglet dans une épingle serrée', () => {
    const trace = [
      { x: -10, y: 0 },
      { x: 0, y: 0 },
      { x: -10, y: 0.5 }, // demi-tour quasi complet
    ];
    const largeur = 4;
    const limite = 4;
    const r = buildRibbon(trace, { width: largeur, miterLimit: limite })!;

    const ecart = sceneDistance(r.vertices[2], r.vertices[3]);
    expect(ecart).toBeLessThanOrEqual(largeur * limite + 1e-9);
  });

  it('sans bride, l’épingle produirait une pointe bien plus longue', () => {
    const trace = [
      { x: -10, y: 0 },
      { x: 0, y: 0 },
      { x: -10, y: 0.5 },
    ];
    const serre = buildRibbon(trace, { width: 4, miterLimit: 2 })!;
    const large = buildRibbon(trace, { width: 4, miterLimit: 50 })!;
    expect(sceneDistance(large.vertices[2], large.vertices[3])).toBeGreaterThan(
      sceneDistance(serre.vertices[2], serre.vertices[3])
    );
  });

  it('aucun sommet ne s’échappe loin de la trace, même en épingle', () => {
    const trace = [
      { x: -10, y: 0 },
      { x: 0, y: 0 },
      { x: -10, y: 0.5 },
    ];
    const largeur = 4;
    const r = buildRibbon(trace, { width: largeur })!;
    for (const v of r.vertices) {
      const d = Math.min(
        distanceAuSegment(v, trace[0], trace[1]),
        distanceAuSegment(v, trace[1], trace[2])
      );
      // Toléré : la demi-largeur multipliée par la bride par défaut.
      expect(d).toBeLessThanOrEqual((largeur / 2) * 4 + 1e-6);
    }
  });

  it('supporte un demi-tour exact sans produire NaN', () => {
    const r = buildRibbon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0.0 + 0 }, // retour sur ses pas
      ],
      { width: 4 }
    )!;
    for (const v of r.vertices) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
    }
  });

  it('ne produit jamais NaN sur un tracé quelconque', () => {
    const trace: ScenePoint[] = [];
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * Math.PI * 4;
      trace.push({ x: Math.cos(a) * (20 + i * 0.3), y: Math.sin(a) * (20 + i * 0.3) });
    }
    const r = buildRibbon(trace, { width: 5 })!;
    expect(r.vertices).toHaveLength(trace.length * 2);
    for (const v of r.vertices) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
    }
  });
});

describe('perVertex', () => {
  it('double chaque valeur, dans l’ordre', () => {
    expect(perVertex(['a', 'b', 'c'])).toEqual(['a', 'a', 'b', 'b', 'c', 'c']);
  });

  it('rend un tableau vide sur une entrée vide', () => {
    expect(perVertex([])).toEqual([]);
  });

  it('produit autant d’entrées que le ruban a de sommets', () => {
    const trace = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 8 },
    ];
    const r = buildRibbon(trace, { width: 4 })!;
    const couleurs = perVertex(['#111111', '#222222', '#333333']);
    expect(couleurs).toHaveLength(r.vertices.length);
  });
});
