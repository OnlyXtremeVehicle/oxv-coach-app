/**
 * CircuitMap — point d'entrée unifié.
 *
 * Architecture :
 *   - CircuitMap = composant base (Svg parent + viewBox)
 *   - Presets = compositions pré-configurées (Pilot, Coach, Public)
 *   - Layers = fragments SVG composables (Track, Corners, Trajectory, etc.)
 *
 * Usage simple via preset :
 *   <PilotPreset trajectory={samples} zoneByIndex={margins} />
 *
 * Usage avancé via composition manuelle :
 *   <CircuitMap height={400}>
 *     <TrackLayer animate />
 *     <TrajectoryLayer points={...} />
 *     <CornersLayer colorMode="zone" zoneByIndex={...} />
 *   </CircuitMap>
 */

export { CircuitMap, type CircuitMapProps } from './CircuitMap';

// Layers (pour composition manuelle)
export { TrackLayer, type TrackLayerProps } from './layers/TrackLayer';
export { CornersLayer, type CornersLayerProps, type CornerColorMode } from './layers/CornersLayer';
export {
  TrajectoryLayer,
  type TrajectoryLayerProps,
  type TrajectoryPoint,
  type TrajectoryColorMode,
} from './layers/TrajectoryLayer';
export { StartArrowLayer } from './layers/StartArrowLayer';
export {
  BrakingPointsLayer,
  type BrakingPointsLayerProps,
  type BrakingMarker,
} from './layers/BrakingPointsLayer';

// Presets (compositions pré-configurées)
export { PilotPreset, type PilotPresetProps } from './presets/PilotPreset';
export { CoachPreset, type CoachPresetProps } from './presets/CoachPreset';
export { PublicPreset, type PublicPresetProps } from './presets/PublicPreset';

// TrackStage — instrument/tracé central gaming (4 modes : beam, replay, ab, heatmap)
export {
  TrackStage,
  type TrackStageProps,
  type TrackStageMode,
  type TrackStageHeatPoint,
} from './TrackStage';

// Projection (réutilisable hors layers — calcul d'une position sur le
// SVG, ou viewBox zoomé sur un virage spécifique)
export { projectToScene, getScenePoints, getCircuitViewBox, getCornerViewBox } from './projection';
export type { ScenePoint } from './projection';
