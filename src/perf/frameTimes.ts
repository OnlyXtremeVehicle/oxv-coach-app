/**
 * Analyse de temps d'image — lot T3.
 *
 * *« Profiler la DISTRIBUTION des temps d'image, jamais la moyenne — les shaders
 * provoquent un throttling thermique sur les appareils anciens. »*
 *
 * ---
 *
 * POURQUOI LA MOYENNE MENT, ICI PLUS QU'AILLEURS
 *
 * Un écran qui rend 95 % de ses images en 8 ms et 5 % en 90 ms affiche une
 * moyenne de 12 ms — sous le budget de 16,66 ms. Le rapport dirait « conforme ».
 * Le pilote, lui, voit une saccade toutes les vingt images.
 *
 * C'est exactement le profil que produit le throttling thermique : le rendu
 * tient, puis l'appareil chauffe et décroche par à-coups. La moyenne absorbe
 * précisément ce qu'on cherche.
 *
 * D'où des CENTILES, et un budget exprimé en « part d'images tenues » plutôt
 * qu'en valeur unique.
 *
 * ---
 *
 * CE MODULE NE MESURE RIEN
 *
 * Il analyse des temps déjà relevés. La mesure elle-même demande un appareil
 * réel — un émulateur ne chauffe pas, et c'est le défaut qu'on traque. Voir
 * `docs/T3_MESURE.md`.
 */

/** Budget d'une image à 60 Hz, en millisecondes. */
export const BUDGET_60HZ_MS = 1000 / 60;

export interface FrameStats {
  /** Nombre d'images retenues. */
  count: number;
  /** Centiles, en millisecondes. */
  p50: number;
  p95: number;
  p99: number;
  /** Pire image observée, en millisecondes. */
  worst: number;
  /**
   * Part des images tenant dans le budget, dans `[0, 1]`.
   * C'est LE chiffre à regarder — pas la moyenne.
   */
  withinBudget: number;
  /**
   * Moyenne, en millisecondes. Rendue pour comparaison avec les outils tiers,
   * **jamais comme critère** : voir l'en-tête du module.
   */
  mean: number;
}

/**
 * Analyse une série de temps d'image.
 *
 * Rend `null` sur une série vide : aucune statistique n'existe sans mesure, et
 * des zéros laisseraient croire à un rendu parfait.
 */
export function analyzeFrameTimes(
  temps: readonly number[],
  budgetMs: number = BUDGET_60HZ_MS
): FrameStats | null {
  const xs = temps.filter((t) => Number.isFinite(t) && t >= 0);
  if (xs.length === 0) return null;

  const tri = [...xs].sort((a, b) => a - b);
  const centile = (p: number): number => {
    // Interpolation linéaire entre rangs — sur de petits échantillons, prendre
    // l'élément le plus proche fait sauter le p95 d'une valeur à l'autre.
    const rang = (tri.length - 1) * p;
    const bas = Math.floor(rang);
    const haut = Math.ceil(rang);
    if (bas === haut) return tri[bas];
    return tri[bas] + (tri[haut] - tri[bas]) * (rang - bas);
  };

  let tenues = 0;
  let somme = 0;
  for (const t of xs) {
    somme += t;
    if (t <= budgetMs) tenues++;
  }

  return {
    count: xs.length,
    p50: centile(0.5),
    p95: centile(0.95),
    p99: centile(0.99),
    worst: tri[tri.length - 1],
    withinBudget: tenues / xs.length,
    mean: somme / xs.length,
  };
}

export interface ThrottlingVerdict {
  /** `true` si la seconde moitié de la trace est nettement plus lente. */
  detected: boolean;
  /** Centile 95 de la première moitié, en ms. */
  p95Debut: number;
  /** Centile 95 de la seconde moitié, en ms. */
  p95Fin: number;
  /** Rapport `fin / début`. Au-delà du seuil, on parle de dérive. */
  ratio: number;
}

/**
 * Détecte une DÉRIVE au fil de la trace — la signature du throttling.
 *
 * Une moyenne globale, même accompagnée de centiles, ne dit pas si le rendu
 * s'est dégradé PENDANT la mesure. Or c'est ce qui arrive quand l'appareil
 * chauffe : les premières secondes sont bonnes, les dernières non.
 *
 * On compare le centile 95 des deux moitiés. Le centile plutôt que la moyenne,
 * pour la raison habituelle ; le 95 plutôt que le pire, parce qu'une seule image
 * catastrophique ne fait pas une dérive.
 *
 * Rend `null` sous vingt images : une tendance ne se lit pas sur dix points.
 */
export function detectThrottling(
  temps: readonly number[],
  seuilRatio = 1.3
): ThrottlingVerdict | null {
  const xs = temps.filter((t) => Number.isFinite(t) && t >= 0);
  if (xs.length < 20) return null;

  const milieu = Math.floor(xs.length / 2);
  const debut = analyzeFrameTimes(xs.slice(0, milieu));
  const fin = analyzeFrameTimes(xs.slice(milieu));
  if (!debut || !fin) return null;

  // Un début à zéro rendrait le rapport infini : on borne par le pas de mesure
  // le plus fin qui ait un sens, plutôt que de rendre `Infinity`.
  const p95Debut = Math.max(debut.p95, 0.01);
  const ratio = fin.p95 / p95Debut;

  return {
    detected: ratio >= seuilRatio,
    p95Debut: debut.p95,
    p95Fin: fin.p95,
    ratio,
  };
}

export interface BudgetVerdict {
  passed: boolean;
  stats: FrameStats;
  /** Ce qui a échoué, en clair. Vide si tout tient. */
  reasons: string[];
}

/**
 * Verdict de budget pour un écran.
 *
 * Trois conditions, toutes nécessaires — c'est le point du lot. Un écran qui
 * tient la moyenne mais décroche au centile 99 saccade, et doit échouer.
 */
export function judgeBudget(
  temps: readonly number[],
  options: { budgetMs?: number; minWithinBudget?: number; maxP99Ms?: number } = {}
): BudgetVerdict | null {
  const budgetMs = options.budgetMs ?? BUDGET_60HZ_MS;
  const minWithin = options.minWithinBudget ?? 0.95;
  // Deux images de budget : au-delà, la saccade est visible à l'œil.
  const maxP99 = options.maxP99Ms ?? budgetMs * 2;

  const stats = analyzeFrameTimes(temps, budgetMs);
  if (!stats) return null;

  const reasons: string[] = [];
  if (stats.withinBudget < minWithin) {
    reasons.push(
      `${(stats.withinBudget * 100).toFixed(1)} % des images tiennent le budget, seuil ${(minWithin * 100).toFixed(0)} %`
    );
  }
  if (stats.p99 > maxP99) {
    reasons.push(`centile 99 à ${stats.p99.toFixed(1)} ms, plafond ${maxP99.toFixed(1)} ms`);
  }
  const derive = detectThrottling(temps);
  if (derive?.detected) {
    reasons.push(
      `dérive thermique : centile 95 passe de ${derive.p95Debut.toFixed(1)} à ${derive.p95Fin.toFixed(1)} ms`
    );
  }

  return { passed: reasons.length === 0, stats, reasons };
}
