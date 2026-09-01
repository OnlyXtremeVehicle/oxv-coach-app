/**
 * L'ÉCHANTILLONNAGE D'UNE TRACE — ce qu'il conserve, et ce qu'il refuse.
 *
 * Le défaut qu'il remplace n'était pas un défaut de dessin, c'était une
 * amputation : `loadSessionTrajectory` demandait mille positions et la carte
 * montrait le début de la séance en la nommant « SÉANCE ENTIÈRE ».
 *
 * On lit désormais toute la séance, et on allège le DESSIN. La différence est
 * la seule qui compte ici : un pas constant conserve la forme du tracé, une
 * limite conserve son début.
 */

import { echantillonne } from '../trajectoryLogic';

describe('echantillonne', () => {
  it('ne touche à rien sous le maximum', () => {
    const points = [1, 2, 3];
    expect(echantillonne(points, 10)).toBe(points);
  });

  it('rend au plus le maximum demandé, à un point près', () => {
    const points = Array.from({ length: 27_000 }, (_, i) => i);
    const sortie = echantillonne(points, 3000);
    expect(sortie.length).toBeLessThanOrEqual(3001);
    expect(sortie.length).toBeGreaterThan(2000);
  });

  /**
   * LA FIN EST LA MOITIÉ QUI MANQUAIT.
   *
   * C'est tout le sujet : une limite garde le début et jette la fin. Le pas
   * constant garde les deux, et le dernier point est ajouté explicitement —
   * sans quoi une trace de 27 000 points s'arrêterait 8 points avant la ligne.
   */
  it('conserve le premier ET le dernier point', () => {
    const points = Array.from({ length: 27_000 }, (_, i) => i);
    const sortie = echantillonne(points, 3000);
    expect(sortie[0]).toBe(0);
    expect(sortie[sortie.length - 1]).toBe(26_999);
  });

  it('couvre toute la longueur, pas seulement le début', () => {
    const points = Array.from({ length: 27_000 }, (_, i) => i);
    const sortie = echantillonne(points, 3000);
    const milieu = sortie[Math.floor(sortie.length / 2)];
    // Une lecture tronquée à 1 000 points aurait son milieu vers 500.
    expect(milieu).toBeGreaterThan(10_000);
  });

  it('un maximum nul ou négatif ne décime rien', () => {
    const points = [1, 2, 3];
    expect(echantillonne(points, 0)).toBe(points);
    expect(echantillonne(points, -5)).toBe(points);
  });

  it('une liste vide reste vide', () => {
    expect(echantillonne([], 100)).toEqual([]);
  });
});
