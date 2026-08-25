import type { Point } from '@/circuit/circuitGenerator';

import {
  ETENDUE_MIN_PORTION_M,
  TOLERANCE_ABSCISSE_M,
  VERSION_PROJECTION_CURVILIGNE,
  construireIndex,
  longueurTotale,
  pointADistance,
  portion,
  type IndexCurviligne,
} from '../projectionCurviligne';

/**
 * Le banc d'essai : un carré de 100 m de côté, fermé — 400 m de tour, chaque
 * coin à une cumulée ronde (0, 100, 200, 300). Toute géométrie s'y vérifie de
 * tête, ce qui est exactement ce qu'on demande à un test d'interpolation.
 */
const CARRE: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

function indexCarre(): IndexCurviligne {
  const index = construireIndex(CARRE, true);
  if (index === null) throw new Error('le carré de test doit être indexable');
  return index;
}

function indexOuvert(): IndexCurviligne {
  const index = construireIndex(CARRE, false);
  if (index === null) throw new Error('la polyligne ouverte de test doit être indexable');
  return index;
}

describe('construireIndex', () => {
  it('cumule les distances et compte le segment de fermeture d’un tour fermé', () => {
    const index = indexCarre();
    expect(index.cumulees).toEqual([0, 100, 200, 300]);
    expect(index.longueurTotale).toBe(400);
    expect(longueurTotale(index)).toBe(400);
    expect(index.ferme).toBe(true);
  });

  it('sans fermeture, la longueur s’arrête au dernier sommet', () => {
    const index = indexOuvert();
    expect(index.longueurTotale).toBe(300);
    expect(index.ferme).toBe(false);
  });

  it('retire le doublon de fermeture (forme usuelle d’un way OSM fermé)', () => {
    const avecDoublon = [...CARRE, { x: 0, y: 0 }];
    const index = construireIndex(avecDoublon, true);
    expect(index).not.toBeNull();
    expect(index?.points).toHaveLength(4);
    expect(index?.longueurTotale).toBe(400);
  });

  it('accepte une centerline lat/lon (projectToMeters réutilisé, pas réinventé)', () => {
    // ~111,32 m par degré de latitude : 0,001° ≈ 111,32 m.
    const latlon = [
      { lat: 45.0, lon: 1.0 },
      { lat: 45.001, lon: 1.0 },
    ];
    const index = construireIndex(latlon, false);
    expect(index).not.toBeNull();
    expect(index?.longueurTotale).toBeCloseTo(111.32, 1);
  });

  it('rend null pour une polyligne inexploitable — jamais un index inventé', () => {
    expect(construireIndex([], true)).toBeNull();
    expect(construireIndex([{ x: 0, y: 0 }], true)).toBeNull();
    // Tous les points confondus : longueur nulle, rien à indexer.
    expect(
      construireIndex(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        true
      )
    ).toBeNull();
    // Points non finis écartés : il n'en reste qu'un.
    expect(
      construireIndex(
        [
          { x: 0, y: 0 },
          { x: Number.NaN, y: 3 },
        ],
        false
      )
    ).toBeNull();
  });

  it('la version du calcul est posée', () => {
    expect(VERSION_PROJECTION_CURVILIGNE).toBe('1.0.0');
  });
});

describe('pointADistance', () => {
  it('interpole linéairement entre deux sommets', () => {
    const index = indexCarre();
    expect(pointADistance(index, 0)).toEqual({ x: 0, y: 0 });
    expect(pointADistance(index, 50)).toEqual({ x: 50, y: 0 });
    expect(pointADistance(index, 100)).toEqual({ x: 100, y: 0 });
    expect(pointADistance(index, 250)).toEqual({ x: 50, y: 100 });
  });

  it('sur un tour fermé, le segment de fermeture existe et la fin rejoint le départ', () => {
    const index = indexCarre();
    // 350 m : au milieu du segment de fermeture (0, 100) → (0, 0).
    expect(pointADistance(index, 350)).toEqual({ x: 0, y: 50 });
    expect(pointADistance(index, 400)).toEqual({ x: 0, y: 0 });
  });

  it('hors de [0, longueur], null — jamais une extrapolation silencieuse', () => {
    const index = indexCarre();
    expect(pointADistance(index, -1)).toBeNull();
    expect(pointADistance(index, 401)).toBeNull();
    expect(pointADistance(index, Number.NaN)).toBeNull();
    expect(pointADistance(index, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('un résidu flottant sous la tolérance est rabattu sur la borne, pas rejeté', () => {
    const index = indexCarre();
    expect(pointADistance(index, -TOLERANCE_ABSCISSE_M / 2)).toEqual({ x: 0, y: 0 });
    expect(pointADistance(index, 400 + TOLERANCE_ABSCISSE_M / 2)).toEqual({ x: 0, y: 0 });
    // Et juste au-delà de la tolérance, c'est bien dehors.
    expect(pointADistance(index, 400 + 2 * TOLERANCE_ABSCISSE_M)).toBeNull();
  });

  it('sur un tracé ouvert, la longueur totale est le dernier sommet', () => {
    const index = indexOuvert();
    expect(pointADistance(index, 300)).toEqual({ x: 0, y: 100 });
    expect(pointADistance(index, 301)).toBeNull();
  });

  it('des sommets confondus ne cassent pas l’interpolation', () => {
    const index = construireIndex(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 }, // doublon en plein tracé
        { x: 20, y: 0 },
      ],
      false
    );
    expect(index).not.toBeNull();
    expect(index?.longueurTotale).toBe(20);
    expect(pointADistance(index as IndexCurviligne, 10)).toEqual({ x: 10, y: 0 });
    expect(pointADistance(index as IndexCurviligne, 15)).toEqual({ x: 15, y: 0 });
  });
});

describe('portion', () => {
  it('rend la sous-polyligne : extrémités interpolées, sommets intérieurs conservés', () => {
    const index = indexCarre();
    expect(portion(index, 50, 150)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
  });

  it('une portion entre deux sommets exacts ne les doublonne pas', () => {
    const index = indexCarre();
    expect(portion(index, 100, 200)).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('boucle à travers la ligne sur un tour fermé, sans doublonner la jonction', () => {
    const index = indexCarre();
    // De 350 m à 50 m : moitié du segment de fermeture, la ligne, moitié du premier.
    expect(portion(index, 350, 50)).toEqual([
      { x: 0, y: 50 },
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ]);
  });

  it('portion du tour entier : de 0 à la longueur totale', () => {
    const index = indexCarre();
    expect(portion(index, 0, 400)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ]);
  });

  it('sur un tracé ouvert, rien ne boucle : fin < début rend null', () => {
    const index = indexOuvert();
    expect(portion(index, 250, 50)).toBeNull();
  });

  it('borne hors du tour → null, jamais une portion partielle silencieuse', () => {
    const index = indexCarre();
    expect(portion(index, -10, 50)).toBeNull();
    expect(portion(index, 50, 500)).toBeNull();
    expect(portion(index, Number.NaN, 50)).toBeNull();
  });

  it('sans étendue, pas de portion : un point n’est pas un segment', () => {
    const index = indexCarre();
    expect(portion(index, 120, 120)).toBeNull();
    expect(portion(index, 120, 120 + ETENDUE_MIN_PORTION_M / 2)).toBeNull();
  });

  it('bouclage dégénéré (deux résidus sous la tolérance de part et d’autre de la ligne) → null', () => {
    const index = indexCarre();
    const epsilon = ETENDUE_MIN_PORTION_M / 4;
    expect(portion(index, 400 - epsilon, epsilon)).toBeNull();
  });

  it('bouclage dont une seule moitié a une étendue : la portion, c’est elle', () => {
    const index = indexCarre();
    const epsilon = ETENDUE_MIN_PORTION_M / 4;
    // Le côté « avant la ligne » est un résidu : la portion est 0 → 50.
    const p = portion(index, 400 - epsilon, 50);
    if (p === null) throw new Error('une portion était attendue');
    expect(p[p.length - 1]).toEqual({ x: 50, y: 0 });
    expect(p.length).toBeGreaterThanOrEqual(2);
  });

  it('les zones de decouperZones se recollent bout à bout sur le tracé', () => {
    // Le cas d'usage réel : surligner la zone de confiance réduite. Quatre
    // zones de 100 m sur le carré — chaque portion commence où l'autre finit.
    const index = indexCarre();
    for (let i = 0; i < 4; i++) {
      const p = portion(index, i * 100, (i + 1) * 100);
      if (p === null) throw new Error(`la zone ${i + 1} devait avoir une portion`);
      const suivant = pointADistance(index, (i + 1) * 100);
      expect(p[p.length - 1]).toEqual(suivant);
    }
  });
});
