/**
 * La géométrie de la courbe de delta — jalon 4, phase 4septies.
 *
 * ---
 *
 * POURQUOI CES TESTS EXISTENT
 *
 * Une mise à l'échelle fausse ne plante pas. Elle produit une courbe plausible,
 * bien dessinée, et fausse. Un axe qui n'inclut pas zéro, un facteur inversé,
 * un trait tiré par-dessus un trou de mesure : rien de tout cela ne lève
 * d'exception, et tout cela ment.
 *
 * D'où une géométrie séparée du dessin, et vérifiée sur des valeurs qu'on
 * calcule à la main.
 */

import {
  AMPLITUDE_MIN_S,
  ancreRepere,
  echelleDelta,
  formateDistance,
  formateSecondes,
  runs,
  versAttributPoints,
  versX,
  versY,
  type Cadre,
} from '../courbeDelta';

const CADRE: Cadre = { largeur: 300, hauteur: 100 };

/** Grille régulière de 0 à 1000 m, par pas de 100. */
const GRILLE = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

describe('l’échelle', () => {
  it('rend null sans grille — on ne dessine pas un cadre vide', () => {
    expect(echelleDelta([], [], CADRE)).toBeNull();
  });

  /**
   * ZÉRO EST LA LIGNE DE RÉFÉRENCE.
   *
   * Sur une séance où le pilote perd partout, toute la courbe est positive. Si
   * l'axe s'ajustait aux seules valeurs, la ligne de zéro sortirait du cadre —
   * et le signe de la courbe n'aurait plus rien à quoi se rapporter.
   */
  it('contient toujours zéro, même quand la courbe est d’un seul côté', () => {
    const e = echelleDelta(
      GRILLE,
      GRILLE.map((_, i) => i * 0.5),
      CADRE
    )!;
    expect(e.deltaMin).toBeLessThanOrEqual(0);
    expect(e.deltaMax).toBeGreaterThan(0);
    expect(e.yZero).toBeGreaterThanOrEqual(0);
    expect(e.yZero).toBeLessThanOrEqual(CADRE.hauteur);
  });

  it('contient zéro aussi quand tout est négatif', () => {
    const e = echelleDelta(
      GRILLE,
      GRILLE.map((_, i) => -i * 0.5),
      CADRE
    )!;
    expect(e.deltaMax).toBeGreaterThanOrEqual(0);
    expect(e.deltaMin).toBeLessThan(0);
  });

  /**
   * Un tour comparé à lui-même donne zéro partout. Sans plancher d'amplitude,
   * la division par une étendue nulle produirait NaN — ou le bruit numérique
   * s'afficherait comme une courbe agitée, ce qui serait pire.
   */
  it('pose un plancher d’amplitude sur une courbe plate', () => {
    const e = echelleDelta(
      GRILLE,
      GRILLE.map(() => 0),
      CADRE
    )!;
    expect(e.deltaMax - e.deltaMin).toBeGreaterThanOrEqual(AMPLITUDE_MIN_S);
    expect(Number.isFinite(e.yZero)).toBe(true);
  });

  it('ignore les valeurs non finies plutôt que de s’y étalonner', () => {
    const e = echelleDelta(GRILLE, [0, NaN, 1, Infinity, 2, null, 1, 0, 0, 0, 0], CADRE)!;
    expect(Number.isFinite(e.deltaMin)).toBe(true);
    expect(Number.isFinite(e.deltaMax)).toBe(true);
    expect(e.deltaMax).toBeGreaterThanOrEqual(2);
  });
});

describe('les projections', () => {
  const e = echelleDelta(GRILLE, [-1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1], CADRE)!;

  it('la distance de départ est à gauche, celle d’arrivée à droite', () => {
    expect(versX(0, e, CADRE)).toBeCloseTo(0, 6);
    expect(versX(1000, e, CADRE)).toBeCloseTo(CADRE.largeur, 6);
    expect(versX(500, e, CADRE)).toBeCloseTo(CADRE.largeur / 2, 6);
  });

  /** L'axe des ordonnées est inversé en SVG : plus de secondes = plus haut. */
  it('un delta plus grand se dessine plus haut', () => {
    expect(versY(1, e, CADRE)).toBeLessThan(versY(-1, e, CADRE));
  });

  it('le zéro projeté tombe sur la ligne de référence', () => {
    expect(versY(0, e, CADRE)).toBeCloseTo(e.yZero, 6);
  });

  it('une étendue nulle ne divise pas par zéro', () => {
    const plat = { distanceMin: 5, distanceMax: 5, deltaMin: 2, deltaMax: 2, yZero: 50 };
    expect(Number.isFinite(versX(5, plat, CADRE))).toBe(true);
    expect(Number.isFinite(versY(2, plat, CADRE))).toBe(true);
  });
});

describe('les trous ne se franchissent pas', () => {
  const e = echelleDelta(
    GRILLE,
    GRILLE.map(() => 0),
    CADRE
  )!;

  it('une courbe continue fait un seul segment', () => {
    const r = runs(
      GRILLE,
      GRILLE.map((_, i) => i * 0.1),
      e,
      CADRE
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toHaveLength(GRILLE.length);
  });

  /**
   * `computeDelta` rend `null` sous le plancher de vitesse. Une polyligne
   * unique passerait par-dessus en ligne droite, et ce trait se lirait comme
   * une mesure — alors qu'il ne mesure rien.
   */
  it('un null coupe le segment, jamais un trait par-dessus', () => {
    const r = runs(GRILLE, [0, 0.1, 0.2, null, null, 0.5, 0.6, 0.7, 0.8, 0.9, 1], e, CADRE);
    expect(r).toHaveLength(2);
    expect(r[0]).toHaveLength(3);
    expect(r[1]).toHaveLength(6);
  });

  it('une valeur non finie coupe aussi', () => {
    expect(runs(GRILLE, [0, NaN, 1, 1, 1, 1, 1, 1, 1, 1, 1], e, CADRE)).toHaveLength(2);
  });

  /** Un point isolé se garde : le taire serait plus faux que le montrer seul. */
  it('un point isolé fait un segment d’un point', () => {
    const r = runs([0, 100, 200], [null, 0.5, null], e, CADRE);
    expect(r).toHaveLength(1);
    expect(r[0]).toHaveLength(1);
  });

  it('une courbe entièrement absente ne fait aucun segment', () => {
    expect(
      runs(
        GRILLE,
        GRILLE.map(() => null),
        e,
        CADRE
      )
    ).toHaveLength(0);
  });

  it('l’attribut points a la forme qu’attend le SVG', () => {
    expect(
      versAttributPoints([
        { x: 12.34, y: 56.78 },
        { x: 0, y: 1 },
      ])
    ).toBe('12.3,56.8 0.0,1.0');
    expect(versAttributPoints([])).toBe('');
  });
});

describe('les repères nommés', () => {
  const e = echelleDelta(
    GRILLE,
    GRILLE.map(() => 0),
    CADRE
  )!;

  it('place un repère à sa distance', () => {
    const { ancres } = ancreRepere([{ distanceM: 500, nom: 'V3' }], e, CADRE);
    expect(ancres).toHaveLength(1);
    expect(ancres[0].x).toBeCloseTo(150, 6);
  });

  it('écarte ce qui tombe hors de la grille', () => {
    const { ancres } = ancreRepere(
      [
        { distanceM: -50, nom: 'avant' },
        { distanceM: 1500, nom: 'après' },
        { distanceM: 400, nom: 'V2' },
      ],
      e,
      CADRE
    );
    expect(ancres.map((a) => a.nom)).toEqual(['V2']);
  });

  /**
   * Deux libellés superposés sont illisibles tous les deux. On garde le
   * premier, et on REND le compte des écartés : une troncature silencieuse se
   * lirait comme une couverture complète.
   */
  it('écarte les libellés trop serrés, et les compte', () => {
    const { ancres, ecartes } = ancreRepere(
      [
        { distanceM: 500, nom: 'V3' },
        { distanceM: 510, nom: 'V4' },
        { distanceM: 520, nom: 'V5' },
      ],
      e,
      CADRE
    );
    expect(ancres).toHaveLength(1);
    expect(ecartes).toBe(2);
  });

  it('bascule le libellé à gauche près du bord droit', () => {
    const { ancres } = ancreRepere([{ distanceM: 1000, nom: 'V9' }], e, CADRE);
    expect(ancres[0].aGauche).toBe(true);
  });

  it('sans gyroscope, aucun repère — et la courbe se dessine quand même', () => {
    const { ancres, ecartes } = ancreRepere([], e, CADRE);
    expect(ancres).toHaveLength(0);
    expect(ecartes).toBe(0);
  });
});

describe('ce que le pilote lit', () => {
  /**
   * Le signe est un FAIT et il s'écrit. Il ne se code PAS en couleur : la
   * banque de visualisations proscrit « le delta coloré » et « le signe de
   * comparaison imposé », qui font d'un constat un verdict.
   */
  it('le signe s’écrit, positif comme négatif', () => {
    expect(formateSecondes(1.234)).toBe('+1,23 s');
    expect(formateSecondes(-0.5)).toBe('−0,50 s');
    expect(formateSecondes(0)).toBe('0,00 s');
  });

  it('l’absence rend un tiret, jamais zéro', () => {
    expect(formateSecondes(null)).toBe('—');
    expect(formateSecondes(NaN)).toBe('—');
    expect(formateSecondes(Infinity)).toBe('—');
  });

  it('la virgule décimale est française', () => {
    expect(formateSecondes(2.5, 1)).toBe('+2,5 s');
    expect(formateSecondes(1.234)).not.toContain('.');
  });

  it('le moins est un vrai signe moins, pas un trait d’union', () => {
    expect(formateSecondes(-1)).toContain('−');
    expect(formateSecondes(-1)).not.toContain('-');
  });

  it('les distances passent au kilomètre au-delà de mille mètres', () => {
    expect(formateDistance(450)).toBe('450 m');
    expect(formateDistance(1000)).toBe('1,00 km');
    expect(formateDistance(3245)).toBe('3,25 km');
    expect(formateDistance(NaN)).toBe('—');
  });
});
