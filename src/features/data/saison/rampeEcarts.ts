/**
 * Rampe séquentielle des seaux d'écart — histogramme de régularité (Saison).
 *
 * ===========================================================================
 * CE QUE CE MODULE CORRIGE
 * ===========================================================================
 *
 * L'histogramme peignait ses cinq seaux d'UNE SEULE teinte, `qdi.regularite`.
 * Or les seaux sont ordonnés — `< 0,5 s`, `0,5–1 s`, `1–2 s`, `2–5 s`, `5 s +` :
 * l'axe porte une distance croissante au tour de référence. Une couleur plate
 * sur un axe ordonné jette l'ordre. Seule la hauteur des barres restait
 * porteuse, et la couleur ne servait plus qu'à décorer.
 *
 * `src/render/ramp.ts` était écrit et testé depuis le socle T1, et n'avait
 * **aucun appelant** — pas plus que `ribbon.ts` à côté. C'est ici son premier.
 *
 * ===========================================================================
 * LE SENS DE LA RAMPE, ET POURQUOI IL N'EST PAS UN JUGEMENT
 * ===========================================================================
 *
 * La rampe part du seau le plus PROCHE du tour de référence et s'éteint vers le
 * plus lointain. Elle code donc la **distance à votre référence**, ce que l'axe
 * dit déjà — rien d'autre.
 *
 * Le sens inverse aurait été plus vif sur les grands écarts, et aurait attiré
 * l'œil sur l'irrégularité. L'app ne désigne pas ce qui va mal (Principe 2) :
 * elle montre. On garde donc la teinte pleine là où se tient la référence, et
 * on laisse la couleur se retirer à mesure qu'on s'en éloigne.
 *
 * ===========================================================================
 * LA COULEUR LOINTAINE N'EST PAS CHOISIE À L'ŒIL
 * ===========================================================================
 *
 * Elle tient dans la famille violette (B > R > G) : la rampe fait descendre le
 * chroma et la luminance, jamais la teinte. Une rampe qui change de teinte se
 * lit comme deux catégories, pas comme un continuum.
 *
 * Et elle tient un plancher : **3:1 contre `bg.card`**, seuil des éléments
 * graphiques porteurs de sens. C'est mesuré par le test voisin, pas affirmé
 * ici — une valeur de contraste écrite en commentaire est une valeur qui
 * survivra au jour où quelqu'un retouchera la teinte.
 *
 * La couleur reste par ailleurs REDONDANTE : chaque seau porte son libellé
 * (`BUCKET_LABELS`) et son compte sous la barre. Personne ne dépend de la
 * rampe pour lire l'histogramme.
 */

import { buildRamp, hexVersRgb, rgbVersHex, type Ramp } from '@/render/ramp';
import { colors } from '@/ui/v2/tokens';

/** Seau le plus proche du tour de référence — teinte QDI pleine. */
export const ECART_PROCHE = colors.qdi.regularite;

/** Seau le plus lointain — même famille, chroma et luminance retirés. */
export const ECART_LOINTAIN = '#7A7488';

/**
 * La rampe elle-même. `null` est impossible avec deux littéraux valides — et
 * c'est le test qui l'établit, pas ce commentaire : `rampe` y est asserté non
 * nul, de sorte que le repli ci-dessous soit une branche PROUVÉE morte plutôt
 * qu'une branche supposée morte.
 */
export const rampe: Ramp | null = (() => {
  const proche = hexVersRgb(ECART_PROCHE);
  const lointain = hexVersRgb(ECART_LOINTAIN);
  if (!proche || !lointain) return null;
  return buildRamp([
    { at: 0, color: proche },
    { at: 1, color: lointain },
  ]);
})();

/**
 * Les `n` couleurs des seaux, du plus proche au plus lointain.
 *
 * `n === 1` rend la teinte pleine : un seau unique n'a pas d'ordre à coder, et
 * `i / (n - 1)` y diviserait par zéro.
 */
export function couleursDesSeaux(n: number): string[] {
  if (!Number.isFinite(n) || n <= 0) return [];
  if (n === 1) return [ECART_PROCHE];
  if (!rampe) return Array.from({ length: n }, () => ECART_PROCHE);
  return Array.from({ length: n }, (_, i) => rgbVersHex(rampe.at(i / (n - 1))));
}
