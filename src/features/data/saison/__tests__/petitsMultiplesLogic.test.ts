/**
 * Le test qui décide si ce sont des petits multiples ou juste des vignettes.
 *
 * Une grille de sparklines auto-échelonnées est INDISCERNABLE d'une grille de
 * petits multiples tant qu'on regarde un panneau à la fois. La différence
 * n'apparaît qu'en confrontant deux séances de rythmes éloignés : sous une
 * échelle commune, la séance rapide occupe le haut du cadre et rien d'autre ;
 * sous une échelle par série, elle remplit le cadre entier, exactement comme la
 * lente.
 *
 * C'est donc la propriété centrale vérifiée ici — et elle l'est par la mesure
 * des ordonnées réellement écrites dans le chemin, pas par la relecture du code.
 */

import {
  PANNEAUX_MAX,
  construirePanneaux,
  dernieresSeances,
  domaineCommun,
  panneauDeSerie,
  toursExploitables,
  type SerieSeance,
} from '../petitsMultiplesLogic';

/** Les ordonnées écrites dans un chemin `M x y L x y …`. */
function ysDuChemin(d: string): number[] {
  const nombres = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return nombres.filter((_, i) => i % 2 === 1).map(Number);
}

const RAPIDE: SerieSeance = {
  sessionId: 'rapide',
  libelle: 'Séance rapide',
  toursMs: [90_000, 90_500, 91_000],
};

const LENTE: SerieSeance = {
  sessionId: 'lente',
  libelle: 'Séance lente',
  toursMs: [125_000, 128_000, 130_000],
};

const LARGEUR = 60;
const HAUTEUR = 40;
const PAD = 2;

describe('l’échelle est commune, et c’est mesurable', () => {
  const domaine = domaineCommun([RAPIDE, LENTE]);

  it('le domaine couvre les deux séances, pas une seule', () => {
    expect(domaine).toEqual({ minMs: 90_000, maxMs: 130_000 });
  });

  /**
   * LE TEST QUI COMPTE. Étendue commune = 40 s ; la séance rapide n'en couvre
   * qu'une seconde. Elle doit donc rester dans le tout premier dixième du
   * cadre. Une sparkline auto-échelonnée l'aurait étalée de haut en bas.
   */
  it('la séance rapide ne remplit PAS le cadre — elle reste en haut', () => {
    const p = panneauDeSerie(RAPIDE, domaine!, LARGEUR, HAUTEUR, PAD);
    const ys = ysDuChemin(p.chemin);
    expect(ys).toHaveLength(3);
    const amplitude = Math.max(...ys) - Math.min(...ys);
    expect(amplitude).toBeLessThan(2);
    expect(Math.max(...ys)).toBeLessThan(HAUTEUR / 4);
  });

  it('la séance lente occupe le bas du même cadre', () => {
    const p = panneauDeSerie(LENTE, domaine!, LARGEUR, HAUTEUR, PAD);
    const ys = ysDuChemin(p.chemin);
    expect(Math.max(...ys)).toBeCloseTo(HAUTEUR - PAD, 1);
    expect(Math.min(...ys)).toBeGreaterThan(HAUTEUR / 2);
  });

  /** Un même temps au tour tombe à la même hauteur, quelle que soit la séance. */
  it('un temps identique se pose à la même ordonnée dans deux panneaux', () => {
    const a: SerieSeance = { sessionId: 'a', libelle: 'A', toursMs: [100_000, 90_000] };
    const b: SerieSeance = { sessionId: 'b', libelle: 'B', toursMs: [100_000, 130_000] };
    const d = domaineCommun([a, b])!;
    const ya = ysDuChemin(panneauDeSerie(a, d, LARGEUR, HAUTEUR, PAD).chemin)[0];
    const yb = ysDuChemin(panneauDeSerie(b, d, LARGEUR, HAUTEUR, PAD).chemin)[0];
    expect(ya).toBeCloseTo(yb, 5);
  });
});

describe('ce qui ne se trace pas le dit', () => {
  const domaine = { minMs: 90_000, maxMs: 130_000 };

  it('une séance d’un seul tour ne rend pas une ligne plate', () => {
    const p = panneauDeSerie(
      { sessionId: 'u', libelle: 'Un tour', toursMs: [95_000] },
      domaine,
      LARGEUR,
      HAUTEUR
    );
    expect(p.chemin).toBe('');
    expect(p.tours).toBe(1);
    expect(p.meilleurMs).toBe(95_000);
  });

  it('une séance sans tour exploitable n’a pas de meilleur tour', () => {
    const p = panneauDeSerie(
      { sessionId: 'v', libelle: 'Vide', toursMs: [] },
      domaine,
      LARGEUR,
      HAUTEUR
    );
    expect(p.chemin).toBe('');
    expect(p.tours).toBe(0);
    expect(p.meilleurMs).toBeNull();
  });

  it('un cadre de largeur nulle ne fabrique pas de chemin', () => {
    const p = panneauDeSerie(RAPIDE, domaine, 0, HAUTEUR);
    expect(p.chemin).toBe('');
  });

  it('aucune séance exploitable → aucun domaine, donc aucune grille', () => {
    expect(domaineCommun([])).toBeNull();
    expect(domaineCommun([{ sessionId: 'x', libelle: 'X', toursMs: [0, -4] }])).toBeNull();
  });

  /**
   * Domaine plat : tous les tours de la saison valent la même chose. La ligne
   * se pose à mi-hauteur — la coller en haut suggérerait une performance que
   * la donnée ne porte pas.
   */
  it('un domaine plat pose la ligne au milieu, sans diviser par zéro', () => {
    const plat = { minMs: 100_000, maxMs: 100_000 };
    const p = panneauDeSerie(
      { sessionId: 'p', libelle: 'Plat', toursMs: [100_000, 100_000] },
      plat,
      LARGEUR,
      HAUTEUR
    );
    for (const y of ysDuChemin(p.chemin)) expect(y).toBeCloseTo(HAUTEUR / 2, 5);
  });
});

describe('toursExploitables', () => {
  /** PostgREST rend les `numeric` en chaînes — le cas est réel, pas théorique. */
  it('accepte les chaînes numériques que rend PostgREST', () => {
    expect(toursExploitables(['90000', '91000.5'])).toEqual([90_000, 91_000.5]);
  });

  it('écarte zéro, le négatif et le non-fini — un 0 est une absence', () => {
    expect(toursExploitables([0, -1, Number.NaN, Infinity, null, undefined, 'x', 5])).toEqual([5]);
  });
});

describe('dernieresSeances — la coupe se déclare', () => {
  const beaucoup: SerieSeance[] = Array.from({ length: 27 }, (_, i) => ({
    sessionId: `s${i}`,
    libelle: `S${i}`,
    toursMs: [95_000],
  }));

  it('garde les DERNIÈRES, pas les premières', () => {
    const { retenues } = dernieresSeances(beaucoup);
    expect(retenues).toHaveLength(PANNEAUX_MAX);
    expect(retenues[retenues.length - 1].sessionId).toBe('s26');
    expect(retenues[0].sessionId).toBe(`s${27 - PANNEAUX_MAX}`);
  });

  /**
   * Le total est rendu MÊME quand il dépasse : c'est ce qui permet à l'écran
   * d'écrire « 12 dernières sur 27 ». Une grille tronquée en silence se lit
   * comme une saison entière.
   */
  it('rend le total d’avant la coupe', () => {
    expect(dernieresSeances(beaucoup).total).toBe(27);
  });

  it('ne coupe rien quand il y a moins que le maximum', () => {
    const trois = beaucoup.slice(0, 3);
    const { retenues, total } = dernieresSeances(trois);
    expect(retenues).toHaveLength(3);
    expect(total).toBe(3);
  });

  it('un maximum absurde ne rend aucun panneau plutôt qu’une grille au hasard', () => {
    expect(dernieresSeances(beaucoup, 0).retenues).toEqual([]);
    expect(dernieresSeances(beaucoup, -5).retenues).toEqual([]);
    expect(dernieresSeances(beaucoup, Number.NaN).retenues).toEqual([]);
  });
});

describe('construirePanneaux', () => {
  it('rend un panneau par séance, dans l’ordre reçu', () => {
    const d = domaineCommun([RAPIDE, LENTE])!;
    const ps = construirePanneaux([LENTE, RAPIDE], d, LARGEUR, HAUTEUR);
    expect(ps.map((p) => p.sessionId)).toEqual(['lente', 'rapide']);
  });

  /** Le meilleur tour affiché est celui DE LA SÉANCE, pas celui de la saison. */
  it('chaque panneau porte son propre meilleur tour', () => {
    const d = domaineCommun([RAPIDE, LENTE])!;
    const ps = construirePanneaux([RAPIDE, LENTE], d, LARGEUR, HAUTEUR);
    expect(ps[0].meilleurMs).toBe(90_000);
    expect(ps[1].meilleurMs).toBe(125_000);
  });
});
