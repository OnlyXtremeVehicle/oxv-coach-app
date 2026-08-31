/**
 * LES VIRAGES DU CIRCUIT ROULÉ — lecture de `circuits.corners`.
 *
 * Ce module remplace `BELTOISE_CORNERS`, sept virages écrits en dur qui
 * étaient ceux de Haute Saintonge. Les charges utiles ci-dessous ont la forme
 * exacte que `corners-v1` écrit en base — vérifiée le 30/08/2026 sur les trois
 * circuits du calendrier : Bouteville 12 virages, le Bugatti 9, Albi 8.
 */

import { indexDesVirages, lireViragesCircuit, nomVirage } from '../viragesCircuit';

/** La forme réelle, telle que `detect-circuit-corners` l'écrit. */
const CHARGE_REELLE = {
  engine_version: 'corners-v1',
  params: { smoothWin: 0, resampleStep: 10, cornerRadius: 100 },
  calibration: 'centerline_latlon',
  n_corners: 3,
  corners: [
    {
      corner_index: 1,
      direction: 'left',
      apex_s_norm: 0.1667,
      r_m: 19,
      name: null,
      calibration: 'centerline_latlon',
    },
    {
      corner_index: 2,
      direction: 'right',
      apex_s_norm: 0.3111,
      r_m: 50,
      name: null,
      calibration: 'centerline_latlon',
    },
    {
      corner_index: 3,
      direction: 'left',
      apex_s_norm: 0.4944,
      r_m: 38,
      name: 'Chicane Dunlop',
      calibration: 'centerline_latlon',
    },
  ],
};

describe('lireViragesCircuit', () => {
  it('lit la charge que le détecteur écrit vraiment', () => {
    const v = lireViragesCircuit(CHARGE_REELLE);
    expect(v).toHaveLength(3);
    expect(v[0]).toEqual({
      index: 1,
      nom: null,
      sens: 'gauche',
      positionNormalisee: 0.1667,
      rayonM: 19,
    });
    expect(v[2].nom).toBe('Chicane Dunlop');
    expect(v[1].sens).toBe('droite');
  });

  /**
   * AUCUN VIRAGE EST UN CAS NORMAL, pas une panne. Bouteville était dans ce cas
   * jusqu'au 30/08 : 139 points de tracé et `corners` nul. La liste vide se
   * distingue à l'œil d'un circuit qui n'a pas de virage — les deux conduisent
   * l'appelant à ne rien afficher.
   */
  it('charge absente ou illisible → liste vide, jamais une exception', () => {
    expect(lireViragesCircuit(null)).toEqual([]);
    expect(lireViragesCircuit(undefined)).toEqual([]);
    expect(lireViragesCircuit({})).toEqual([]);
    expect(lireViragesCircuit({ corners: 'pas-un-tableau' })).toEqual([]);
    expect(lireViragesCircuit('du texte')).toEqual([]);
    expect(lireViragesCircuit(42)).toEqual([]);
  });

  /**
   * Un virage sans numéro n'est pas ADRESSABLE : les notes de coach sont
   * classées par index, et les laisser passer les rattacherait toutes ensemble.
   */
  it('écarte les virages sans numéro exploitable', () => {
    const v = lireViragesCircuit({
      corners: [
        { corner_index: 1, direction: 'left' },
        { corner_index: null, direction: 'right' },
        { corner_index: 0, direction: 'right' },
        { direction: 'left' },
        null,
        'pas un objet',
      ],
    });
    expect(v.map((x) => x.index)).toEqual([1]);
  });

  it('un sens inconnu vaut null, pas une supposition', () => {
    const v = lireViragesCircuit({
      corners: [{ corner_index: 1, direction: 'sideways' }, { corner_index: 2 }],
    });
    expect(v[0].sens).toBeNull();
    expect(v[1].sens).toBeNull();
  });

  it('une position ou un rayon non finis valent null', () => {
    const v = lireViragesCircuit({
      corners: [{ corner_index: 1, apex_s_norm: 'zero', r_m: null }],
    });
    expect(v[0].positionNormalisee).toBeNull();
    expect(v[0].rayonM).toBeNull();
  });

  /** L'ordre de la base fait foi mais ne se suppose pas : on trie. */
  it('la liste est triée par numéro, quel que soit l’ordre en base', () => {
    const v = lireViragesCircuit({
      corners: [{ corner_index: 9 }, { corner_index: 2 }, { corner_index: 12 }],
    });
    expect(v.map((x) => x.index)).toEqual([2, 9, 12]);
  });

  it('un nom vide ou blanc vaut absence de nom', () => {
    const v = lireViragesCircuit({
      corners: [{ corner_index: 1, name: '   ' }, { corner_index: 2, name: '' }],
    });
    expect(v[0].nom).toBeNull();
    expect(v[1].nom).toBeNull();
  });
});

describe('nomVirage', () => {
  const virages = lireViragesCircuit(CHARGE_REELLE);

  it('rend le nom éditorial quand la base en porte un', () => {
    expect(nomVirage(virages, 3)).toBe('Chicane Dunlop');
  });

  /**
   * LE REPLI EST VRAI PARTOUT. L'ancien chemin rendait « L'épingle Est » —
   * un virage de Haute Saintonge — sur n'importe quel circuit.
   */
  it('rend « Virage N » quand la base n’en porte pas', () => {
    expect(nomVirage(virages, 1)).toBe('Virage 1');
    expect(nomVirage([], 7)).toBe('Virage 7');
  });

  it('un virage absent de la liste garde son numéro', () => {
    expect(nomVirage(virages, 11)).toBe('Virage 11');
  });
});

describe('indexDesVirages', () => {
  it('rend les numéros dans l’ordre', () => {
    expect(indexDesVirages(lireViragesCircuit(CHARGE_REELLE))).toEqual([1, 2, 3]);
  });

  it('liste vide → aucun numéro à interroger', () => {
    expect(indexDesVirages([])).toEqual([]);
  });
});
