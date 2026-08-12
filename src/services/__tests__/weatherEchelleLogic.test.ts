/**
 * La forme n'affirme pas plus que la donnée.
 *
 * Le plan demandait de vérifier, avant de dessiner, que la météo produit une
 * JOINTURE et non une CORRÉLATION. Le calcul était honnête ; le rendu ne
 * l'était pas — deux barres normalisées entre leur propre min et max font voir
 * un effet maximal quel que soit l'écart réel.
 *
 * Une corrélation ne s'écrit pas seulement avec des mots.
 */

import {
  ECART_PLANCHER_MS,
  ecartDistinguable,
  hauteursBarres,
  libelleEffectif,
  noteMethode,
  type TrancheAffichable,
} from '../weatherEchelleLogic';

const BORNES = { min: 18, max: 52 };
const tr = (avgLapMs: number, count = 3, label = 't'): TrancheAffichable => ({
  label,
  avgLapMs,
  count,
});

describe('l’échelle — un petit écart se dessine petit', () => {
  /**
   * LE DÉFAUT CORRIGÉ. Avant, deux tranches séparées de 100 ms produisaient
   * une barre au plafond et une au plancher : le pilote y lisait « je roule
   * bien plus vite quand il fait chaud », sur un écart qui tient dans le bruit
   * d'un tour.
   */
  it('cent millisecondes ne remplissent pas toute la hauteur', () => {
    const h = hauteursBarres([tr(101_100), tr(101_200)], BORNES);
    const amplitudeDessinee = Math.abs(h[0] - h[1]);
    const amplitudeTotale = BORNES.max - BORNES.min;
    // 100 ms sur un plancher de 2 s : un vingtième, pas la totalité.
    expect(amplitudeDessinee).toBeLessThan(amplitudeTotale / 10);
  });

  it('un écart réellement grand occupe bien toute la hauteur', () => {
    const h = hauteursBarres([tr(101_000), tr(111_000)], BORNES);
    expect(Math.abs(h[0] - h[1])).toBe(BORNES.max - BORNES.min);
  });

  it('le plus RAPIDE a la barre la plus haute — l’inversion des chronos', () => {
    const h = hauteursBarres([tr(105_000), tr(100_000)], BORNES);
    expect(h[1]).toBeGreaterThan(h[0]);
  });

  it('une seule tranche ne fabrique aucun écart', () => {
    expect(hauteursBarres([tr(101_000)], BORNES)).toEqual([BORNES.max]);
  });

  it('aucune tranche, aucune barre', () => {
    expect(hauteursBarres([], BORNES)).toEqual([]);
  });

  it('le plancher est exactement celui qui est annoncé', () => {
    const h = hauteursBarres([tr(100_000), tr(100_000 + ECART_PLANCHER_MS)], BORNES);
    expect(Math.abs(h[0] - h[1])).toBe(BORNES.max - BORNES.min);
  });
});

describe('l’effectif — « 1 séance » est l’information qui compte', () => {
  /**
   * Une tranche bâtie sur une seule séance se lisait exactement comme une
   * tranche bâtie sur dix. C'est ce qui transforme un rangement en conclusion.
   */
  it('le singulier se dit', () => {
    expect(libelleEffectif(1)).toBe('1 séance');
  });

  it('le pluriel aussi', () => {
    expect(libelleEffectif(4)).toBe('4 séances');
  });

  it('un effectif absurde rend le tiret, jamais zéro', () => {
    for (const v of [0, -2, Number.NaN]) expect(libelleEffectif(v)).toBe('—');
  });
});

describe('la note de méthode — elle nuance, elle ne conclut pas', () => {
  it('rien à dire quand les écarts sont nets et les tranches fournies', () => {
    expect(noteMethode([tr(101_000, 5), tr(111_000, 4)])).toBeNull();
  });

  it('des écarts trop serrés se disent', () => {
    const n = noteMethode([tr(101_000, 5), tr(101_200, 4)]);
    expect(n).toContain('trop faibles');
  });

  it('une tranche à une seule séance se dit', () => {
    const n = noteMethode([tr(101_000, 1), tr(111_000, 6)]);
    expect(n).toContain('une séance');
  });

  it('les deux à la fois se disent ensemble, pas deux fois', () => {
    const n = noteMethode([tr(101_000, 1), tr(101_100, 1)]);
    expect(n).toContain('trop faibles');
    expect(n).toContain('une séance');
  });

  it('elle ne conclut jamais à la place du pilote', () => {
    const toutes = [
      noteMethode([tr(101_000, 1), tr(101_100, 1)]) ?? '',
      noteMethode([tr(101_000, 5), tr(101_200, 4)]) ?? '',
      noteMethode([tr(101_000, 1), tr(111_000, 6)]) ?? '',
    ];
    for (const n of toutes) {
      // Aucune causalité, aucun conseil, aucun jugement.
      expect(n).not.toMatch(/donc|parce que|à cause|explique|meilleur|préférez|évitez|devriez/i);
      expect(n).not.toMatch(/\blimite/i);
    }
  });
});

describe('ecartDistinguable', () => {
  it('faux sous le plancher, vrai au-dessus', () => {
    expect(ecartDistinguable([tr(101_000), tr(101_500)])).toBe(false);
    expect(ecartDistinguable([tr(101_000), tr(104_000)])).toBe(true);
  });

  it('une tranche seule n’est comparable à rien', () => {
    expect(ecartDistinguable([tr(101_000)])).toBe(false);
    expect(ecartDistinguable([])).toBe(false);
  });
});
