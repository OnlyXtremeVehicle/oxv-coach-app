/**
 * instruments/ — primitifs visuels de la refonte gaming « cockpit factuel ».
 *
 * Langage cockpit, jamais le jugement : or = donnée (neutre), pas de zones
 * vert/jaune/rouge, rouge réservé marque + bande coach. Un seul fait par
 * instrument.
 */

export { GaugeInstrument, type GaugeInstrumentProps } from './GaugeInstrument';
export { CoachBand, type CoachBandProps, type CoachBandItem } from './CoachBand';
export { MeterBar, type MeterBarProps, type MeterTone } from './MeterBar';
export { Fact, type FactProps } from './Fact';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ABTrace, loadBestTrajectory, type ABTraceProps } from './ABTrace';
