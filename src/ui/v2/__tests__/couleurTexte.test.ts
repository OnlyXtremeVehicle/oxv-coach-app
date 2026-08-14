import { colors } from '../tokens';
import { contraste, couleurTexteSure, luminance, SEUIL_TEXTE } from '../couleurTexte';

describe('contraste', () => {
  it('mesure les bornes connues', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contraste('#14151a', '#14151a')).toBeCloseTo(1, 6);
  });

  it('est symétrique', () => {
    expect(contraste('#E63946', '#14151A')).toBeCloseTo(contraste('#14151A', '#E63946'), 9);
  });

  it('luminance croît avec la clarté', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 6);
  });
});

describe('couleurTexteSure — la seule teinte QDI qui échoue est le freinage', () => {
  /**
   * LA MESURE, ÉPINGLÉE. Si une teinte ou un fond bouge, ce test le dit — et
   * `bg.card2` a bougé le 13/08 pour exactement ce genre de raison.
   */
  it.each([
    ['trajectoire', colors.qdi.trajectoire],
    ['fluidite', colors.qdi.fluidite],
    ['acceleration', colors.qdi.acceleration],
    ['regularite', colors.qdi.regularite],
  ])('%s reste elle-même — elle passe le seuil', (_n, teinte) => {
    expect(couleurTexteSure(teinte)).toBe(teinte);
  });

  it('le freinage est remplacé par le gris fort', () => {
    expect(couleurTexteSure(colors.qdi.freinage)).toBe(colors.text.hi);
  });

  it('et il échoue bien sur les TROIS fonds, pas seulement le pire', () => {
    for (const fond of [colors.bg.base, colors.bg.card, colors.bg.card2]) {
      expect(contraste(colors.qdi.freinage, fond)).toBeLessThan(SEUIL_TEXTE);
    }
  });

  /**
   * Le jugement porte sur le PIRE fond. Une teinte qui ne passerait que sur le
   * plus sombre serait acceptée à tort par un composant posé sur une carte.
   */
  it('juge sur le pire fond, pas sur un fond favorable', () => {
    // `text.dim` (#787C8A) mesure 3,63 sur bg.base — le meilleur des trois —
    // donc il doit être refusé, quel que soit le fond réel.
    expect(couleurTexteSure(colors.text.dim)).toBe(colors.text.hi);
  });

  it('un gris déjà conforme n’est pas touché', () => {
    expect(couleurTexteSure(colors.text.mid)).toBe(colors.text.mid);
  });
});
