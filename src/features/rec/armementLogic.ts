/**
 * armementLogic — logique PURE de l'appui long « ARMER LA CAPTURE » (V2-L2,
 * écran Placement 5/8).
 *
 * L'armement de la capture est un GESTE, jamais un tap accidentel : le pilote
 * maintient le bouton `ARM_HOLD_MS` (600 ms), une jauge circulaire se remplit
 * autour de son doigt, puis la capture démarre. Un relâchement précoce annule
 * proprement (la jauge revient à zéro, aucune session n'est créée).
 *
 * Ce module ne connaît ni React ni Reanimated : il décrit UNIQUEMENT la courbe
 * de progression et la décision d'armement/annulation, ce qui le rend testable
 * sous ts-jest/node. Le composant `placement.tsx` pilote le visuel avec
 * `withTiming(1, { duration: ARM_HOLD_MS })` (même courbe linéaire) et un
 * `Gesture.LongPress().minDuration(ARM_HOLD_MS)` pour le seuil — les deux
 * s'appuient sur la MÊME constante que celle testée ici (source unique).
 */

/** Durée de maintien avant armement (ms). Source unique du seuil et de la jauge. */
export const ARM_HOLD_MS = 600;

/** Phase du geste d'armement. */
export type ArmPhase = 'idle' | 'holding' | 'armed';

export interface ArmState {
  phase: ArmPhase;
  /** Remplissage de la jauge, 0..1. */
  progress: number;
}

export const ARM_INITIAL: ArmState = { phase: 'idle', progress: 0 };

/**
 * Remplissage de la jauge 0..1 pour un temps d'appui écoulé (linéaire, borné).
 * Un `holdMs` nul ou négatif renvoie 1 (armement immédiat) plutôt que d'échouer
 * sur une division. Un `elapsedMs` non fini ou négatif compte pour 0.
 */
export function armProgress(elapsedMs: number, holdMs: number = ARM_HOLD_MS): number {
  if (holdMs <= 0) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const p = elapsedMs / holdMs;
  return p >= 1 ? 1 : p;
}

/** Le seuil d'armement est-il atteint pour ce temps d'appui écoulé ? */
export function isArmComplete(elapsedMs: number, holdMs: number = ARM_HOLD_MS): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= holdMs;
}

/** Décision au relâchement : `armed` si le seuil est atteint, sinon `cancelled`. */
export function armOutcomeOnRelease(
  elapsedMs: number,
  holdMs: number = ARM_HOLD_MS
): 'armed' | 'cancelled' {
  return isArmComplete(elapsedMs, holdMs) ? 'armed' : 'cancelled';
}

/** Temps restant avant armement (ms), borné à 0. */
export function armRemainingMs(elapsedMs: number, holdMs: number = ARM_HOLD_MS): number {
  const remaining = holdMs - elapsedMs;
  return remaining > 0 ? remaining : 0;
}

/** Événements du geste (miroir des callbacks gesture-handler). */
export type ArmEvent =
  | { type: 'press-in' }
  | { type: 'tick'; elapsedMs: number; holdMs?: number }
  | { type: 'release'; elapsedMs: number; holdMs?: number };

/**
 * Réducteur pur du geste d'armement.
 *
 * - `press-in` : le doigt se pose → on entre en `holding`, jauge à 0.
 * - `tick`     : progression de la jauge ; atteindre 1 fait basculer en `armed`.
 * - `release`  : relâchement. Déjà `armed` → on conserve (le geste a réussi,
 *   l'effet a déjà été déclenché). Sinon, seuil atteint à la volée → `armed`,
 *   seuil non atteint → retour à `idle` (annulation propre, aucune capture).
 *
 * `armed` est un état ABSORBANT jusqu'au prochain `press-in` : un tick tardif
 * après armement ne « désarme » jamais.
 */
export function armReducer(state: ArmState, event: ArmEvent): ArmState {
  switch (event.type) {
    case 'press-in':
      return { phase: 'holding', progress: 0 };
    case 'tick': {
      if (state.phase !== 'holding') return state;
      const progress = armProgress(event.elapsedMs, event.holdMs);
      return progress >= 1 ? { phase: 'armed', progress: 1 } : { phase: 'holding', progress };
    }
    case 'release': {
      if (state.phase === 'armed') return state;
      return isArmComplete(event.elapsedMs, event.holdMs)
        ? { phase: 'armed', progress: 1 }
        : ARM_INITIAL;
    }
  }
}
