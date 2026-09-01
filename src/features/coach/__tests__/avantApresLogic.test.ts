/**
 * AVANT / APRÈS UNE INTERVENTION — l'effet observé.
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `un tour non mesuré ne devient jamais un zéro`. Un tour sans valeur n'entre
 * dans aucune fenêtre — il ne devient pas une valeur nulle qui écraserait la
 * médiane et fabriquerait un « effet » que personne n'a conduit.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT AUSSI
 *
 * La réserve de fond. Corrélation n'est pas causalité : TOUT résultat, même le
 * plus net, doit porter la réserve qui empêche de le lire comme une preuve.
 * Et le refus : sans tours de part et d'autre, le statut est « non testée »
 * avec des champs `null` — jamais un effet de zéro.
 */

import {
  MIN_TOURS_PAR_FENETRE,
  RATIO_EFFET_PROBABLE,
  RATIO_EFFET_VALIDE,
  TAILLE_FENETRE_TOURS,
  VERSION_AVANT_APRES,
  libelleStatut,
  litEffetAvantApres,
  type StatutEffet,
  type TourMetrique,
} from '@/features/coach/avantApresLogic';

/** Un tour valide et mesuré, daté toutes les 90 s à partir d'un t0 arbitraire. */
const T0 = Date.parse('2026-07-04T14:30:00.000Z');
function tour(n: number, valeur: number | null, valide = true): TourMetrique {
  return { tour: n, instantMs: T0 + n * 90_000, valeur, valide };
}

describe('litEffetAvantApres', () => {
  it('un déplacement net de la médiane, hors du bruit, est « validée »', () => {
    // Avant : médiane 92,0 s, écart absolu médian 0,2. Après : médiane 89,0 s,
    // même dispersion. |−3,0| / 0,2 = 15 fois la dispersion : bien au-delà du
    // seuil « validée ».
    const tours = [
      tour(1, 92.4),
      tour(2, 92.0),
      tour(3, 91.8),
      tour(4, 90.5), // le tour de l'intervention — n'entre dans aucune fenêtre
      tour(5, 89.2),
      tour(6, 89.0),
      tour(7, 88.8),
    ];
    const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours, {
      conditionsChangees: false,
    });
    expect(e.statut).toBe('validée');
    expect(e.effetMedian).toBeCloseTo(-3.0, 6);
    expect(e.dispersionAvant).toBeCloseTo(0.2, 6);
    expect(e.dispersionApres).toBeCloseTo(0.2, 6);
    expect(e.fenetres.toursAvant).toEqual([3, 2, 1]);
    expect(e.fenetres.toursApres).toEqual([5, 6, 7]);
    expect(e.version).toBe(VERSION_AVANT_APRES);
    expect(e.confiance).toBe('haute');
  });

  it('un déplacement plus petit que le bruit ne conclut rien', () => {
    // Médianes 92,0 → 91,9 : l'écart (0,1) est dix fois plus petit que la
    // dispersion (1,0). Le dire « probable » serait lire du bruit.
    const tours = [
      tour(1, 91.0),
      tour(2, 92.0),
      tour(3, 93.0),
      tour(4, 92.0),
      tour(5, 90.9),
      tour(6, 91.9),
      tour(7, 92.9),
    ];
    const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours);
    expect(e.statut).toBe('non concluante');
  });

  it('un tour non mesuré ne devient jamais un zéro', () => {
    // LE TEST QUI COMPTE. Le tour 3 n'a pas de valeur : s'il entrait comme
    // zéro, la médiane avant tomberait à 91,8 s au lieu de 92,0 et un « effet »
    // apparaîtrait de nulle part. Il doit être ÉCARTÉ : la fenêtre remonte au
    // tour 1.
    const tours = [
      tour(1, 92.4),
      tour(2, 92.0),
      tour(3, null),
      tour(4, 91.8),
      tour(5, 90.5),
      tour(6, 89.2),
      tour(7, 89.0),
      tour(8, 88.8),
    ];
    const e = litEffetAvantApres({ tour: 5, instantMs: null }, tours);
    expect(e.fenetres.toursAvant).toEqual([4, 2, 1]);
    expect(e.effetMedian).toBeCloseTo(89.0 - 92.0, 6);
  });

  it('un tour invalide est écarté de la même façon', () => {
    const tours = [
      tour(1, 92.0),
      tour(2, 92.2),
      tour(3, 120.0, false), // gâché — déclaré invalide en amont
      tour(4, 91.8),
      tour(5, 90.5),
      tour(6, 89.2),
      tour(7, 89.0),
      tour(8, 88.8),
    ];
    const e = litEffetAvantApres({ tour: 5, instantMs: null }, tours);
    expect(e.fenetres.toursAvant).toEqual([4, 2, 1]);
    expect(e.fenetres.toursAvant).not.toContain(3);
  });

  describe('on ne mesure rien sur du vide', () => {
    it('pas assez de tours après → « non testée », champs null', () => {
      const tours = [tour(1, 92.0), tour(2, 92.2), tour(3, 91.8), tour(4, 90.0), tour(5, 89.0)];
      const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours);
      expect(e.statut).toBe('non testée');
      expect(e.effetMedian).toBeNull();
      expect(e.dispersionAvant).toBeNull();
      expect(e.dispersionApres).toBeNull();
      expect(e.confiance).toBe('faible');
      expect(e.reserves.join(' ')).toContain('Pas assez de tours comparables');
    });

    it('aucun tour fourni → « non testée », pas une exception', () => {
      const e = litEffetAvantApres({ tour: 3, instantMs: null }, []);
      expect(e.statut).toBe('non testée');
      expect(e.effetMedian).toBeNull();
    });

    it('marqueur non situable → « non testée » avec le motif', () => {
      const tours = [tour(1, 92.0), tour(2, 92.2)];
      const e = litEffetAvantApres({ tour: null, instantMs: null }, tours);
      expect(e.statut).toBe('non testée');
      expect(e.reserves.join(' ')).toContain('non situable');
    });
  });

  describe('le marqueur se situe par le tour, ou à défaut par l’instant', () => {
    it('un instant entre deux bouclages désigne le tour en cours', () => {
      // L'intervention tombe entre le bouclage du tour 3 et celui du tour 4 :
      // elle appartient au tour 4, qui n'entre dans aucune fenêtre.
      const tours = [1, 2, 3, 4, 5, 6, 7].map((n) => tour(n, 92 - n * 0.1));
      const e = litEffetAvantApres({ tour: null, instantMs: T0 + 3 * 90_000 + 10_000 }, tours);
      expect(e.fenetres.toursAvant).toEqual([3, 2, 1]);
      expect(e.fenetres.toursApres).toEqual([5, 6, 7]);
    });

    it('le tour déclaré gagne sur l’instant', () => {
      const tours = [1, 2, 3, 4, 5, 6, 7].map((n) => tour(n, 92 - n * 0.1));
      // L'instant désignerait le tour 2 ; le tour déclaré dit 4.
      const e = litEffetAvantApres({ tour: 4, instantMs: T0 + 100_000 }, tours);
      expect(e.fenetres.toursAvant).toEqual([3, 2, 1]);
    });
  });

  describe('corrélation n’est pas causalité — les réserves', () => {
    const tours = [1, 2, 3, 4, 5, 6, 7].map((n) => tour(n, n <= 3 ? 92 : 89));

    it('la réserve de fond figure sur TOUT résultat, même le plus net', () => {
      const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours, {
        conditionsChangees: false,
      });
      expect(e.reserves.length).toBeGreaterThan(0);
      expect(e.reserves.join(' ')).toContain('pas une preuve');
    });

    it('des conditions changées entre les fenêtres s’annoncent', () => {
      const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours, {
        conditionsChangees: true,
      });
      expect(e.reserves.join(' ')).toContain('Conditions changées');
    });

    it('des conditions inconnues produisent une réserve, pas un silence', () => {
      const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours);
      expect(e.reserves.join(' ')).toContain('non renseignées');
      // Et la confiance descend d'un cran : on ne sait pas ce qui a bougé.
      expect(e.confiance).toBe('moyenne');
    });
  });

  it('une dispersion nulle ne « valide » pas : l’échelle du bruit est inconnue', () => {
    // Trois tours strictement identiques de chaque côté : le déplacement est
    // net mais rien ne dit ce que vaut le bruit de cette séance.
    const tours = [1, 2, 3, 4, 5, 6, 7].map((n) => tour(n, n <= 3 ? 92 : 89));
    const e = litEffetAvantApres({ tour: 4, instantMs: null }, tours);
    expect(e.statut).toBe('probable');
    expect(e.reserves.join(' ')).toContain('Dispersion nulle');
  });

  it('des fenêtres tronquées mais suffisantes abaissent la confiance', () => {
    const tours = [tour(1, 92.0), tour(2, 92.2), tour(3, 90.0), tour(4, 89.0), tour(5, 89.2)];
    const e = litEffetAvantApres({ tour: 3, instantMs: null }, tours, {
      conditionsChangees: false,
    });
    expect(e.statut).not.toBe('non testée');
    expect(e.confiance).toBe('faible');
    expect(e.reserves.join(' ')).toContain('plus courtes');
  });

  it('les seuils sont des constantes nommées, exportées pour être discutées', () => {
    // « À valider » par le fondateur : le test fige leur COHÉRENCE, pas leur
    // valeur — probable avant validée, fenêtre au moins au minimum.
    expect(RATIO_EFFET_PROBABLE).toBeLessThan(RATIO_EFFET_VALIDE);
    expect(MIN_TOURS_PAR_FENETRE).toBeGreaterThanOrEqual(2);
    expect(TAILLE_FENETRE_TOURS).toBeGreaterThanOrEqual(MIN_TOURS_PAR_FENETRE);
  });
});

describe('libelleStatut', () => {
  it('décrit sans prescrire — l’application montre, elle ne dirige pas', () => {
    const statuts: StatutEffet[] = ['non testée', 'probable', 'validée', 'non concluante'];
    for (const s of statuts) {
      const phrase = libelleStatut(s);
      expect(phrase.length).toBeGreaterThan(10);
      expect(phrase).not.toMatch(/vous devriez|il faut|freinez|accélérez|évitez/i);
    }
  });
});
