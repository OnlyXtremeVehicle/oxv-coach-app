/**
 * La palette de la CARTE — et la raison pour laquelle elle est séparée.
 *
 * ===========================================================================
 * DÉCISION FONDATEUR DU 17/08/2026 : LA CARTE NE PORTE PAS DE DONNÉE
 * ===========================================================================
 *
 * La carte montre un TERRITOIRE — des lieux, des routes, des étapes. Elle ne
 * montre jamais une donnée de conduite. Les cinq couleurs QDI et l'or du chrono
 * n'y ont donc aucun rôle.
 *
 * ===========================================================================
 * LA RÈGLE ÉTAIT ÉCRITE, ET LE CODE LA VIOLAIT
 * ===========================================================================
 *
 * `composer-route` portait le commentaire « couleurs de CATÉGORIE POI (identité
 * de lieu, jamais de la donnée de conduite) » — au-dessus d'une table qui
 * empruntait `colors.qdi.regularite` pour les cols et `colors.qdi.acceleration`
 * pour les étapes. Le motif habituel de ce dépôt : l'intention en commentaire,
 * l'infraction en dessous.
 *
 * L'unification des paliers du 17/08 l'avait même aggravée sans que rien ne le
 * dise : la Régularité étant passée au cyan, la catégorie « Col » est devenue
 * cyan le même jour — exactement la teinte de la branche de donnée.
 *
 * ===========================================================================
 * COMMENT CES TEINTES ONT ÉTÉ CHOISIES
 * ===========================================================================
 *
 * Par mesure, pas à l'œil. Écart perçu ΔE CIE76 contre les HUIT couleurs
 * réservées — les cinq branches QDI, l'or du chrono, l'or Heritage, le rouge de
 * marque — et contre les autres teintes de carte, pour qu'elles se distinguent
 * aussi entre elles. Seuil retenu : **ΔE ≥ 25**.
 *
 * | rôle        | teinte    | ΔE mini vs réservées | la plus proche |
 * |-------------|-----------|---------------------:|----------------|
 * | point de vue| `#E8E9ED` |                 35,7 | Régularité     |
 * | eau         | `#8FA6C4` |                 34,1 | Régularité     |
 * | col         | `#A783F2` |                 32,8 | Trajectoire    |
 * | sommet      | `#E091B8` |                 47,6 | Freinage       |
 * | étape       | `#FFFFFF` |                 38,7 | Régularité     |
 *
 * Un bronze (`#C99B6E`) avait été essayé pour les sommets : **ΔE 15,6 de l'or
 * Heritage**, donc écarté. C'est le genre de voisinage qu'on ne voit pas sur un
 * nuancier et qui saute aux yeux sur un écran sombre.
 *
 * **Le violet `#A783F2` n'est pas un choix par défaut.** Il était la Régularité
 * jusqu'au 17/08 ; il a été libéré ce jour-là, et il servait déjà à la
 * NAVIGATION (`app/(coach)/index.tsx`, catégorie « hôtels » de `carteIdentity`).
 * Le reprendre ici range les emplois non-QDI sous une même teinte.
 *
 * ===========================================================================
 * L'ÉTAPE NE SE DISTINGUE PAS QUE PAR LA COULEUR
 * ===========================================================================
 *
 * Le blanc de l'étape et le crème du point de vue sont proches — c'est assumé,
 * parce que l'étape n'est pas une CATÉGORIE mais un ÉTAT, et qu'elle porte en
 * plus une taille supérieure. Deux canaux plutôt qu'un : personne n'a à lire une
 * nuance de blanc pour savoir ce qu'il a sélectionné.
 *
 * L'étape valait auparavant `palette.green`, c'est-à-dire l'hex exact de la
 * branche Accélération. Le rôle d'état invoqué était défendable dans la
 * grammaire ; la teinte, non — c'était une couleur de donnée sur une carte.
 */

/** Les teintes de la carte. Aucune n'est une couleur de donnée. */
export const CARTE = {
  pointDeVue: '#E8E9ED',
  eau: '#8FA6C4',
  col: '#A783F2',
  sommet: '#E091B8',
  /** État « retenue comme étape » — épaulé par une pastille plus grande. */
  etape: '#FFFFFF',
} as const;

/** Diamètre des pastilles. L'étape est plus grosse : le second canal de lecture. */
export const TAILLE_PASTILLE = { normale: 14, etape: 20 } as const;
