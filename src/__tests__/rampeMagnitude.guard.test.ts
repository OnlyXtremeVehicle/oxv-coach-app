/**
 * GARDE — toute rampe de magnitude se lit dans un seul sens.
 *
 * ===========================================================================
 * LE DÉFAUT QU'ELLE VERROUILLE, MESURÉ LE 14/08/2026
 * ===========================================================================
 *
 * `speedHeat` (bleu → cyan → vert → jaune) portait des luminosités de
 * 0,688 → 0,786 → 0,751 → 0,858 : le troisième pas PLUS SOMBRE que le
 * deuxième. Sur la trajectoire, une zone à 85 km/h paraissait plus foncée
 * qu'une zone à 70 — la rampe s'inversait au milieu du domaine, et aucun œil
 * ne l'avait vu en quatre semaines.
 *
 * ===========================================================================
 * POURQUOI ELLE CALCULE AU LIEU DE COMPARER DES CHAÎNES
 * ===========================================================================
 *
 * Même leçon que `loiCouleurTexte` : une liste de hex « approuvés » resterait
 * juste par accident le jour où une teinte bouge. Cette garde IMPORTE les
 * rampes réelles et calcule leur luminance relative (WCAG) : si quelqu'un
 * remplace un pas demain, elle rejuge le nouveau, pas l'ancien. Quatre gardes
 * textuelles sur neuf ont accusé à tort le 13-14/08 ; celle-ci ne lit pas de
 * texte, elle ne peut pas confondre un commentaire et une expression.
 *
 * Deux lois, celles d'une rampe de magnitude :
 *   1. luminosité STRICTEMENT croissante — clair = fort, sans inversion ;
 *   2. un écart minimal entre pas voisins — deux pas indiscernables sont un
 *      seul pas qui ment sur la résolution de la rampe.
 */

import { RAMPE_MAGNITUDE, RAMPE_ORDRE } from '@/ui/v2/grammaireViz';
import { speedHeat } from '@/theme/v2';

/** Luminance relative WCAG 2.x — suffisante pour juger un ORDRE de clarté. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Écart minimal entre pas voisins — sous ce seuil, deux pas n'en font qu'un. */
const ECART_MIN = 0.03;

function verifieMonotone(nom: string, rampe: readonly string[]) {
  const lums = rampe.map(luminance);
  for (let i = 1; i < lums.length; i++) {
    const ecart = lums[i] - lums[i - 1];
    it(`${nom} : pas ${i} (${rampe[i]}) plus clair que pas ${i - 1} (${rampe[i - 1]})`, () => {
      expect(ecart).toBeGreaterThan(0);
    });
    it(`${nom} : écart ${i - 1}→${i} ≥ ${ECART_MIN}`, () => {
      expect(ecart).toBeGreaterThanOrEqual(ECART_MIN);
    });
  }
}

describe('rampes de magnitude — luminosité strictement croissante', () => {
  // La rampe partagée du thème (trajectoire, heatmap, zones cardio).
  // C'est CELLE-CI qui portait l'inversion : si le correctif du 14/08 est
  // défait — ou si un futur « petit ajustement » réintroduit une teinte —
  // cette suite échoue avec le pas fautif dans son intitulé.
  verifieMonotone('speedHeat', speedHeat);

  // Les rampes de la grammaire, tenues à la même loi qu'elles imposent.
  verifieMonotone('RAMPE_MAGNITUDE', RAMPE_MAGNITUDE);
  // PAS DE `.reverse()` — corrigé le 15/08/2026.
  //
  // La version livrée renversait la rampe avant de la juger, sur la foi d'un
  // commentaire (« sombre = premier ») qui décrivait pourtant l'ordre RÉEL :
  // `RAMPE_ORDRE` va bien de #184F95 (0,080) à #86B6EF (0,448), strictement
  // croissante. Le renversement fabriquait une décroissance, et la garde
  // accusait une rampe juste — quatre échecs sur un défaut inexistant.
  //
  // C'est le motif contre lequel cette garde a été écrite, retourné contre
  // elle : elle ne lit pas de texte, mais elle abîmait son entrée avant de la
  // mesurer. Une garde ne transforme pas ce qu'elle juge.
  verifieMonotone('RAMPE_ORDRE', RAMPE_ORDRE);
});
