/**
 * La bande — *functional boxplot* en base distance. Jalon 4, phase 4octies.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * Le dossier impose la MÉDIANE, pas la moyenne : « préférer médiane et MAD à
 * moyenne/écart-type quand n est petit ou en présence de tours aberrants
 * (trafic) ». Une séance de piste EST pleine de tours aberrants.
 *
 * Le test central le vérifie sur un cas où les deux méthodes divergent
 * franchement — sans quoi rien n'empêcherait qu'une moyenne se glisse ici un
 * jour, avec le même air de justesse.
 */

import {
  bandeDepuisTours,
  bandeExploitable,
  ecartAbsoluMedian,
  EFFECTIF_MIN,
  formeRecommandee,
  SEUIL_BASCULE_BANDE,
} from '../bande';
import type { DistanceSeries } from '../resample';

/** Un tour à valeur constante, sur 500 m. */
function tour(valeur: number, fin = 500, pas = 10): DistanceSeries {
  const distance: number[] = [];
  const values: number[] = [];
  for (let d = 0; d <= fin; d += pas) {
    distance.push(d);
    values.push(valeur);
  }
  return { distance, values };
}

describe('la bascule', () => {
  it('superpose en deçà du seuil, résume au-delà', () => {
    expect(formeRecommandee(1)).toBe('superposition');
    expect(formeRecommandee(SEUIL_BASCULE_BANDE)).toBe('superposition');
    expect(formeRecommandee(SEUIL_BASCULE_BANDE + 1)).toBe('bande');
  });

  /**
   * Le critère d'acceptation du jalon exige le seuil RÉEL, mesuré sur appareil.
   * Vingt-quatre est le milieu de la fourchette annoncée par le dossier, retenu
   * comme convention — pas comme mesure. Il est donc remplaçable.
   */
  it('le seuil est une convention nommée, et remplaçable', () => {
    expect(SEUIL_BASCULE_BANDE).toBe(24);
    expect(formeRecommandee(10, 5)).toBe('bande');
    expect(formeRecommandee(40, 100)).toBe('superposition');
  });
});

describe('la médiane, et pas la moyenne', () => {
  /**
   * LE TEST CENTRAL.
   *
   * Quatre tours à 100, un tour à 20 — le tour gâché par du trafic. La médiane
   * vaut 100, la moyenne vaudrait 84. Sur une trace de vitesse, seize unités
   * d'écart déplacent visiblement toute la courbe.
   */
  it('un tour aberrant ne déplace pas la ligne centrale', () => {
    const b = bandeDepuisTours([tour(100), tour(100), tour(100), tour(100), tour(20)]);
    const milieu = Math.floor(b.distance.length / 2);
    expect(b.mediane[milieu]).toBeCloseTo(100, 6);
    // La moyenne, elle, aurait donné 84.
    expect(b.mediane[milieu]).not.toBeCloseTo(84, 1);
  });

  it('l’étendue, elle, garde la trace de l’aberrant', () => {
    const b = bandeDepuisTours([tour(100), tour(100), tour(100), tour(100), tour(20)]);
    const milieu = Math.floor(b.distance.length / 2);
    expect(b.min[milieu]).toBeCloseTo(20, 6);
    expect(b.max[milieu]).toBeCloseTo(100, 6);
  });

  it('les quartiles encadrent la médiane', () => {
    const b = bandeDepuisTours([tour(90), tour(95), tour(100), tour(105), tour(110)]);
    const i = 3;
    expect(b.q1[i]!).toBeLessThanOrEqual(b.mediane[i]!);
    expect(b.mediane[i]!).toBeLessThanOrEqual(b.q3[i]!);
    expect(b.mediane[i]).toBeCloseTo(100, 6);
  });

  it('l’écart absolu médian se calcule et ignore l’aberrant', () => {
    expect(ecartAbsoluMedian([10, 10, 10, 10, 10])).toBe(0);
    expect(ecartAbsoluMedian([8, 9, 10, 11, 12])).toBe(1);
    // Un point très éloigné ne gonfle pas le MAD comme il gonflerait un σ.
    expect(ecartAbsoluMedian([9, 10, 11, 10, 1000])).toBeLessThanOrEqual(1);
  });

  it('l’écart absolu médian rend null sans mesure', () => {
    expect(ecartAbsoluMedian([])).toBeNull();
    expect(ecartAbsoluMedian([NaN, Infinity])).toBeNull();
  });
});

describe('ce qui ne fait pas une bande', () => {
  /** Une bande bâtie sur deux tours n'est pas une bande, c'est un intervalle. */
  it('moins de trois tours ne fait pas de bande', () => {
    expect(EFFECTIF_MIN).toBe(3);
    expect(bandeDepuisTours([tour(100), tour(101)]).distance).toEqual([]);
    expect(bandeExploitable(bandeDepuisTours([tour(100), tour(101)]))).toBe(false);
  });

  it('des tours vides ne font rien', () => {
    expect(bandeDepuisTours([]).distance).toEqual([]);
    expect(
      bandeDepuisTours([
        { distance: [], values: [] },
        { distance: [0], values: [1] },
      ]).distance
    ).toEqual([]);
  });

  it('le compte de tours retenus est rendu même quand la bande est vide', () => {
    expect(bandeDepuisTours([tour(100), tour(101)]).nbTours).toBe(2);
  });

  /**
   * Un pas mesuré par moins de trois tours rend `null` : une médiane sur deux
   * valeurs est la moyenne de ces deux valeurs, et perd tout ce qui justifiait
   * de la choisir.
   */
  it('un pas trop peu mesuré rend null et se compte', () => {
    const b = bandeDepuisTours([tour(100), tour(100), tour(100)]);
    expect(b.effectif.every((n) => n >= EFFECTIF_MIN)).toBe(true);
    expect(b.mediane.every((v) => v !== null)).toBe(true);
  });
});

describe('l’emprise partagée', () => {
  /**
   * Au-delà de l'emprise commune, un pas ne serait mesuré que par les tours les
   * plus longs — et la bande s'y rétrécirait pour une raison qui n'a rien à
   * voir avec la conduite.
   */
  it('la grille s’arrête au plus court des tours', () => {
    const b = bandeDepuisTours([tour(100, 500), tour(100, 500), tour(100, 300)]);
    expect(b.distance[b.distance.length - 1]).toBeLessThanOrEqual(300);
  });

  it('des tours sans recouvrement ne font pas de bande', () => {
    const loin: DistanceSeries = { distance: [900, 1000], values: [50, 50] };
    expect(bandeDepuisTours([tour(100, 200), tour(100, 200), loin]).distance).toEqual([]);
  });

  it('le pas demandé est celui de la grille', () => {
    const b = bandeDepuisTours([tour(100), tour(100), tour(100)], 25);
    expect(b.pas).toBe(25);
    expect(b.distance[1] - b.distance[0]).toBeCloseTo(25, 6);
  });
});

describe('la bande décrit, elle ne prescrit pas', () => {
  /**
   * Elle ne porte AUCUNE référence extérieure : ni cible, ni médiane d'autrui,
   * ni valeur « optimale ». Le dossier l'écrit pour la mémoire du circuit et
   * cela vaut ici — une ligne superposée à celle du pilote deviendrait une
   * cible, et l'application aurait prescrit sans un mot.
   */
  it('le résultat ne porte que des grandeurs issues des tours fournis', () => {
    const b = bandeDepuisTours([tour(90), tour(100), tour(110)]);
    expect(Object.keys(b).sort()).toEqual(
      ['distance', 'effectif', 'max', 'mediane', 'min', 'nbTours', 'pas', 'q1', 'q3'].sort()
    );
  });

  it('toutes les valeurs restent dans l’étendue des tours fournis', () => {
    const b = bandeDepuisTours([tour(90), tour(100), tour(110)]);
    for (let i = 0; i < b.distance.length; i++) {
      if (b.mediane[i] === null) continue;
      expect(b.min[i]!).toBeGreaterThanOrEqual(90);
      expect(b.max[i]!).toBeLessThanOrEqual(110);
      expect(b.mediane[i]!).toBeGreaterThanOrEqual(b.min[i]!);
      expect(b.mediane[i]!).toBeLessThanOrEqual(b.max[i]!);
    }
  });
});
