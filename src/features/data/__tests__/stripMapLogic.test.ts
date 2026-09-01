/**
 * Le strip map ment-il sur ce qu'il couvre ?
 *
 * Toute la valeur d'un développement linéaire tient à ce qu'il ne remplisse
 * pas les trous. Une bande pleine affirme une analyse complète ; si l'analyse
 * n'a couvert que les deux tiers du tour, la bande pleine est un faux. Ces
 * tests portent donc d'abord sur la couverture, les trous et les recouvrements.
 */

import {
  construireStrip,
  mesureUnion,
  normaliserBande,
  type SegmentSituable,
} from '../stripMapLogic';

function seg(
  i: number,
  debut: number | null,
  fin: number | null,
  kind: string | null = 'turn',
  nom: string | null = null
): SegmentSituable {
  return {
    segmentIndex: i,
    segmentName: nom,
    kind,
    startProgress: debut,
    endProgress: fin,
  };
}

describe('mesureUnion — jamais la somme', () => {
  it('deux intervalles disjoints s’additionnent', () => {
    expect(
      mesureUnion([
        { debut: 0, fin: 0.2 },
        { debut: 0.5, fin: 0.6 },
      ])
    ).toBeCloseTo(0.3, 6);
  });

  /** LE CAS QUI COMPTE : sommer donnerait 0,8 — l'union vaut 0,6. */
  it('deux intervalles qui se recouvrent ne comptent qu’une fois', () => {
    expect(
      mesureUnion([
        { debut: 0, fin: 0.5 },
        { debut: 0.2, fin: 0.6 },
      ])
    ).toBeCloseTo(0.6, 6);
  });

  it('un intervalle contenu dans un autre n’ajoute rien', () => {
    expect(
      mesureUnion([
        { debut: 0, fin: 0.9 },
        { debut: 0.3, fin: 0.4 },
      ])
    ).toBeCloseTo(0.9, 6);
  });

  it('l’ordre d’entrée ne change pas le résultat', () => {
    const a = mesureUnion([
      { debut: 0.5, fin: 0.6 },
      { debut: 0, fin: 0.2 },
    ]);
    const b = mesureUnion([
      { debut: 0, fin: 0.2 },
      { debut: 0.5, fin: 0.6 },
    ]);
    expect(a).toBeCloseTo(b, 6);
  });

  it('rien à mesurer vaut zéro, pas un tour entier', () => {
    expect(mesureUnion([])).toBe(0);
  });
});

describe('construireStrip', () => {
  it('pose chaque segment à sa place et à sa longueur', () => {
    const strip = construireStrip([
      seg(0, 0, 0.25, 'straight', 'Ligne droite'),
      seg(1, 0.25, 0.4, 'turn', 'Épingle'),
    ]);
    expect(strip.cases.map((c) => [c.nom, c.debut, c.fin])).toEqual([
      ['Ligne droite', 0, 0.25],
      ['Épingle', 0.25, 0.4],
    ]);
    expect(strip.couverture).toBeCloseTo(0.4, 6);
    expect(strip.nonSitues).toBe(0);
  });

  /**
   * LA COUVERTURE PARTIELLE EST LE CAS NORMAL, PAS L'EXCEPTION.
   * Elle doit ressortir, sinon la bande se lit comme un tour complet.
   */
  it('les trous restent des trous et se chiffrent', () => {
    const strip = construireStrip([seg(0, 0, 0.3), seg(1, 0.7, 0.9)]);
    expect(strip.couverture).toBeCloseTo(0.5, 6);
    expect(strip.cases).toHaveLength(2);
  });

  it('un segment sans position est compté, jamais jeté en silence', () => {
    const strip = construireStrip([seg(0, 0, 0.3), seg(1, null, 0.5), seg(2, 0.6, null)]);
    expect(strip.nonSitues).toBe(2);
    expect(strip.cases).toHaveLength(1);
  });

  it('une position hors de [0, 1] n’est pas située', () => {
    const strip = construireStrip([seg(0, -0.1, 0.3), seg(1, 0.8, 1.4)]);
    expect(strip.nonSitues).toBe(2);
    expect(strip.cases).toEqual([]);
  });

  it('un segment de longueur nulle ne rend pas un trait parasite', () => {
    const strip = construireStrip([seg(0, 0.5, 0.5)]);
    expect(strip.cases).toEqual([]);
    expect(strip.nonSitues).toBe(1);
  });

  /**
   * Le dernier segment d'un tour fermé franchit la ligne : début 0,97, fin
   * 0,03. Le rendre en une seule case l'étalerait sur 94 % du tour, à l'envers.
   */
  it('un segment qui franchit la ligne donne deux cases du même nom', () => {
    const strip = construireStrip([seg(7, 0.97, 0.03, 'turn', 'Dernier')]);
    expect(strip.cases).toHaveLength(2);
    expect(strip.cases.map((c) => c.nom)).toEqual(['Dernier', 'Dernier']);
    expect(strip.cases.map((c) => [c.debut, c.fin])).toEqual([
      [0, 0.03],
      [0.97, 1],
    ]);
    expect(strip.couverture).toBeCloseTo(0.06, 6);
  });

  it('les clés de rendu restent distinctes après découpe', () => {
    const strip = construireStrip([seg(7, 0.97, 0.03)]);
    expect(new Set(strip.cases.map((c) => c.cle)).size).toBe(2);
  });

  it('les cases sortent triées par position, quel que soit l’ordre d’entrée', () => {
    const strip = construireStrip([seg(2, 0.6, 0.8), seg(0, 0, 0.2), seg(1, 0.3, 0.5)]);
    expect(strip.cases.map((c) => c.segmentIndex)).toEqual([0, 1, 2]);
  });

  it('un genre inconnu est nommé inconnu, pas transformé en virage', () => {
    const strip = construireStrip([seg(0, 0, 0.2, 'sector'), seg(1, 0.2, 0.4, null)]);
    expect(strip.cases.map((c) => c.genre)).toEqual(['inconnu', 'inconnu']);
  });

  /**
   * `segmentIndex` est numéroté à partir de 1 — la contrainte de base l'exige.
   * Le repli valait `V${index + 1}` : le virage 4 s'affichait « V5 », et le
   * premier virage d'un circuit « V2 ».
   */
  it('un segment sans nom prend SON numéro, pas celui du suivant', () => {
    const strip = construireStrip([seg(4, 0, 0.2, 'turn', '   ')]);
    expect(strip.cases[0].nom).toBe('V4');
  });

  it('le premier virage s’appelle V1', () => {
    const strip = construireStrip([seg(1, 0, 0.2, 'turn', null)]);
    expect(strip.cases[0].nom).toBe('V1');
  });

  it('aucun segment ne rend un strip vide de couverture nulle', () => {
    const strip = construireStrip([]);
    expect(strip).toEqual({ cases: [], nonSitues: 0, couverture: 0 });
  });

  /** Deux segments qui se recouvrent : la couverture ne dépasse jamais le tour. */
  it('la couverture ne dépasse jamais cent pour cent', () => {
    const strip = construireStrip([seg(0, 0, 1), seg(1, 0.2, 0.9), seg(2, 0.1, 0.8)]);
    expect(strip.couverture).toBeLessThanOrEqual(1);
    expect(strip.couverture).toBeCloseTo(1, 6);
  });
});

describe('normaliserBande', () => {
  it('ramène les valeurs à [0, 1] sur leur propre étendue', () => {
    const b = normaliserBande([100, 150, 200])!;
    expect(b.min).toBe(100);
    expect(b.max).toBe(200);
    expect(b.positions).toEqual([0, 0.5, 1]);
  });

  it('une valeur absente reste absente — jamais ramenée à zéro', () => {
    const b = normaliserBande([100, null, 200])!;
    expect(b.positions).toEqual([0, null, 1]);
  });

  it('rien de mesurable ne rend pas une bande uniforme', () => {
    expect(normaliserBande([])).toBeNull();
    expect(normaliserBande([null, null])).toBeNull();
    expect(normaliserBande([Number.NaN, Infinity])).toBeNull();
  });

  /** Série constante : à mi-hauteur — en haut, elle suggérerait un maximum. */
  it('une série constante se pose au milieu, sans diviser par zéro', () => {
    const b = normaliserBande([120, 120, 120])!;
    expect(b.positions).toEqual([0.5, 0.5, 0.5]);
    expect(b.min).toBe(120);
    expect(b.max).toBe(120);
  });

  it('les négatifs sont des valeurs comme les autres (freinage en g)', () => {
    const b = normaliserBande([-1.2, -0.6, 0])!;
    expect(b.positions).toEqual([0, 0.5, 1]);
  });
});
