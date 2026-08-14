/**
 * Une teinte de donnée peut-elle porter du TEXTE ? La mesure répond.
 *
 * ===========================================================================
 * LA RÈGLE, ET POURQUOI ELLE N'EST PAS UN GOÛT
 * ===========================================================================
 *
 * Les cinq teintes QDI sont faites pour des remplissages et des traits. Sur du
 * texte, elles doivent tenir un contraste — et une seule échoue :
 *
 * | branche      | bg.base | bg.card | bg.card2 |
 * |--------------|--------:|--------:|---------:|
 * | trajectoire  |    7,17 |    6,62 |     6,19 |
 * | fluidité     |   10,44 |    9,64 |     9,02 |
 * | **freinage** | **4,37**| **4,04**| **3,78** |
 * | accélération |   10,46 |    9,66 |     9,04 |
 * | régularité   |    6,90 |    6,37 |     5,96 |
 *
 * `#E63946` passe sous 4,5:1 sur les TROIS fonds, et sous 4:1 sur deux d'entre
 * eux. Mesuré le 14/08/2026, et déjà relevé dans l'état des lieux du 26/07.
 *
 * ===========================================================================
 * POURQUOI UNE FONCTION PLUTÔT QU'UNE EXCEPTION ÉCRITE À LA MAIN
 * ===========================================================================
 *
 * On aurait pu écrire « sauf le freinage » dans deux fichiers. Le jour où une
 * teinte bouge — et `bg.card2` a bougé le 13/08 pour cette raison exacte — la
 * liste écrite à la main resterait juste par accident, ou fausse en silence.
 *
 * Ici le verdict est CALCULÉ à chaque appel. Si demain la palette change, le
 * comportement suit sans qu'on ait à s'en souvenir.
 *
 * ===========================================================================
 * CE QUI EST PERDU, ET CE QUI NE L'EST PAS
 * ===========================================================================
 *
 * Le chiffre du freinage cesse d'être rouge. L'association à sa branche n'est
 * pas perdue pour autant : elle vit sur la barre, le point ou le trait juste à
 * côté — c'est-à-dire là où la doctrine la voulait depuis le début.
 */

import { colors } from './tokens';

/** Luminance relative WCAG d'un `#rrggbb`. */
export function luminance(hex: string): number {
  const canaux = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
}

/** Rapport de contraste WCAG entre deux `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Le seuil retenu : 4,5:1, le minimum AA pour du texte courant.
 *
 * Ce dépôt s'impose 7:1 sur ses GRIS de texte, et c'est la bonne exigence pour
 * de la matière lisible en continu. Une valeur de donnée est brève, isolée, et
 * accompagnée de son libellé : lui appliquer 7:1 écarterait quatre teintes sur
 * cinq et ferait disparaître un code couleur utile. On retient donc AA, et on
 * l'écrit plutôt que de le sous-entendre.
 */
export const SEUIL_TEXTE = 4.5;

/**
 * Les trois fonds sur lesquels une valeur peut être posée. On juge sur le
 * PIRE : un composant ne sait pas toujours quelle carte l'accueille.
 */
const FONDS = [colors.bg.base, colors.bg.card, colors.bg.card2] as const;

/**
 * La teinte si elle est lisible partout, sinon le gris fort.
 *
 * Le repli est `text.hi` et non une variante éclaircie de la teinte : inventer
 * une seconde couleur de marque pour contourner un seuil, c'est se donner deux
 * rouges dont l'un n'a jamais été arbitré.
 */
export function couleurTexteSure(teinte: string): string {
  const pire = Math.min(...FONDS.map((f) => contraste(teinte, f)));
  return pire >= SEUIL_TEXTE ? teinte : colors.text.hi;
}
