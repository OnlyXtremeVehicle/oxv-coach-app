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

// Presets (compositions pré-configurées)
export { PilotPreset, type PilotPresetProps } from './presets/PilotPreset';
export { CoachPreset, type CoachPresetProps } from './presets/CoachPreset';
export { PublicPreset, type PublicPresetProps } from './presets/PublicPreset';

// Projection (réutilisable hors layers, ex: pour calculer la position
// d'un tap utilisateur sur le SVG)
export { projectToScene, getScenePoints, getCircuitViewBox } from './projection';
export type { ScenePoint } from './projection';
