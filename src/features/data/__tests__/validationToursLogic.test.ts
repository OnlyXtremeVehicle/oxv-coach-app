/**
 * Validation des tours — module M05 (« Tableau des tours »).
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 *   - LE CŒUR DOCTRINAL : la machine ne prononce jamais « trafic » ni
 *     « drapeau ». Elle marque `suspect` et rend le FAIT chiffré. Un verrou
 *     relit toutes les sorties produites, pas seulement la source ;
 *   - la robustesse : un tour gâché ne déplace pas le seuil (médiane + MAD),
 *     et l'écart se voit DANS LES DEUX SENS — un tour anormalement rapide sur
 *     mesure trouée est suspect lui aussi ;
 *   - la prudence : sous MIN_TOURS_BASE_ECART tours de base, aucun écart n'est
 *     prononcé — on ne devine pas ce qui est normal sur trois tours ;
 *   - l'audit : aucune marque sans son fait, aucun tour écarté sans marque ;
 *   - l'honnêteté : aucun tour propre → référence `null`, jamais le moins
 *     mauvais promu d'office ; et la réserve dit factuellement pourquoi le
 *     meilleur temps brut n'a pas été retenu.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  evaluerTours,
  FACTEUR_MAD_ECART,
  MIN_TOURS_BASE_ECART,
  NORMALISATION_MAD,
  PLANCHER_ECART_MS,
  SEUIL_ARRET_KMH,
  SEUIL_TROUS_TOLERES_MS,
  VERSION_VALIDATION_TOURS,
  type MarqueTour,
  type TourMesure,
  type ValidationTours,
  FRACTION_BARRE_MAX,
  FRACTION_BARRE_MIN,
  hauteurBarreTour,
} from '../validationToursLogic';

/** Un tour ordinaire : chronométré, valide, sans arrêt ni trou. */
function t(index: number, tempsMs: number | null, extra?: Partial<TourMesure>): TourMesure {
  return {
    index,
    tempsMs,
    valide: true,
    vitesseMiniKmh: 60,
    trousMesureMs: 0,
    ...extra,
  };
}

/** Une suite de tours ordinaires à partir d'une liste de temps (index 1..n). */
function serie(tempsMs: readonly number[]): TourMesure[] {
  return tempsMs.map((v, i) => t(i + 1, v));
}

function tour(r: ValidationTours, index: number) {
  const e = r.tours.find((x) => x.index === index);
  if (e === undefined) throw new Error(`tour ${index} absent du résultat`);
  return e;
}

function codes(marques: readonly MarqueTour[]): string[] {
  return marques.map((m) => m.code);
}

/** Huit tours réguliers autour de 93 s : une base solide. */
const REGULIERS = [93000, 93200, 92900, 93100, 93050, 92950, 93150, 93000];

// ===========================================================================

describe('LE CŒUR — la machine doute, elle ne déclare pas', () => {
  it('un tour nettement plus lent est « suspect », jamais « trafic »', () => {
    const r = evaluerTours(serie([...REGULIERS, 101400]));
    const lent = tour(r, 9);
    expect(lent.classement).toBe('suspect');
    expect(codes(lent.marques)).toContain('ecart_net');
    const fait = lent.marques.find((m) => m.code === 'ecart_net')?.fait ?? '';
    // Médiane des neuf candidats : 93 050 ms ; 101 400 − 93 050 = 8 350 ms.
    expect(fait).toBe('8,3 s au-dessus de la médiane des tours propres');
  });

  it('aucune sortie ne prononce une cause — ni trafic, ni drapeau, ni faute', () => {
    const r = evaluerTours([
      t(1, 96000, { tags: ['outlap'] }),
      ...serie(REGULIERS).map((x) => ({ ...x, index: x.index + 1 })),
      t(10, 104000, { vitesseMiniKmh: 2 }),
      t(11, 88000, { trousMesureMs: 4200 }),
      t(12, null, { tempsMs: null }),
      t(13, 97000, { tags: ['inlap'] }),
    ]);

    const textes = r.tours
      .flatMap((e) => e.marques.map((m) => `${m.code} ${m.fait}`))
      .concat(r.reference?.reserve ?? '')
      .join(' | ')
      .toLowerCase();

    for (const cause of [
      'trafic',
      'drapeau',
      'faute',
      'erreur de pilotage',
      'gêne',
      'gene',
      'bloqué',
      'attardé',
      'fatigue',
      'concentration',
    ]) {
      expect(textes).not.toContain(cause);
    }
  });

  it('chaque marque porte un fait — jamais un code seul', () => {
    const r = evaluerTours([
      ...serie(REGULIERS),
      t(9, 104000, { vitesseMiniKmh: 1.5, trousMesureMs: 2100 }),
      t(10, 95000, { tags: ['inlap'] }),
      t(11, null, { tempsMs: null }),
    ]);
    for (const e of r.tours) {
      for (const m of e.marques) {
        expect(typeof m.fait).toBe('string');
        expect(m.fait.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('aucun tour n’est écarté sans marque : hors_chrono et suspect en portent toujours au moins une', () => {
    const r = evaluerTours([
      t(1, 96000, { tags: ['outlap'] }),
      ...serie(REGULIERS).map((x) => ({ ...x, index: x.index + 1 })),
      t(10, 104000),
      t(11, 94000, { valide: false }),
    ]);
    for (const e of r.tours) {
      if (e.classement === 'propre') {
        expect(e.marques).toEqual([]);
      } else {
        expect(e.marques.length).toBeGreaterThan(0);
      }
    }
  });
});

// ===========================================================================

describe('hors chronométrage', () => {
  it('un tour sans temps est hors_chrono, avec le motif « aucun temps au tour relevé »', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, null)]);
    const e = tour(r, 9);
    expect(e.classement).toBe('hors_chrono');
    expect(e.marques).toEqual([{ code: 'non_chronometre', fait: 'aucun temps au tour relevé' }]);
  });

  it('un temps nul ou négatif n’est pas un temps', () => {
    expect(tour(evaluerTours([...serie(REGULIERS), t(9, 0)]), 9).classement).toBe('hors_chrono');
    expect(tour(evaluerTours([...serie(REGULIERS), t(9, -12)]), 9).classement).toBe('hors_chrono');
  });

  it('un tour signalé non valide par la détection amont est hors_chrono, et le fait le dit', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 93000, { valide: false })]);
    const e = tour(r, 9);
    expect(e.classement).toBe('hors_chrono');
    expect(e.marques).toEqual([
      { code: 'non_chronometre', fait: 'tour signalé non exploitable par la détection amont' },
    ]);
  });

  it('sortie et rentrée des stands sont hors_chrono, chacune avec son code', () => {
    const r = evaluerTours([
      t(1, 96000, { tags: ['outlap'] }),
      ...serie(REGULIERS).map((x) => ({ ...x, index: x.index + 1 })),
      t(10, 97000, { tags: ['inlap'] }),
    ]);
    expect(tour(r, 1).classement).toBe('hors_chrono');
    expect(codes(tour(r, 1).marques)).toEqual(['sortie_stands']);
    expect(tour(r, 10).classement).toBe('hors_chrono');
    expect(codes(tour(r, 10).marques)).toEqual(['rentree_stands']);
  });

  it('un tour hors_chrono porte quand même les faits observés sur lui', () => {
    const r = evaluerTours([
      ...serie(REGULIERS),
      t(9, 120000, { tags: ['inlap'], vitesseMiniKmh: 0, trousMesureMs: 3000 }),
    ]);
    const e = tour(r, 9);
    expect(e.classement).toBe('hors_chrono');
    expect(codes(e.marques)).toEqual(['rentree_stands', 'arret_en_piste', 'mesure_trouee']);
  });

  it('un tour hors_chrono n’entre pas dans la base : il ne déplace pas la médiane', () => {
    const sans = evaluerTours(serie(REGULIERS));
    const avec = evaluerTours([
      ...serie(REGULIERS),
      t(9, 180000, { tags: ['inlap'] }),
      t(10, 175000, { tags: ['outlap'] }),
    ]);
    expect(sans.toursPropres).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(avec.toursPropres).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

// ===========================================================================

describe('arrêt et mesure trouée', () => {
  it('une vitesse minimale sous le seuil vaut arrêt observé, chiffré', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 93000, { vitesseMiniKmh: 2.4 })]);
    const e = tour(r, 9);
    expect(e.classement).toBe('suspect');
    expect(e.marques[0].code).toBe('arret_en_piste');
    expect(e.marques[0].fait).toBe(
      `arrêt observé (vitesse descendue à 2,4 km/h, sous ${SEUIL_ARRET_KMH} km/h)`
    );
  });

  it('une vitesse minimale non relevée ne fabrique pas d’arrêt : null n’est pas zéro', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 93000, { vitesseMiniKmh: null })]);
    expect(tour(r, 9).classement).toBe('propre');
  });

  it('des trous cumulés au-delà du toléré valent « mesure manquante », en secondes', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 93000, { trousMesureMs: 2100 })]);
    const e = tour(r, 9);
    expect(e.classement).toBe('suspect');
    expect(e.marques).toEqual([{ code: 'mesure_trouee', fait: '2,1 s de mesure manquante' }]);
  });

  it('des trous sous le toléré ne marquent rien, et des trous non mesurés non plus', () => {
    const juste = evaluerTours([
      ...serie(REGULIERS),
      t(9, 93000, { trousMesureMs: SEUIL_TROUS_TOLERES_MS }),
    ]);
    expect(tour(juste, 9).classement).toBe('propre');
    const inconnu = evaluerTours([...serie(REGULIERS), t(9, 93000, { trousMesureMs: null })]);
    expect(tour(inconnu, 9).classement).toBe('propre');
  });
});

// ===========================================================================

describe('écart net — robuste, et dans les deux sens', () => {
  it('un tour anormalement RAPIDE est suspect autant qu’un tour lent', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 84500, { trousMesureMs: 3000 })]);
    const e = tour(r, 9);
    expect(e.classement).toBe('suspect');
    expect(codes(e.marques)).toEqual(['mesure_trouee', 'ecart_net']);
    expect(e.marques[1].fait).toContain('en dessous de la médiane des tours propres');
  });

  it('deux tours gâchés ne déplacent pas le seuil des autres (médiane + MAD)', () => {
    const propre = evaluerTours(serie(REGULIERS));
    const polue = evaluerTours([...serie(REGULIERS), t(9, 130000), t(10, 128000)]);
    // Les huit réguliers restent propres malgré deux aberrations massives.
    expect(propre.toursPropres).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(polue.toursPropres).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(tour(polue, 9).classement).toBe('suspect');
    expect(tour(polue, 10).classement).toBe('suspect');
  });

  it('le plancher protège le pilote très régulier : 0,9 s d’écart ne suffit pas', () => {
    // MAD nul (tours identiques) → seuil = PLANCHER_ECART_MS.
    const identiques = [93000, 93000, 93000, 93000, 93000, 93000];
    const sous = evaluerTours([...serie(identiques), t(7, 93000 + PLANCHER_ECART_MS - 600)]);
    expect(tour(sous, 7).classement).toBe('propre');
    const au = evaluerTours([...serie(identiques), t(7, 93000 + PLANCHER_ECART_MS + 600)]);
    expect(tour(au, 7).classement).toBe('suspect');
  });

  it('sous MIN_TOURS_BASE_ECART tours de base, aucun écart n’est prononcé', () => {
    // Trois candidats en tout (MIN_TOURS_BASE_ECART = 4), dont une aberration
    // massive : rien n'est prononcé, faute de savoir ce qui est normal ici.
    expect(MIN_TOURS_BASE_ECART).toBe(4);
    const r = evaluerTours([t(1, 93000), t(2, 93000), t(3, 140000)]);
    for (const e of r.tours) {
      expect(codes(e.marques)).not.toContain('ecart_net');
    }
    expect(r.toursPropres).toEqual([1, 2, 3]);
  });

  it('le seuil suit la dispersion réelle quand elle dépasse le plancher', () => {
    // Base très dispersée : MAD élevé, donc un écart de 2 s ne dit plus rien.
    const disperses = [90000, 94000, 91000, 95000, 92000, 96000, 93000, 97000];
    const med = 93500;
    const mad = 2000; // écarts : 3500,500,2500,1500,1500,2500,500,3500 → médiane 2000
    const seuil = Math.max(PLANCHER_ECART_MS, FACTEUR_MAD_ECART * NORMALISATION_MAD * mad);
    expect(seuil).toBeGreaterThan(PLANCHER_ECART_MS);
    const sous = evaluerTours([...serie(disperses), t(9, med + seuil - 500)]);
    expect(tour(sous, 9).classement).toBe('propre');
    const au = evaluerTours([...serie(disperses), t(9, med + seuil + 500)]);
    expect(tour(au, 9).classement).toBe('suspect');
  });
});

// ===========================================================================

describe('référence proposée et réserve', () => {
  it('la référence est le meilleur tour PROPRE, sans réserve quand c’est aussi le meilleur brut', () => {
    const r = evaluerTours(serie(REGULIERS));
    expect(r.reference).toEqual({ index: 3, tempsMs: 92900, reserve: null });
  });

  it('quand le meilleur temps brut n’est pas propre, la réserve le dit factuellement', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 84500, { trousMesureMs: 2100 })]);
    expect(r.reference?.index).toBe(3);
    expect(r.reference?.tempsMs).toBe(92900);
    expect(r.reference?.reserve).toBe(
      // Le tour 9 est écarté de la base (mesure trouée) : la médiane reste
      // celle des huit réguliers, 93 025 ms. 93 025 − 84 500 = 8 525 ms.
      'Le meilleur temps brut (tour 9) porte : 2,1 s de mesure manquante ; ' +
        '8,5 s en dessous de la médiane des tours propres.'
    );
  });

  it('un tour de stands plus rapide que tout le reste déclenche aussi la réserve', () => {
    const r = evaluerTours([...serie(REGULIERS), t(9, 80000, { tags: ['outlap'] })]);
    expect(r.reference?.index).toBe(3);
    expect(r.reference?.reserve).toContain('Le meilleur temps brut (tour 9) porte');
    expect(r.reference?.reserve).toContain('tour de sortie des stands');
  });

  it('aucun tour propre → référence null, jamais le moins mauvais promu d’office', () => {
    const r = evaluerTours([
      t(1, 96000, { tags: ['outlap'] }),
      t(2, 93000, { vitesseMiniKmh: 0 }),
      t(3, null),
      t(4, 97000, { tags: ['inlap'] }),
    ]);
    expect(r.toursPropres).toEqual([]);
    expect(r.reference).toBeNull();
  });

  it('une séance vide ne rend ni tours, ni référence — et surtout aucun zéro', () => {
    const r = evaluerTours([]);
    expect(r.tours).toEqual([]);
    expect(r.toursPropres).toEqual([]);
    expect(r.reference).toBeNull();
  });
});

// ===========================================================================

describe('forme du résultat', () => {
  it('l’ordre d’entrée des tours est conservé, et toursPropres est croissant', () => {
    const r = evaluerTours([t(5, 93000), t(2, 92900), t(9, 93100), t(1, 93050)]);
    expect(r.tours.map((e) => e.index)).toEqual([5, 2, 9, 1]);
    expect(r.toursPropres).toEqual([1, 2, 5, 9]);
  });

  it('chaque résultat porte la version du calcul', () => {
    expect(evaluerTours(serie(REGULIERS)).version).toBe(VERSION_VALIDATION_TOURS);
    expect(evaluerTours([]).version).toBe(VERSION_VALIDATION_TOURS);
  });
});

// ===========================================================================

describe('DOCTRINE — verrou lexical de la source', () => {
  it('le module ne prescrit rien et n’attribue aucune cause', () => {
    const source = readFileSync(
      join(__dirname, '..', 'validationToursLogic.ts'),
      'utf8'
    ).toLowerCase();
    const bannis = [
      'freinez',
      'accélérez',
      'il faut',
      'vous devriez',
      'évitez',
      'limite',
      'sous-virage',
      'survirage',
      'fatigue',
      'concentration',
    ];
    for (const mot of bannis) {
      expect(source).not.toContain(mot);
    }
  });

  it('les seuls libellés produits sortent d’un vocabulaire clos et factuel', () => {
    const r = evaluerTours([
      t(1, 96000, { tags: ['outlap'] }),
      ...serie(REGULIERS).map((x) => ({ ...x, index: x.index + 1 })),
      t(10, 104000, { vitesseMiniKmh: 2, trousMesureMs: 2100 }),
      t(11, null),
      t(12, 95000, { tags: ['inlap'] }),
      t(13, 93000, { valide: false }),
    ]);
    const attendus: Record<string, RegExp> = {
      sortie_stands: /^tour de sortie des stands$/,
      rentree_stands: /^tour de rentrée aux stands$/,
      arret_en_piste: /^arrêt observé \(vitesse descendue à [\d,]+ km\/h, sous \d+ km\/h\)$/,
      ecart_net: /^[\d,]+ s (au-dessus|en dessous) de la médiane des tours propres$/,
      mesure_trouee: /^[\d,]+ s de mesure manquante$/,
      non_chronometre:
        /^(aucun temps au tour relevé|tour signalé non exploitable par la détection amont)$/,
    };
    const vus = new Set<string>();
    for (const e of r.tours) {
      for (const m of e.marques) {
        vus.add(m.code);
        expect(m.fait).toMatch(attendus[m.code]);
      }
    }
    // Les six codes du contrat sont bien tous atteignables.
    expect([...vus].sort()).toEqual(
      [
        'arret_en_piste',
        'ecart_net',
        'mesure_trouee',
        'non_chronometre',
        'rentree_stands',
        'sortie_stands',
      ].sort()
    );
  });
});

// ===========================================================================
// LA HAUTEUR DES BARRES — la légende et le calcul ne peuvent plus diverger
// ===========================================================================

/**
 * Relevé le 30/08/2026 : l'écran affichait « Barre courte = tour rapide »
 * pendant que le calcul donnait au tour le plus rapide la barre la plus HAUTE.
 * Arbitrage du fondateur : c'est l'échelle qui s'inverse — la barre représente
 * une durée, un temps court fait une barre courte.
 */
describe('hauteurBarreTour', () => {
  const H = 100;

  it('le tour le plus rapide porte la barre la plus COURTE', () => {
    expect(hauteurBarreTour(0, H)).toBeCloseTo(H * FRACTION_BARRE_MIN, 6);
  });

  it('le tour le plus lent porte la barre la plus HAUTE', () => {
    expect(hauteurBarreTour(1, H)).toBeCloseTo(H * FRACTION_BARRE_MAX, 6);
  });

  it('la hauteur croît avec le temps au tour, sans exception', () => {
    const hauteurs = [0, 0.25, 0.5, 0.75, 1].map((t) => hauteurBarreTour(t, H));
    for (let i = 1; i < hauteurs.length; i++) {
      expect(hauteurs[i]).toBeGreaterThan(hauteurs[i - 1]);
    }
  });

  /** Une valeur aberrante ne dessine pas une barre aberrante. */
  it('un écart hors bornes ou illisible est ramené dans le cadre', () => {
    expect(hauteurBarreTour(-3, H)).toBeCloseTo(H * FRACTION_BARRE_MIN, 6);
    expect(hauteurBarreTour(9, H)).toBeCloseTo(H * FRACTION_BARRE_MAX, 6);
    expect(hauteurBarreTour(Number.NaN, H)).toBeCloseTo(H * FRACTION_BARRE_MIN, 6);
  });

  it('une hauteur disponible nulle ou absurde ne dessine rien', () => {
    expect(hauteurBarreTour(0.5, 0)).toBe(0);
    expect(hauteurBarreTour(0.5, -10)).toBe(0);
    expect(hauteurBarreTour(0.5, Number.NaN)).toBe(0);
  });

  /** Toute barre reste dans le cadre : rien ne déborde du canevas. */
  it('aucune barre ne dépasse la hauteur disponible', () => {
    for (const t of [0, 0.3, 0.7, 1, 5]) {
      const h = hauteurBarreTour(t, H);
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(H);
    }
  });
});

/**
 * LA BASE D'ÉCART — pourquoi le module se tait, quand il se tait.
 *
 * Un écart net se mesure contre la médiane des tours PROPRES. En dessous de
 * quatre, cette médiane ne veut rien dire et la boucle qui pose `ecart_net`
 * n'est jamais atteinte. Le refus est juste ; le silence ne l'était pas — sur
 * la séance de référence, un tour à +32,9 s de ses voisins ne portait aucune
 * marque, et rien à l'écran ne disait pourquoi.
 */
describe('baseEcart — le module dit pourquoi il se tait', () => {
  function tour(index: number, ms: number) {
    return {
      index,
      tempsMs: ms,
      valide: true,
      tags: [] as string[],
      vitesseMiniKmh: 60,
      trousMesureMs: 0,
    };
  }

  it('trois tours propres : la base est insuffisante, et le dit', () => {
    const v = evaluerTours([tour(1, 100_000), tour(2, 101_000), tour(3, 133_900)]);
    expect(v.baseEcart.suffisante).toBe(false);
    expect(v.baseEcart.tours).toBe(3);
    expect(v.baseEcart.requis).toBe(4);
  });

  /** Et personne ne porte d'écart net — c'est le comportement, pas un défaut. */
  it('sous la base, aucun écart n’est prononcé', () => {
    const v = evaluerTours([tour(1, 100_000), tour(2, 101_000), tour(3, 133_900)]);
    const ecarts = v.tours.flatMap((t) => t.marques.filter((m) => m.code === 'ecart_net'));
    expect(ecarts).toEqual([]);
  });

  it('quatre tours propres : la base suffit, et l’écart se prononce', () => {
    const v = evaluerTours([
      tour(1, 100_000),
      tour(2, 100_500),
      tour(3, 101_000),
      tour(4, 100_200),
      tour(5, 133_900),
    ]);
    expect(v.baseEcart.suffisante).toBe(true);
    const ecarts = v.tours.flatMap((t) => t.marques.filter((m) => m.code === 'ecart_net'));
    expect(ecarts.length).toBeGreaterThan(0);
  });

  it('aucun tour : la base est vide, pas indéfinie', () => {
    const v = evaluerTours([]);
    expect(v.baseEcart.tours).toBe(0);
    expect(v.baseEcart.suffisante).toBe(false);
  });
});
