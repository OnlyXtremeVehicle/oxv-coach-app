import {
  buildProjection,
  headingDelta,
  sceneDistance,
  sceneHeading,
  type GeoPoint,
} from '../projection';

/** Un carré de ~100 m de côté, quelque part en Charente-Maritime. */
const CARRE: GeoPoint[] = [
  { lat: 45.3, lon: -0.4 },
  { lat: 45.3, lon: -0.398722 }, // ~100 m à l'est
  { lat: 45.300898, lon: -0.398722 }, // ~100 m au nord
  { lat: 45.300898, lon: -0.4 },
];

describe('buildProjection', () => {
  it('rend null sur une liste vide — l’absence ne se remplace pas', () => {
    expect(buildProjection([])).toBeNull();
  });

  it('place l’origine au barycentre des points', () => {
    const p = buildProjection(CARRE)!;
    expect(p.origin.lat).toBeCloseTo(45.300449, 6);
    expect(p.origin.lon).toBeCloseTo(-0.399361, 6);
  });

  it('projette l’origine sur (0, 0)', () => {
    const p = buildProjection(CARRE)!;
    const s = p.project(p.origin);
    expect(s.x).toBeCloseTo(0, 9);
    expect(s.y).toBeCloseTo(0, 9);
  });

  it('respecte l’échelle : 100 m sur le terrain font 100 m en scène', () => {
    const p = buildProjection(CARRE)!;
    const a = p.project(CARRE[0]);
    const b = p.project(CARRE[1]);
    // Tolérance d'un mètre : les coordonnées d'entrée sont arrondies.
    expect(sceneDistance(a, b)).toBeCloseTo(100, 0);
  });

  it('inverse Y : plus au nord veut dire plus haut à l’écran', () => {
    const p = buildProjection(CARRE)!;
    const sud = p.project({ lat: 45.3, lon: -0.4 });
    const nord = p.project({ lat: 45.301, lon: -0.4 });
    expect(nord.y).toBeLessThan(sud.y);
  });

  // Le point du lot : la projection ne connaît AUCUN circuit.
  it('donne des origines différentes pour des circuits différents', () => {
    const charente = buildProjection(CARRE)!;
    const valence = buildProjection([
      { lat: 39.4854, lon: -0.6266 },
      { lat: 39.4864, lon: -0.6256 },
    ])!;
    expect(valence.origin.lat).not.toBeCloseTo(charente.origin.lat, 1);
    // Et chacune projette SON origine sur zéro — aucune n'est hors champ.
    expect(sceneDistance(valence.project(valence.origin), { x: 0, y: 0 })).toBeCloseTo(0, 9);
  });

  it('corrige la longitude par la latitude', () => {
    // Un même écart en degrés de longitude couvre moins de mètres au nord.
    const nord = buildProjection([
      { lat: 60, lon: 0 },
      { lat: 60, lon: 0.01 },
    ])!;
    const equateur = buildProjection([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.01 },
    ])!;
    const dNord = sceneDistance(
      nord.project({ lat: 60, lon: 0 }),
      nord.project({ lat: 60, lon: 0.01 })
    );
    const dEq = sceneDistance(
      equateur.project({ lat: 0, lon: 0 }),
      equateur.project({ lat: 0, lon: 0.01 })
    );
    expect(dNord).toBeLessThan(dEq);
    expect(dNord / dEq).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 3);
  });
});

describe('viewBox', () => {
  it('couvre l’emprise avec la marge demandée', () => {
    const p = buildProjection(CARRE)!;
    const [x, y, w, h] = p.viewBox(0).split(' ').map(Number);
    expect(w).toBeCloseTo(p.bounds.maxX - p.bounds.minX, 6);
    expect(h).toBeCloseTo(p.bounds.maxY - p.bounds.minY, 6);
    expect(x).toBeCloseTo(p.bounds.minX, 6);
    expect(y).toBeCloseTo(p.bounds.minY, 6);
  });

  it('applique la marge proportionnellement', () => {
    const p = buildProjection(CARRE)!;
    const [, , w0] = p.viewBox(0).split(' ').map(Number);
    const [, , w20] = p.viewBox(20).split(' ').map(Number);
    expect(w20).toBeCloseTo(w0 * 1.4, 6);
  });

  // Sans garde, un point unique donnerait un cadre d'aire nulle : rien à voir,
  // et une division par zéro chez qui met à l'échelle.
  it('garantit un cadre même sur un point unique', () => {
    const p = buildProjection([{ lat: 45.3, lon: -0.4 }])!;
    const [, , w, h] = p.viewBox(0).split(' ').map(Number);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('centre le cadre garanti sur les points, sans les décaler', () => {
    const p = buildProjection([{ lat: 45.3, lon: -0.4 }])!;
    const [x, y, w, h] = p.viewBox(0).split(' ').map(Number);
    const s = p.project({ lat: 45.3, lon: -0.4 });
    expect(x + w / 2).toBeCloseTo(s.x, 6);
    expect(y + h / 2).toBeCloseTo(s.y, 6);
  });

  it('garantit un cadre sur un tracé parfaitement droit', () => {
    const p = buildProjection([
      { lat: 45.3, lon: -0.4 },
      { lat: 45.3, lon: -0.398 },
    ])!;
    const [, , w, h] = p.viewBox(0).split(' ').map(Number);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0); // l'axe plat est celui qui aurait valu zéro
  });
});

describe('sceneHeading', () => {
  it('rend null sans déplacement — un cap ne s’invente pas', () => {
    expect(sceneHeading({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('oriente le nord à 0 et l’est à 90', () => {
    expect(sceneHeading({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(0, 9);
    expect(sceneHeading({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90, 9);
    expect(sceneHeading({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(180, 9);
    expect(sceneHeading({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(270, 9);
  });

  it('reste dans [0, 360)', () => {
    for (let a = 0; a < 360; a += 7) {
      const r = (a * Math.PI) / 180;
      const h = sceneHeading({ x: 0, y: 0 }, { x: Math.sin(r), y: -Math.cos(r) })!;
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(h).toBeCloseTo(a, 6);
    }
  });
});

describe('headingDelta', () => {
  it('mesure l’écart le plus court, y compris par-dessus zéro', () => {
    expect(headingDelta(350, 10)).toBeCloseTo(20, 9);
    expect(headingDelta(10, 350)).toBeCloseTo(20, 9);
  });

  it('est nul pour deux caps identiques', () => {
    expect(headingDelta(42, 42)).toBeCloseTo(0, 9);
  });

  it('plafonne à 180 pour des caps opposés', () => {
    expect(headingDelta(0, 180)).toBeCloseTo(180, 9);
    expect(headingDelta(270, 90)).toBeCloseTo(180, 9);
  });

  it('est symétrique et toujours dans [0, 180]', () => {
    for (let a = 0; a < 360; a += 13) {
      for (let b = 0; b < 360; b += 17) {
        const d = headingDelta(a, b);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(180 + 1e-9);
        expect(d).toBeCloseTo(headingDelta(b, a), 9);
      }
    }
  });
});
