import {
  generateCircuit,
  projectToMeters,
  curvature,
  resampleByDistance,
  buildRibbon,
  detectCorners,
  type LatLon,
} from '../circuitGenerator';
import { HAUTE_SAINTONGE_POINTS } from '../hauteSaintonge';

describe('generateCircuit — Haute Saintonge (OSM 54412766)', () => {
  const circuit = generateCircuit(HAUTE_SAINTONGE_POINTS);

  it('détecte 7 virages (invariant documenté specs v4 §05)', () => {
    expect(circuit.corners).toHaveLength(7);
  });

  it('mesure une longueur proche de 2,2 km', () => {
    expect(circuit.length_m).toBeGreaterThan(2000);
    expect(circuit.length_m).toBeLessThan(2400);
  });

  it('produit un ruban aligné sur la ligne médiane', () => {
    expect(circuit.centerline.length).toBeGreaterThan(0);
    expect(circuit.ribbon).toHaveLength(circuit.centerline.length);
  });

  it('numérote les virages séquentiellement à partir de 1', () => {
    circuit.corners.forEach((c, i) => {
      expect(c.index).toBe(i + 1);
    });
  });

  it('produit des virages cohérents (sens, rayon, bornes)', () => {
    for (const c of circuit.corners) {
      expect(['left', 'right']).toContain(c.direction);
      expect(c.radius_m).toBeGreaterThan(0);
      expect(c.startIdx).toBeLessThan(c.endIdx);
      expect(c.apexIdx).toBeGreaterThanOrEqual(c.startIdx);
      expect(c.apexIdx).toBeLessThan(c.endIdx);
    }
  });

  it('conserve les paramètres effectifs', () => {
    expect(circuit.params).toEqual({
      smoothWin: 1,
      resampleStep: 10,
      cornerRadius: 100,
      trackWidth: 12,
      closed: true,
    });
  });

  it('garde une largeur de piste constante (demi-largeur = trackWidth/2)', () => {
    const half = circuit.params.trackWidth / 2;
    const mid = circuit.ribbon[Math.floor(circuit.ribbon.length / 2)];
    const dLeft = Math.hypot(mid.left[0] - mid.center[0], mid.left[1] - mid.center[1]);
    const dRight = Math.hypot(mid.right[0] - mid.center[0], mid.right[1] - mid.center[1]);
    expect(dLeft).toBeCloseTo(half, 5);
    expect(dRight).toBeCloseTo(half, 5);
  });
});

describe('briques pures du générateur', () => {
  it('projectToMeters place le premier point à l’origine', () => {
    const pts: LatLon[] = [
      { lat: 45.24, lon: -0.095 },
      { lat: 45.25, lon: -0.094 },
    ];
    const m = projectToMeters(pts);
    expect(m[0].x).toBeCloseTo(0, 6);
    expect(m[0].y).toBeCloseTo(0, 6);
    // un degré de latitude ≈ 111320 m → le 2e point est ~1,1 km plus au nord
    expect(m[1].y).toBeGreaterThan(1000);
  });

  it('curvature ≈ 0 sur une ligne droite', () => {
    const line = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 }));
    const k = curvature(line);
    for (const v of k) expect(v).toBeCloseTo(0, 6);
  });

  it('detectCorners ne trouve aucun virage sur une ligne droite', () => {
    const line = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 0 }));
    expect(detectCorners(line, curvature(line), 100)).toHaveLength(0);
  });

  it('detectCorners trouve un virage sur un quart de cercle serré', () => {
    const R = 30;
    const arc = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 39) * (Math.PI / 2);
      return { x: R * Math.cos(a), y: R * Math.sin(a) };
    });
    const corners = detectCorners(arc, curvature(arc), 100);
    expect(corners.length).toBeGreaterThanOrEqual(1);
    expect(corners[0].radius_m).toBeGreaterThan(10);
    expect(corners[0].radius_m).toBeLessThan(60);
  });

  it('resampleByDistance espace les points d’au moins `step`', () => {
    const dense = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }));
    const out = resampleByDistance(dense, 10);
    for (let i = 1; i < out.length; i++) {
      expect(Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y)).toBeGreaterThanOrEqual(
        10 - 1e-9
      );
    }
  });

  it('buildRibbon génère deux bords symétriques', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const rib = buildRibbon(line, 12, false);
    expect(rib).toHaveLength(3);
    // piste horizontale → bords décalés de ±6 en y
    expect(Math.abs(rib[1].left[1] - rib[1].right[1])).toBeCloseTo(12, 6);
  });
});
