/**
 * Tendance de séance — module M06.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 *   - la robustesse : un tour gâché au milieu de séance ne fabrique pas une
 *     tendance (Theil–Sen, pas de moyenne naïve) ;
 *   - la chauffe : les premiers tours lents s'écartent avec motif, un tour
 *     lent AU MILIEU reste retenu ;
 *   - l'honnêteté : trop peu de tours → indéterminée, amplitude `null`, jamais
 *     un zéro fabriqué ;
 *   - la doctrine : une hausse tardive est un FAIT observé, jamais une cause —
 *     le verrou lexical relit la source.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  calculeTendanceSession,
  FACTEUR_CHAUFFE,
  MIN_TOURS_TENDANCE,
  PROGRESSION_ALGO_VERSION,
  type TourSession,
} from '../progressionLogic';

/** Un tour chronométré ordinaire. */
function t(index: number, tempsMs: number | null, extra?: Partial<TourSession>): TourSession {
  return { index, tempsMs, valide: true, ...extra };
}

/** Une suite de tours valides à partir d'une liste de temps (index 1..n). */
function serie(tempsMs: readonly number[]): TourSession[] {
  return tempsMs.map((v, i) => t(i + 1, v));
}

describe('les quatre directions', () => {
  it('des temps en baisse franche → progresse, amplitude négative', () => {
    const r = calculeTendanceSession(
      serie([95000, 94500, 94000, 93500, 93000, 92500, 92000, 91500])
    );
    expect(r.direction).toBe('progresse');
    expect(r.amplitudeMs).not.toBeNull();
    expect(r.amplitudeMs!).toBeLessThan(0);
    expect(r.penteMsParTour!).toBeCloseTo(-500, 0);
    expect(r.toursRetenus).toBe(8);
    expect(r.confiance).toBe('haute');
  });

  it('des temps stables → plafonne', () => {
    const r = calculeTendanceSession(
      serie([93000, 93100, 92950, 93050, 93000, 92900, 93080, 93020])
    );
    expect(r.direction).toBe('plafonne');
    expect(r.libelle).toBe('Temps stables observés sur les tours retenus.');
  });

  it('des temps en hausse sur toute la séance → se degrade, sans mention tardive', () => {
    const r = calculeTendanceSession(
      serie([91500, 92000, 92500, 93000, 93500, 94000, 94500, 95000])
    );
    expect(r.direction).toBe('se degrade');
    expect(r.tardive).toBe(false);
    expect(r.libelle).toBe('Temps en hausse observés sur les tours retenus.');
  });

  it(`moins de ${MIN_TOURS_TENDANCE} tours retenus → indéterminée, et rien n'est fabriqué`, () => {
    const r = calculeTendanceSession(serie([93000, 92500, 92800]));
    expect(r.direction).toBe('indeterminee');
    expect(r.amplitudeMs).toBeNull();
    expect(r.penteMsParTour).toBeNull();
    expect(r.confiance).toBe('faible');
  });

  it('aucun tour du tout → indéterminée', () => {
    const r = calculeTendanceSession([]);
    expect(r.direction).toBe('indeterminee');
    expect(r.toursRetenus).toBe(0);
  });
});

describe('la hausse tardive est un fait, pas une cause', () => {
  it('première moitié stable puis temps en hausse → « Tendance tardive observée. »', () => {
    const r = calculeTendanceSession(
      serie([92000, 92000, 92000, 92000, 92000, 93500, 95000, 96500])
    );
    expect(r.direction).toBe('se degrade');
    expect(r.tardive).toBe(true);
    expect(r.libelle).toBe('Tendance tardive observée.');
  });
});

describe('robustesse — pas de moyenne naïve', () => {
  it('un tour gâché au milieu ne fabrique pas une tendance', () => {
    // 105 s au milieu d'une séance plate à 92 s : une moyenne le lirait comme
    // une bosse de la séance entière ; la médiane des pentes l'ignore.
    const r = calculeTendanceSession(serie([92000, 92000, 105000, 92000, 92000, 92000]));
    expect(r.direction).toBe('plafonne');
    // Le tour gâché est RETENU (ce n'est pas de la chauffe) : il ne pèse pas.
    expect(r.toursRetenus).toBe(6);
    expect(r.toursEcartes).toHaveLength(0);
  });
});

describe('chauffe — en tête de séance seulement', () => {
  it('les premiers tours nettement lents s’écartent avec le motif « chauffe »', () => {
    const r = calculeTendanceSession(
      serie([105000, 104000, 93000, 93000, 93000, 93000, 93000, 93000])
    );
    expect(r.toursRetenus).toBe(6);
    expect(r.toursEcartes).toEqual([
      { index: 1, motif: 'chauffe' },
      { index: 2, motif: 'chauffe' },
    ]);
    expect(r.direction).toBe('plafonne');
  });

  it('le seuil de chauffe est bien médiane × facteur', () => {
    const base = 93000;
    const justeAuDessus = Math.ceil(base * FACTEUR_CHAUFFE) + 1;
    const r = calculeTendanceSession(serie([justeAuDessus, base, base, base, base, base]));
    expect(r.toursEcartes).toEqual([{ index: 1, motif: 'chauffe' }]);
  });
});

describe('ce qui n’entre pas, et pourquoi c’est dit', () => {
  it('chaque tour écarté porte son motif', () => {
    const r = calculeTendanceSession([
      t(1, 12000, { tags: ['outlap'] }),
      t(2, 93000),
      t(3, null),
      t(4, 93100, { valide: false }),
      t(5, 93050),
      t(6, 92900),
      t(7, 93000),
      t(8, 30000, { tags: ['inlap'] }),
    ]);
    expect(r.toursEcartes).toEqual(
      expect.arrayContaining([
        { index: 1, motif: 'tour de stand' },
        { index: 3, motif: 'non chronometre' },
        { index: 4, motif: 'invalide' },
        { index: 8, motif: 'tour de stand' },
      ])
    );
    expect(r.toursRetenus).toBe(4);
  });

  it.each([null, 0, -3, NaN])('un temps « %s » écarte le tour', (v) => {
    const r = calculeTendanceSession([t(1, v as number | null), t(2, 93000)]);
    expect(r.toursEcartes).toEqual([{ index: 1, motif: 'non chronometre' }]);
  });
});

describe('confiance et estampille', () => {
  it('la confiance ne dit que l’effectif : 8+ haute, 5–7 moyenne, sinon faible', () => {
    const temps = (n: number) => Array.from({ length: n }, () => 93000);
    expect(calculeTendanceSession(serie(temps(8))).confiance).toBe('haute');
    expect(calculeTendanceSession(serie(temps(6))).confiance).toBe('moyenne');
    expect(calculeTendanceSession(serie(temps(4))).confiance).toBe('faible');
  });

  it('chaque résultat porte la version du calcul', () => {
    expect(calculeTendanceSession(serie([93000, 93000, 93000, 93000])).version).toBe(
      PROGRESSION_ALGO_VERSION
    );
  });
});

describe('DOCTRINE — verrou lexical de la source', () => {
  it('le module progressionLogic.ts ne prescrit rien et n’attribue aucune cause', () => {
    const source = readFileSync(join(__dirname, '..', 'progressionLogic.ts'), 'utf8').toLowerCase();
    const banned = [
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
      'endurance',
    ];
    for (const mot of banned) {
      expect(source).not.toContain(mot);
    }
  });
});
