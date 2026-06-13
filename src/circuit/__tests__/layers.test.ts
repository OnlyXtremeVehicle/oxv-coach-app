import { generateCircuit } from '../circuitGenerator';
import { HAUTE_SAINTONGE_POINTS } from '../hauteSaintonge';
import {
  COACH_LAYERS,
  LAYERS,
  PILOT_LAYERS,
  colorByCorner,
  colorBySector,
  divergingColor,
  sectionCornerMap,
  sequentialColor,
} from '../layers';
import { DEMO_SESSION_INSIGHTS, type SessionInsights } from '../sessionInsights';

describe('échelles de couleur', () => {
  it('séquentielle : 0 = vert, 0.5 = or, 1 = rouge', () => {
    const lo = sequentialColor(0);
    const mid = sequentialColor(0.5);
    const hi = sequentialColor(1);
    expect(lo.g).toBeGreaterThan(lo.r); // vert
    expect(mid.r).toBeGreaterThan(0.8); // or (r et g hauts)
    expect(mid.g).toBeGreaterThan(0.5);
    expect(hi.r).toBeGreaterThan(hi.g); // rouge
  });

  it('divergente : -1 = bleu, 0 = acier, +1 = rouge', () => {
    expect(divergingColor(-1).b).toBeGreaterThan(divergingColor(-1).r); // bleu
    expect(divergingColor(1).r).toBeGreaterThan(divergingColor(1).b); // rouge
    const zero = divergingColor(0);
    expect(Math.abs(zero.r - zero.b)).toBeLessThan(0.15); // acier ~ neutre
  });
});

describe('colorByCorner sur la démo 7 virages', () => {
  it('Régularité : virage le moins dispersé = vert, le plus dispersé = rouge', () => {
    const { byCorner, min, max } = colorByCorner('regularity', DEMO_SESSION_INSIGHTS, 7);
    expect(min).toBe(0.6); // corner_3
    expect(max).toBe(1.6); // corner_5
    expect(byCorner[2]!.g).toBeGreaterThan(byCorner[2]!.r); // corner_3 vert
    expect(byCorner[4]!.r).toBeGreaterThan(byCorner[4]!.g); // corner_5 rouge
  });

  it("Vitesse d'apex : virage le plus rapide = vert (échelle inversée)", () => {
    const { byCorner } = colorByCorner('apexSpeed', DEMO_SESSION_INSIGHTS, 7);
    expect(byCorner[2]!.g).toBeGreaterThan(byCorner[2]!.r); // corner_3 (130 km/h) vert
    expect(byCorner[4]!.r).toBeGreaterThan(byCorner[4]!.g); // corner_5 (65 km/h) rouge
  });

  it('Équilibre châssis : sous-virage = bleu, survirage = rouge', () => {
    const { byCorner } = colorByCorner('chassisBalance', DEMO_SESSION_INSIGHTS, 7);
    expect(byCorner[3]!.b).toBeGreaterThan(byCorner[3]!.r); // corner_4 (-12 %) bleu
    expect(byCorner[6]!.r).toBeGreaterThan(byCorner[6]!.b); // corner_7 (+9 %) rouge
  });

  it('Anatomie freinage : freinage le plus court = vert, le plus long = rouge', () => {
    const { byCorner, min, max } = colorByCorner('brakeDist', DEMO_SESSION_INSIGHTS, 7);
    expect(min).toBe(60); // corner_3
    expect(max).toBe(150); // corner_5
    expect(byCorner[2]!.g).toBeGreaterThan(byCorner[2]!.r); // corner_3 (60 m) vert
    expect(byCorner[4]!.r).toBeGreaterThan(byCorner[4]!.g); // corner_5 (150 m) rouge
  });

  it('couche géométrie : aucune couleur de virage (coloriage = courbure ailleurs)', () => {
    const { byCorner, min, max } = colorByCorner('geometry', DEMO_SESSION_INSIGHTS, 7);
    expect(byCorner.every((c) => c === null)).toBe(true);
    expect(min).toBeNull();
    expect(max).toBeNull();
  });
});

describe('disponibilité des couches (état vide honnête)', () => {
  it('Régularité disponible sur la démo, absente sans session ou sur record vide', () => {
    expect(LAYERS.regularity.available(DEMO_SESSION_INSIGHTS)).toBe(true);
    expect(LAYERS.regularity.available(null)).toBe(false);
    const empty: SessionInsights = { ...DEMO_SESSION_INSIGHTS, dispersion: {} };
    expect(LAYERS.regularity.available(empty)).toBe(false);
    const nulled: SessionInsights = { ...DEMO_SESSION_INSIGHTS, dispersion: null };
    expect(LAYERS.regularity.available(nulled)).toBe(false);
  });

  it('la couche géométrie est toujours disponible', () => {
    expect(LAYERS.geometry.available(null)).toBe(true);
  });
});

describe('couche coach — Perte de temps (par secteur)', () => {
  it('timeLoss est une couche coach, absente des couches pilote', () => {
    expect(COACH_LAYERS).toContain('timeLoss');
    expect(PILOT_LAYERS).not.toContain('timeLoss');
    expect(LAYERS.timeLoss.role).toBe('coach');
  });

  it('disponible si ideal_lap.loss_by_sector_pct présent', () => {
    expect(LAYERS.timeLoss.available(DEMO_SESSION_INSIGHTS)).toBe(true);
    expect(LAYERS.timeLoss.available(null)).toBe(false);
    expect(LAYERS.timeLoss.available({ ...DEMO_SESSION_INSIGHTS, ideal_lap: null })).toBe(false);
  });

  it('colorBySector : secteur sans perte = vert, secteur de perte max = rouge', () => {
    // loss = [5,0,12,20,0,8,0,15,10,0,5,20] (12 secteurs) ; 120 sections → 10/secteur.
    const cols = colorBySector(DEMO_SESSION_INSIGHTS, 120);
    expect(cols).toHaveLength(120);
    const s1 = cols[15]!; // secteur 1 : 0 % de perte
    const s3 = cols[35]!; // secteur 3 : 20 % (perte max)
    expect(s1.g).toBeGreaterThan(s1.r); // 0 % → vert
    expect(s3.r).toBeGreaterThan(s3.g); // max → rouge
  });

  it('colorBySector vide sans ideal_lap', () => {
    expect(colorBySector(null, 10).every((c) => c === null)).toBe(true);
  });
});

describe('sectionCornerMap', () => {
  const circuit = generateCircuit(HAUTE_SAINTONGE_POINTS);
  const map = sectionCornerMap(circuit);

  it('a une entrée par section de ruban', () => {
    expect(map).toHaveLength(circuit.ribbon.length);
  });

  it('couvre exactement les plages [startIdx, endIdx) des 7 virages', () => {
    const expected = circuit.corners.reduce((n, c) => n + (c.endIdx - c.startIdx), 0);
    expect(map.filter((v) => v !== null)).toHaveLength(expected);
    for (const c of circuit.corners) {
      expect(map[c.startIdx]).toBe(c.index);
    }
  });
});
