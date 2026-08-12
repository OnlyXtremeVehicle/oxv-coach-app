/**
 * L'échelle des petits multiples météo — jalon 4. Logique PURE.
 *
 * ===========================================================================
 * CE QUE LE PLAN DEMANDAIT DE VÉRIFIER AVANT DE DESSINER
 * ===========================================================================
 *
 * *« À vérifier avant de dessiner : ce que produit `weatherCorrelationService`
 * — une jointure est un fait, une corrélation serait causale. »*
 *
 * Vérifié le 05/08/2026. Le service est honnête : il RANGE des meilleurs tours
 * déjà mesurés dans des tranches fixes et en donne la moyenne. Aucune
 * prédiction, aucune tendance, aucun « optimal », et une tranche vide rend
 * `null` plutôt que zéro.
 *
 * **Mais la FORME affirmait ce que le calcul se refusait à dire.** Deux
 * défauts, tous deux invisibles à la lecture du service :
 *
 * 1. LA NORMALISATION. Les barres étaient mises à l'échelle entre le minimum et
 *    le maximum des seules tranches affichées. Deux tranches séparées d'un
 *    dixième de seconde produisaient donc l'écart visuel MAXIMAL — une barre au
 *    plafond, l'autre au plancher. Le pilote y lisait « il roule bien plus vite
 *    quand il fait chaud », alors que l'écart tenait dans le bruit d'un tour.
 *
 * 2. LE NOMBRE DE SÉANCES, présent dans la donnée et jamais affiché. Une
 *    tranche bâtie sur UNE séance se lisait exactement comme une tranche bâtie
 *    sur dix. C'est ce qui transforme un rangement en conclusion.
 *
 * Une corrélation ne s'écrit pas seulement avec des mots. Elle s'installe très
 * bien avec deux barres de hauteurs différentes.
 */

/** Ce dont le rendu a besoin pour une tranche. */
export interface TrancheAffichable {
  label: string;
  avgLapMs: number;
  count: number;
}

/**
 * Écart minimal, en millisecondes, en dessous duquel on ne creuse pas l'échelle.
 *
 * DEUX SECONDES. En deçà, l'écart entre deux tranches n'est pas distinguable du
 * bruit d'un tour à l'autre — trafic, sortie de stand, un freinage manqué. Le
 * dessiner en pleine amplitude ferait voir un effet là où il n'y a que de la
 * dispersion.
 *
 * Ce n'est pas une mesure : c'est un choix, et il est écrit ici plutôt que
 * dissous dans une formule.
 */
export const ECART_PLANCHER_MS = 2_000;

/**
 * Hauteurs de barres, en points, du plus lent au plus rapide.
 *
 * `hauteurMax` correspond au tour le plus RAPIDE — l'inversion est celle des
 * chronos, où moins est mieux, et elle est conservée telle quelle.
 */
export function hauteursBarres(
  tranches: readonly TrancheAffichable[],
  bornes: { min: number; max: number }
): number[] {
  if (tranches.length === 0) return [];

  const valeurs = tranches.map((t) => t.avgLapMs);
  const rapide = Math.min(...valeurs);
  const lent = Math.max(...valeurs);

  /**
   * LE PLANCHER D'ÉCART EST TOUT LE CORRECTIF. L'amplitude retenue est la plus
   * grande entre l'écart réel et le plancher : un écart de 100 ms se dessine
   * donc sur un vingtième de la hauteur, pas sur la totalité.
   */
  const amplitude = Math.max(ECART_PLANCHER_MS, lent - rapide);

  return valeurs.map((v) => {
    const t = (v - rapide) / amplitude; // 0 = le plus rapide
    return Math.round(bornes.max - t * (bornes.max - bornes.min));
  });
}

/**
 * Le libellé du nombre de séances.
 *
 * IL S'AFFICHE TOUJOURS, et surtout quand il vaut un. « 1 séance » est
 * précisément l'information qui empêche de lire une tendance dans une tranche
 * qui n'en porte aucune.
 */
export function libelleEffectif(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '—';
  return count > 1 ? `${count} séances` : '1 séance';
}

/**
 * L'écart affiché est-il assez large pour être dit ?
 *
 * Sert à la note de méthode sous le graphe. En deçà du plancher, on écrit que
 * les écarts sont trop petits pour être distingués — plutôt que de laisser le
 * lecteur conclure de lui-même sur des barres presque égales.
 */
export function ecartDistinguable(tranches: readonly TrancheAffichable[]): boolean {
  if (tranches.length < 2) return false;
  const valeurs = tranches.map((t) => t.avgLapMs);
  return Math.max(...valeurs) - Math.min(...valeurs) >= ECART_PLANCHER_MS;
}

/**
 * La note de méthode, ou `null` quand il n'y a rien à nuancer.
 *
 * DESCRIPTIVE, ET ELLE NE CONCLUT PAS. Elle dit ce que le graphe ne peut pas
 * dire — jamais ce que le pilote devrait en penser.
 */
export function noteMethode(tranches: readonly TrancheAffichable[]): string | null {
  if (tranches.length === 0) return null;

  const maigre = tranches.some((t) => t.count <= 1);
  const serre = !ecartDistinguable(tranches);

  if (serre && maigre) {
    return 'Les écarts sont trop faibles pour être distingués, et certaines tranches ne portent qu’une séance.';
  }
  if (serre) return 'Les écarts entre tranches sont trop faibles pour être distingués.';
  if (maigre) return 'Certaines tranches ne portent qu’une séance.';
  return null;
}
