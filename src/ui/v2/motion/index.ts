/**
 * Langage de motion V2 — barrel local (lot L0, Livrable 5).
 * 11 primitives + la logique pure (motionMath).
 */

export { useDoorTransition } from './useDoorTransition';
export { useReduceMotion } from './useReduceMotion';
export { Stagger, staggerEntering, type StaggerProps } from './Stagger';
export {
  useCondensingHeader,
  CondensingHeaderBar,
  type CondensingHeaderOptions,
  type CondensingHeaderBarProps,
} from './useCondensingHeader';
export { HeroMorphProvider, useHeroMorphSource, useHeroMorphTarget } from './HeroMorph';
export {
  PullToRefreshDial,
  type PullToRefreshDialProps,
  type PullScrollProps,
} from './PullToRefreshDial';
export { RollingCounter, type RollingCounterProps } from './RollingCounter';
export { Shimmer, type ShimmerProps } from './Shimmer';
export { RecordFlash, type RecordFlashProps } from './RecordFlash';
export { NeedleSweep, type NeedleSweepProps } from './NeedleSweep';
export { PressScale, type PressScaleProps } from './PressScale';
export { GlowStroke, type GlowStrokeProps } from './GlowStroke';
export * from './motionMath';
