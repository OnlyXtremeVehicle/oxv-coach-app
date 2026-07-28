/**
 * Métriques de mise en page — jalon 2, phase 1 (dossier de conception §IV.1 à §IV.3).
 *
 * Fonctions PURES. Aucun import React, aucun accès à l'écran : elles reçoivent
 * une largeur et rendent une valeur. C'est ce qui les rend testables au banc,
 * et c'est ce qui permet au test d'acceptation « chaînes françaises sur 320 pt »
 * d'exister sans moteur de rendu.
 *
 * ---
 *
 * POURQUOI LA CHASSE 0,6 N'EST PAS UNE APPROXIMATION ICI
 *
 * Le dossier note « environ 0,6 × la taille » et demande de mesurer sur la fonte
 * réelle. La fonte réelle du chiffre roi est **JetBrains Mono**, dont l'avance
 * est de 600 unités pour 1000 d'em : exactement 0,6 em. Et c'est une fonte à
 * chasse fixe — la graisse Bold porte la MÊME avance, sinon elle ne serait plus
 * monospace. Le facteur est donc exact pour tout ce qui est rendu en
 * `fonts.king` / `fonts.mono`, pas une estimation.
 *
 * Il ne l'est PAS pour les fontes proportionnelles (Hanken Grotesk). Pour
 * celles-là, `avanceProportionnelle` donne une borne HAUTE prudente — voir son
 * commentaire. Un budget prudent qui laisse de la place ne casse rien ; un
 * budget optimiste laisse une chaîne se faire tronquer sur iPhone SE.
 */

/** Largeurs logiques à couvrir (dossier §IV.1). La plus étroite commande. */
export const LARGEUR_LA_PLUS_ETROITE = 320;

/** Avance d'un glyphe en fonte à chasse fixe, en fraction de la taille. */
export const CHASSE_MONO = 0.6;

/**
 * Réserve exigée par le dossier (§IV.3) avant tout repli : on ne remplit jamais
 * la largeur utile à 100 %. Une chaîne qui touche exactement le bord est déjà
 * une chaîne tronquée dès que la fonte système diffère d'un cheveu.
 */
export const RESERVE = 0.1;

/**
 * Plancher du chiffre roi. En dessous, ce n'est plus un chiffre roi : le repli
 * a échoué et c'est la maquette qu'il faut reprendre, pas la taille.
 */
export const PLANCHER_CHIFFRE_ROI = 32;

/** Plafond du chiffre roi au-delà de 7 caractères (dossier §IV.3). */
export const PLAFOND_CHIFFRE_ROI_LONG = 56;

/** Seuil de longueur au-delà duquel le plafond s'applique. */
export const LONGUEUR_PLAFONNEE = 7;

/**
 * Marge latérale, PAR PALIER — jamais par calcul proportionnel continu, qui
 * gonflerait le vide sur Pro Max sans bénéfice (dossier §IV.1).
 *
 * 320 à 414 pt → 20 pt · au-delà de 414 pt → 24 pt.
 */
export function margeEcran(largeurEcran: number): number {
  return largeurEcran > 414 ? 24 : 20;
}

/** Largeur réellement disponible pour le contenu : l'écran moins ses deux marges. */
export function largeurUtile(largeurEcran: number): number {
  return largeurEcran - 2 * margeEcran(largeurEcran);
}

/**
 * Largeur occupée par une chaîne en fonte à chasse fixe. Exact pour JetBrains
 * Mono (voir en-tête).
 *
 * `letterSpacing` est compté par glyphe : React Native l'ajoute APRÈS chaque
 * caractère, y compris le dernier. C'est la même convention que le moteur de
 * rendu, donc le budget ne dérive pas.
 */
export function avanceMono(texte: string, taille: number, letterSpacing = 0): number {
  return texte.length * (taille * CHASSE_MONO + letterSpacing);
}

/**
 * Borne HAUTE de la largeur d'une chaîne en fonte proportionnelle.
 *
 * Hanken Grotesk n'a pas d'avance unique. On prend 0,62 em par glyphe : au-dessus
 * de la moyenne réelle d'un texte français (~0,50 em, l'accentuation ne changeant
 * pas l'avance), en dessous des seules capitales larges (M, W). Un budget qui
 * surestime légèrement protège ; un budget qui sous-estime tronque.
 *
 * À remplacer par une mesure réelle le jour où un banc de rendu existe — d'ici
 * là, cette borne est ce qui permet au test d'acceptation d'exister.
 */
export function avanceProportionnelle(texte: string, taille: number, letterSpacing = 0): number {
  return texte.length * (taille * 0.62 + letterSpacing);
}

/**
 * Taille finale du chiffre roi.
 *
 * Trois contraintes, dans cet ordre :
 *
 * 1. la taille souhaitée par l'écran ;
 * 2. le **plafond de 56 pt au-delà de 7 caractères** — `1:41,203` fait 8 glyphes
 *    et ne peut pas être traité comme `287` ;
 * 3. le **repli** : si même plafonné le chiffre ne tient pas dans la largeur
 *    disponible moins la réserve de 10 %, on descend jusqu'à ce qu'il tienne.
 *
 * Le résultat est arrondi vers le bas à l'entier — un demi-point de fonte ne se
 * voit pas et complique la lecture des maquettes.
 *
 * `largeurDisponible` omise (ou nulle) → seules les contraintes 1 et 2 jouent.
 * C'est le cas d'un chiffre posé dans un bloc dont la largeur n'est pas connue
 * du composant ; la contrainte 2 reste, elle, toujours active.
 */
export function tailleChiffreRoi(
  valeur: string,
  tailleSouhaitee: number,
  largeurDisponible?: number | null
): number {
  let taille = tailleSouhaitee;

  if (valeur.length > LONGUEUR_PLAFONNEE) {
    taille = Math.min(taille, PLAFOND_CHIFFRE_ROI_LONG);
  }

  if (largeurDisponible != null && largeurDisponible > 0 && valeur.length > 0) {
    const budget = largeurDisponible * (1 - RESERVE);
    const maximale = budget / (valeur.length * CHASSE_MONO);
    taille = Math.min(taille, maximale);
  }

  return Math.max(PLANCHER_CHIFFRE_ROI, Math.floor(taille));
}

/**
 * La chaîne tient-elle dans la largeur donnée, réserve comprise ?
 *
 * Sert au test d'acceptation : un libellé français sur 320 pt ne doit pas
 * seulement « rentrer », il doit rentrer avec sa réserve.
 */
export function tientAvecReserve(largeurTexte: number, largeurDisponible: number): boolean {
  return largeurTexte <= largeurDisponible * (1 - RESERVE);
}
