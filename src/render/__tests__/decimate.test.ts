import { decimate, traceLength } from '../decimate';
import type { ScenePoint } from '../projection';

/** Ligne droite de `n` points espacés de `pas` mètres. */
function ligneDroite(n: number, pas: number): ScenePoint[] {
  return Array.from({ length: n }, (_, i) => ({ x: i * pas, y: 0 }));
}

/** Arc de cercle : `n` points sur `angleTotal` degrés, rayon `r` mètres. */
function arc(n: number, r: number, angleTotal: number): ScenePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((angleTotal * i) / (n - 1)) * (Math.PI / 180);
    return { x: r * Math.sin(a), y: -r * Math.cos(a) };
  });
}

describe('decimate — garanties de base', () => {
  it('ne touche pas à une trace de deux points ou moins', () => {
    expect(decimate([])).toEqual([]);
    const un = [{ x: 1, y: 2 }];
    expect(decimate(un)).toEqual(un);
    const deux = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
    ];
    expect(decimate(deux)).toEqual(deux);
  });

  it('conserve toujours les deux extrémités', () => {
    const pts = ligneDroite(500, 0.05); // très dense, très droit
    const out = decimate(pts);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
  });

  it('ne modifie pas l’entrée et rend les objets d’origine', () => {
    const pts = ligneDroite(50, 0.2);
    const copie = [...pts];
    const out = decimate(pts);
    expect(pts).toEqual(copie);
    for (const p of out) expect(pts).toContain(p);
  });

  it('préserve l’ordre', () => {
    const pts = arc(200, 30, 180);
    const out = decimate(pts);
    const indices = out.map((p) => pts.indexOf(p));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('laisse passer la charge utile attachée aux points', () => {
    const pts = ligneDroite(20, 3).map((p, i) => ({ ...p, vitesse: i * 10 }));
    const out = decimate(pts);
    expect(out.every((p) => typeof p.vitesse === 'number')).toBe(true);
  });
});

describe('decimate — le point du module : la ligne droite paie, le virage non', () => {
  it('allège franchement une ligne droite dense', () => {
    const pts = ligneDroite(1000, 0.1); // 1000 points sur 100 m
    const out = decimate(pts);
    // Un point tous les 1,5 m environ : on attend un ordre de grandeur de gain.
    expect(out.length).toBeLessThan(pts.length / 10);
  });

  it('garde beaucoup plus de points dans une épingle qu’en ligne droite, à densité ÉGALE', () => {
    const pas = 0.1;
    const droite = ligneDroite(300, pas);
    // Même nombre de points, même espacement — seule la courbure diffère.
    const rayon = (300 * pas) / Math.PI; // demi-tour de même longueur d'arc
    const epingle = arc(300, rayon, 180);

    const gardeDroite = decimate(droite).length;
    const gardeEpingle = decimate(epingle).length;

    expect(gardeEpingle).toBeGreaterThan(gardeDroite * 3);
  });

  it('ne transforme pas une courbe en angle : la longueur est préservée', () => {
    const pts = arc(400, 25, 180);
    const out = decimate(pts);
    const perte = 1 - traceLength(out) / traceLength(pts);
    // Moins de 1 % de longueur perdue : la géométrie est allégée, pas mutilée.
    expect(perte).toBeLessThan(0.01);
  });

  it('préserve aussi la longueur d’une droite', () => {
    const pts = ligneDroite(1000, 0.1);
    const out = decimate(pts);
    expect(traceLength(out)).toBeCloseTo(traceLength(pts), 6);
  });
});

describe('decimate — réglages', () => {
  it('un seuil de distance plus grand décime davantage', () => {
    const pts = ligneDroite(1000, 0.1);
    const fin = decimate(pts, { minDistanceM: 0.5 }).length;
    const gros = decimate(pts, { minDistanceM: 5 }).length;
    expect(gros).toBeLessThan(fin);
  });

  it('un seuil angulaire plus fin garde davantage de courbure', () => {
    const pts = arc(400, 50, 90);
    const large = decimate(pts, { minDistanceM: 100, minHeadingDeg: 10 }).length;
    const fin = decimate(pts, { minDistanceM: 100, minHeadingDeg: 0.5 }).length;
    expect(fin).toBeGreaterThan(large);
  });

  it('supporte des points confondus sans boucler ni les garder', () => {
    const pts: ScenePoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const out = decimate(pts);
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[3]);
  });
});

describe('traceLength', () => {
  it('vaut zéro sur zéro ou un point', () => {
    expect(traceLength([])).toBe(0);
    expect(traceLength([{ x: 3, y: 4 }])).toBe(0);
  });

  it('somme les segments', () => {
    expect(
      traceLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 14 },
      ])
    ).toBeCloseTo(15, 9);
  });
});
