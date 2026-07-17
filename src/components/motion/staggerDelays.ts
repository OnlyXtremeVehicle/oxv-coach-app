/**
 * staggerDelays — calcul pur des délais d'une cascade d'apparition.
 *
 * Extrait du composant <Stagger> pour être testable en logique pure
 * (aucun import react-native ici — les tests tournent sous ts-jest/node).
 *
 * Le délai du n-ième enfant vaut `initialDelay + n × interval`, plafonné
 * par `maxDelay` : sur une liste longue, les derniers éléments n'attendent
 * pas dix secondes — au-delà du plafond, tout apparaît ensemble.
 */

export interface StaggerTimingOptions {
  /** Délai entre deux enfants consécutifs en ms. */
  interval: number;
  /** Délai avant le premier enfant en ms. Par défaut 0. */
  initialDelay?: number;
  /**
   * Plafond absolu du délai (initialDelay compris) en ms.
   * Par défaut Infinity (pas de plafond).
   */
  maxDelay?: number;
}

/** Délai d'apparition de l'enfant à l'index donné (ms, jamais négatif). */
export function staggerDelay(index: number, options: StaggerTimingOptions): number {
  const { interval, initialDelay = 0, maxDelay = Infinity } = options;
  const safeIndex = Math.max(0, Math.floor(index));
  const raw = Math.max(0, initialDelay) + safeIndex * Math.max(0, interval);
  return Math.min(raw, Math.max(0, maxDelay));
}

/** Tableau des délais pour `count` enfants. */
export function staggerDelays(count: number, options: StaggerTimingOptions): number[] {
  const safeCount = Math.max(0, Math.floor(count));
  const delays: number[] = [];
  for (let i = 0; i < safeCount; i++) {
    delays.push(staggerDelay(i, options));
  }
  return delays;
}
