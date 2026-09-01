import {
  generateCircuit,
  projectToMeters,
  curvature,
  resampleByDistance,
  detectCorners,
  type LatLon,
  parseOsmRelation,
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

  it('produit une ligne médiane non vide', () => {
    // Cette assertion vérifiait aussi que le ruban suivait la médiane. Le ruban
    // a été retiré le 03/08/2026 : personne ne le lisait, et il était reconstruit
    // à chaque appel — y compris par la fonction serveur, pour chaque circuit.
    expect(circuit.centerline.length).toBeGreaterThan(0);
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

  it('rappelle le réglage qui a produit le tracé', () => {
    // `trackWidth` ne pilote plus aucun calcul depuis le retrait du ruban ; il
    // reste dans `params` pour que l'on sache avec quel réglage un tracé a été
    // produit. Ce test dit exactement cela, et rien de plus.
    expect(circuit.params.trackWidth).toBe(12);
    expect(circuit.params.resampleStep).toBeGreaterThan(0);
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
});

// ===========================================================================
// LES CIRCUITS PORTÉS PAR UNE RELATION — lot P2, 30/08/2026
// ===========================================================================

/**
 * POURQUOI CE CHEMIN EXISTE, et ce que la mesure a dit.
 *
 * Albi tient dans un seul way — 95802415, anneau fermé de 137 points, 3 562 m.
 * Le Bugatti, non : ses cinq ways nommés « Circuit Bugatti » totalisent 1 690 m
 * pour un circuit qui en fait 4 185. Le reste de la boucle porte les noms des
 * virages et se partage avec le circuit des 24 Heures.
 *
 * La relation 2725877 tient le tracé complet : dix-huit ways, zéro extrémité
 * impaire, et une fois chaînée — vérifié le 30/08 contre l'API réelle —
 * 589 points, fermée, 4 165 m, neuf virages. Le Bugatti mesure 4 185 m.
 *
 * Les cas ci-dessous sont SYNTHÉTIQUES : ils testent le chaînage, pas la
 * géographie. Un carré de quatre segments suffit à prouver les trois règles qui
 * comptent — le désordre, l'inversion, et le refus.
 */
describe('parseOsmRelation — chaîner ce qu’OSM livre en désordre', () => {
  /** Quatre coins d'un carré : 1 → 2 → 3 → 4 → 1. */
  const NOEUDS = [
    { type: 'node' as const, id: 1, lat: 0, lon: 0 },
    { type: 'node' as const, id: 2, lat: 0, lon: 1 },
    { type: 'node' as const, id: 3, lat: 1, lon: 1 },
    { type: 'node' as const, id: 4, lat: 1, lon: 0 },
  ];

  const relation = (membres: number[], tags?: Record<string, string>) => ({
    type: 'relation' as const,
    id: 999,
    members: membres.map((ref) => ({ type: 'way', ref })),
    tags: tags ?? { name: 'Circuit d’essai' },
  });

  const way = (id: number, nodes: number[]) => ({ type: 'way' as const, id, nodes });

  it('remet les segments dans l’ordre, quel que soit celui de la relation', () => {
    const r = parseOsmRelation({
      elements: [
        relation([30, 10, 40, 20]), // volontairement mélangés
        way(10, [1, 2]),
        way(20, [2, 3]),
        way(30, [3, 4]),
        way(40, [4, 1]),
        ...NOEUDS,
      ],
    });
    expect(r.points).toHaveLength(5); // le carré, premier point répété à la fin
    expect(r.closed).toBe(true);
    expect(r.name).toBe('Circuit d’essai');
    expect(r.osmWayId).toBe(999);
  });

  /**
   * OSM n'oriente pas les membres d'une relation. Un segment décrit à l'envers
   * doit être retourné, jamais rejeté — sinon la moitié des circuits réels
   * échouerait au chaînage.
   */
  it('retourne un segment décrit à l’envers', () => {
    const r = parseOsmRelation({
      elements: [
        relation([10, 20, 30, 40]),
        way(10, [1, 2]),
        way(20, [3, 2]), // à l'envers
        way(30, [3, 4]),
        way(40, [1, 4]), // à l'envers
        ...NOEUDS,
      ],
    });
    expect(r.closed).toBe(true);
    expect(r.points.map((p) => `${p.lat},${p.lon}`)).toEqual(['0,0', '0,1', '1,1', '1,0', '0,0']);
  });

  /**
   * LE REFUS EST LE POINT. Rendre le morceau chaîné donnerait un circuit amputé
   * qui a l'air complet : le générateur en tirerait des virages, une longueur et
   * des positions curvilignes fausses, sans que rien ne le signale.
   */
  it('refuse un tracé incomplet, et dit combien de segments manquent', () => {
    expect(() =>
      parseOsmRelation({
        elements: [
          relation([10, 20, 40]),
          way(10, [1, 2]),
          way(20, [2, 3]),
          way(40, [7, 8]), // orphelin : ne touche rien
          { type: 'node' as const, id: 7, lat: 5, lon: 5 },
          { type: 'node' as const, id: 8, lat: 5, lon: 6 },
          ...NOEUDS,
        ],
      })
    ).toThrow(/1 segment\(s\) sur 3/);
  });

  it('une relation sans way exploitable est refusée, pas rendue vide', () => {
    expect(() => parseOsmRelation({ elements: [relation([])] })).toThrow(/aucun way/i);
  });

  it('une réponse sans relation est refusée', () => {
    expect(() => parseOsmRelation({ elements: [way(10, [1, 2]), ...NOEUDS] })).toThrow(
      /aucune relation/i
    );
  });

  /** Un tracé ouvert reste possible et se DIT ouvert — il n'est pas refermé d'office. */
  it('un tracé qui ne se referme pas le dit', () => {
    const r = parseOsmRelation({
      elements: [relation([10, 20]), way(10, [1, 2]), way(20, [2, 3]), ...NOEUDS],
    });
    expect(r.closed).toBe(false);
    expect(r.points).toHaveLength(3);
  });
});
