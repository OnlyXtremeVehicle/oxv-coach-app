/**
 * Le seuil d'interruption — jalon 3, lot 21e. Logique PURE.
 *
 * ===========================================================================
 * CE QUE LE PLAN DEMANDE, ET POURQUOI UN SEUIL FIXE NE SUFFIT PAS
 * ===========================================================================
 *
 * *« Seuil d'interruption sur LE TOUR DE RÉFÉRENCE DU PILOTE, repli en
 * secondes. »*
 *
 * Vingt secondes de liaison perdue ne veulent pas dire la même chose partout.
 * Sur un tour de référence à 1:41, c'est un cinquième de tour — le pilote a
 * perdu un morceau de piste identifiable. Sur un tour à 3:00, c'est un
 * neuvième, et souvent une ligne droite. Un seuil en secondes, le même pour
 * tout le monde, dirait « interruption » à l'un et se tairait pour l'autre,
 * sans que rien ne le justifie.
 *
 * Le seuil est donc une FRACTION du tour de référence. Le repli en secondes
 * sert au cas où ce tour n'existe pas encore — première séance, aucun tour
 * bouclé —, et c'est explicitement ce que le plan prévoit.
 *
 * ===========================================================================
 * CE QUE CE MODULE NE FAIT PAS
 * ===========================================================================
 *
 * Il ne décide pas de couper la capture. La clôture pour lien perdu reste ce
 * qu'elle était : quinze minutes d'interruption continue, et rien d'autre que
 * le pilote ne ferme une séance. Ce module ne sert qu'à DIRE, au retour, ce
 * qui s'est passé.
 *
 * Il n'estime pas non plus « les tours perdus » comme un fait. Un trou de
 * quarante secondes n'a pas forcément coûté un demi-tour : le pilote était
 * peut-être aux stands. On rend une PROPORTION du tour de référence, et le mot
 * employé à l'écran doit rester au conditionnel.
 *
 * ===========================================================================
 * SILENCE EN PISTE
 * ===========================================================================
 *
 * Rien de tout ceci ne s'affiche pendant le roulage. Le Principe 3 tient : la
 * restitution se fait à l'arrêt. Ce module est appelé au retour, pas au
 * moment du trou.
 */

/** Un trou de liaison, tel que la capture le relève. */
export interface TrouLiaison {
  /** Durée du trou, en millisecondes. */
  dureeMs: number;
  /** Instant de reprise, ISO. Sert à ordonner, jamais à afficher seul. */
  repriseIso: string;
}

/**
 * Fraction du tour de référence au-delà de laquelle un trou compte.
 *
 * Un dixième : sur un tour de 1:41, cela fait dix secondes. En deçà, le trou
 * tient dans le bruit d'une reconnexion ordinaire et le dire alarmerait pour
 * rien — un message qui ne sert à rien apprend à ignorer les suivants.
 */
export const FRACTION_SEUIL = 0.1;

/**
 * Repli, en millisecondes, quand aucun tour de référence n'existe.
 *
 * Dix secondes : la même valeur que la fraction donnerait sur un tour de 1:41,
 * qui est l'ordre de grandeur d'un tour de circuit-école. Ce n'est pas une
 * mesure, c'est un choix — et il est écrit ici plutôt que dissous dans le code.
 */
export const SEUIL_REPLI_MS = 10_000;

/**
 * Le seuil applicable, en millisecondes.
 *
 * `null` et les valeurs absurdes retombent sur le repli : un tour de référence
 * qu'on n'a pas mesuré ne doit pas produire un seuil qu'on n'a pas mesuré non
 * plus.
 */
export function seuilInterruptionMs(tourReferenceMs: number | null | undefined): number {
  if (typeof tourReferenceMs !== 'number') return SEUIL_REPLI_MS;
  if (!Number.isFinite(tourReferenceMs) || tourReferenceMs <= 0) return SEUIL_REPLI_MS;
  return Math.round(tourReferenceMs * FRACTION_SEUIL);
}

/** Un trou dépasse-t-il le seuil ? */
export function trouSignificatif(
  trou: TrouLiaison,
  tourReferenceMs: number | null | undefined
): boolean {
  if (!Number.isFinite(trou.dureeMs) || trou.dureeMs <= 0) return false;
  return trou.dureeMs >= seuilInterruptionMs(tourReferenceMs);
}

export interface BilanInterruptions {
  /** Combien de trous dépassent le seuil. */
  nombre: number;
  /** Durée cumulée de ces trous, en millisecondes. */
  cumulMs: number;
  /**
   * Part du tour de référence que représente le cumul, ou `null` quand aucun
   * tour de référence n'est connu. **C'est une proportion, pas un compte de
   * tours perdus** — le pilote était peut-être aux stands.
   */
  partDuTour: number | null;
}

/**
 * Le bilan des trous, à dire au retour.
 *
 * Les trous SOUS le seuil ne sont pas comptés — ni en nombre, ni en durée. Les
 * inclure dans le cumul ferait apparaître une somme que rien ne justifie, et
 * l'application dirait « quatre minutes d'interruption » là où il n'y a eu que
 * des reconnexions ordinaires.
 */
export function bilanInterruptions(
  trous: readonly TrouLiaison[],
  tourReferenceMs: number | null | undefined
): BilanInterruptions {
  const retenus = trous.filter((t) => trouSignificatif(t, tourReferenceMs));
  const cumulMs = retenus.reduce((s, t) => s + t.dureeMs, 0);
  const reference =
    typeof tourReferenceMs === 'number' && Number.isFinite(tourReferenceMs) && tourReferenceMs > 0
      ? tourReferenceMs
      : null;
  return {
    nombre: retenus.length,
    cumulMs,
    partDuTour: reference === null || cumulMs === 0 ? null : cumulMs / reference,
  };
}

/**
 * La phrase à afficher, ou `null` quand il n'y a rien à dire.
 *
 * DESCRIPTIVE, ET AU CONDITIONNEL SUR CE QU'ON NE SAIT PAS. On affirme la
 * durée — elle est mesurée. On n'affirme pas ce qu'elle a coûté : « environ un
 * tiers d'un tour de référence » situe sans prétendre que le pilote roulait.
 *
 * Aucun impératif, aucun reproche. Une liaison qui tombe n'est pas une faute du
 * pilote, et le lui dire sur ce ton serait doublement faux.
 */
export function phraseInterruptions(bilan: BilanInterruptions): string | null {
  if (bilan.nombre === 0) return null;

  const secondes = Math.round(bilan.cumulMs / 1000);
  const duree =
    secondes >= 60
      ? `${Math.floor(secondes / 60)} min ${String(secondes % 60).padStart(2, '0')} s`
      : `${secondes} s`;

  const debut =
    bilan.nombre === 1
      ? `La liaison a été interrompue une fois, ${duree}.`
      : `La liaison a été interrompue ${bilan.nombre} fois, ${duree} au total.`;

  if (bilan.partDuTour === null) return debut;

  // Arrondi au dixième, et jamais « 0,0 » : sous un dixième, on ne chiffre pas.
  const part = Math.round(bilan.partDuTour * 10) / 10;
  if (part < 0.1) return debut;
  const nombreFr = String(part).replace('.', ',');
  return `${debut} Soit environ ${nombreFr} fois votre tour de référence.`;
}
