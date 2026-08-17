/**
 * Une teinte de donnée peut-elle porter du TEXTE ? La mesure répond.
 *
 * ===========================================================================
 * LA RÈGLE, ET POURQUOI ELLE N'EST PAS UN GOÛT
 * ===========================================================================
 *
 * Les cinq teintes QDI sont faites pour des remplissages et des traits. Sur du
 * texte, elles doivent tenir un contraste — et depuis le 17/08/2026, toutes le
 * tiennent :
 *
 * | branche      | bg.base | bg.card | bg.card2 |
 * |--------------|--------:|--------:|---------:|
 * | trajectoire  |    6,51 |    6,01 |     5,62 |
 * | freinage     |    5,70 |    5,26 |     4,92 |
 * | accélération |    8,73 |    8,06 |     7,54 |
 * | fluidité     |   11,86 |   10,95 |    10,25 |
 * | régularité   |   12,12 |   11,18 |    10,46 |
 *
 * LE TABLEAU PRÉCÉDENT MESURAIT UNE AUTRE PALETTE. Jusqu'au 17/08, ce baril
 * portait ses propres hex, distincts de `dataColors` : le freinage y valait
 * `#E63946` et tombait à **3,78** sur `bg.card2` — sous 4,5:1 sur les trois
 * fonds, sous 4:1 sur deux d'entre eux. L'unification des paliers QDI sur
 * `src/theme/v2.ts` lui donne `#F65B5B`, et la régularité passe du violet
 * `#A783F2` au cyan `#66E4F3` (elle était indiscernable du bleu trajectoire
 * pour un daltonien : ΔE 4,9).
 *
 * Aucune branche n'échoue donc plus. Ce module n'en devient pas inutile — voir
 * la section suivante, qui est la raison pour laquelle il a été écrit ainsi.
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
 * Cette section décrivait ce que coûtait le repli du freinage : son chiffre
 * cessait d'être rouge, et l'association à sa branche ne survivait que sur la
 * barre ou le trait d'à côté. Ce coût n'est plus payé — `#F65B5B` passe, donc
 * le chiffre du freinage est rouge à nouveau.
 *
 * Ce qui reste vrai, et qui est la seule raison de garder ce module : le
 * verdict est CALCULÉ. Le jour où une teinte ou un fond bougera — et les deux
 * ont bougé, le 13/08 puis le 17/08 —, le repli reviendra de lui-même sur la
 * branche concernée, sans qu'aucune liste n'ait à être tenue à jour.
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
