/**
 * Quels deux tours le delta compare — jalon 4, phase 4septies. Logique PURE.
 *
 * ---
 *
 * LA RÈGLE, ET POURQUOI ELLE EST ÉCRITE ICI
 *
 * Un delta n'a de sens qu'entre deux tours nommés. Choisir la paire au fil de
 * l'écran mènerait à des comparaisons différentes selon le chemin emprunté, et
 * le pilote lirait deux fois le même écran avec deux chiffres différents.
 *
 *   RÉFÉRENCE — votre meilleur tour chronométré. Le dossier de conception est
 *   net : le coach compare le tour rapide à d'autres tours rapides, jamais à
 *   une moyenne, et se méfie du seul meilleur tour comme d'un biais de
 *   sélection. La référence reste néanmoins le meilleur : c'est le tour dont
 *   le pilote se souvient.
 *
 *   COURANT — le tour sélectionné.
 *
 * ---
 *
 * LE CAS OÙ LE TOUR SÉLECTIONNÉ EST LE MEILLEUR
 *
 * Se comparer à soi-même donne une courbe plate à zéro. C'est vrai, et ça
 * n'apprend rien. La référence devient alors le DEUXIÈME meilleur tour, et
 * l'écran le dit — le pilote lit où son meilleur tour s'est réellement fait.
 *
 * ---
 *
 * CE QUI N'ENTRE PAS
 *
 * Les tours de sortie et de rentrée aux stands. Ce ne sont pas des tours
 * chronométrés ; la base en porte la preuve, avec un `is_outlap` de vingt-deux
 * millisecondes à 1,39 km/h.
 */

/** Ce qu'un tour doit porter pour entrer dans le choix. */
export interface TourCandidat {
  lapNumber: number;
  /** Durée en secondes. `null` si non chronométrée. */
  durationSeconds: number | null;
  isOutlap?: boolean | null;
  isInlap?: boolean | null;
}

export interface PaireTours {
  courant: number;
  reference: number;
  /**
   * La référence est-elle le DEUXIÈME meilleur tour plutôt que le meilleur ?
   *
   * Vrai quand le tour sélectionné est lui-même le meilleur. L'écran doit le
   * dire : sans cela, « référence » désignerait deux choses selon les cas.
   */
  referenceEstSecond: boolean;
}

/** Un tour chronométré et exploitable. */
function retenu(t: TourCandidat): boolean {
  return (
    t.isOutlap !== true &&
    t.isInlap !== true &&
    t.durationSeconds !== null &&
    Number.isFinite(t.durationSeconds) &&
    t.durationSeconds > 0
  );
}

/**
 * La paire à comparer, ou `null` s'il n'y a pas de quoi.
 *
 * `null` quand moins de deux tours chronométrés existent — et l'écran dit
 * l'absence plutôt que de comparer un tour à lui-même en silence.
 */
export function choisitPaireTours(
  tours: readonly TourCandidat[],
  tourSelectionne: number | null
): PaireTours | null {
  const valides = tours.filter(retenu).sort((a, b) => a.durationSeconds! - b.durationSeconds!);
  if (valides.length < 2) return null;

  const meilleur = valides[0].lapNumber;
  const second = valides[1].lapNumber;

  // Sélection absente ou écartée (un tour de stand, par exemple) : on montre
  // le meilleur contre le deuxième, qui est la comparaison la plus parlante.
  const selectionValide =
    tourSelectionne !== null && valides.some((t) => t.lapNumber === tourSelectionne);
  if (!selectionValide) {
    return { courant: meilleur, reference: second, referenceEstSecond: true };
  }

  if (tourSelectionne === meilleur) {
    return { courant: meilleur, reference: second, referenceEstSecond: true };
  }
  return { courant: tourSelectionne, reference: meilleur, referenceEstSecond: false };
}
