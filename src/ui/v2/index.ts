/**
 * Kit V2 — DA Instrument (programme V2, lot L0). Barrel central.
 *
 * Réservé à l'arbre `app/(app2)` et aux lots V2 (L1-L5). Les espaces v1
 * continuent d'importer `src/ui/*` et `src/theme/v2.ts` jusqu'à la bascule L6.
 *
 * Import type : `import { colors, typo, ChronoHero, haptic } from '@/ui/v2'`.
 */

// Fondations
export * as tokens from './tokens';
export { colors, space, radius, motion as motionTokens, type as typo } from './tokens';
export { haptic, type HapticKind } from './haptics';

// Iconographie, motion, média (barrels locaux)
export * from './icons';
export * from './motion';
export * from './media';

// Composants noyau
export { StateView } from './StateView';
export { ProvenanceTag } from './ProvenanceTag';
export { SectionHeader } from './SectionHeader';
export { Chip } from './Chip';
export { ListRow } from './ListRow';
export { StatCell } from './StatCell';
export { SessionCard } from './SessionCard';
export { ChronoHero } from './ChronoHero';
export { RadarQdi } from './RadarQdi';
export { PillarBar } from './PillarBar';
export { TraceCircuit } from './TraceCircuit';
export {
  BiometryStrip,
  type BiometrySource,
  type BiometryQuality,
  type BiometryStripProps,
} from './BiometryStrip';
export { HeritageBand } from './HeritageBand';
export { SpringDot } from './SpringDot';
export { Dial } from './Dial';
export { CentralButton } from './CentralButton';
export { Sheet } from './Sheet';
export { TabBar } from './TabBar';

// Logique pure (testée) + hooks
export * from './uiLogic';
export * from './vizMath';
export * from './shellLogic';
export * from './centralButtonLogic';
export { useCentralButtonState } from './useCentralButtonState';
export { useFirstViewport } from './useFirstViewport';
