/**
 * CircuitMap — point d'entrée unifié du pack web.
 *
 * Architecture symétrique à src/components/CircuitMap/index.ts du repo app :
 *   - CircuitMap = composant base (svg parent + viewBox)
 *   - Layers = fragments SVG composables
 *   - Presets = compositions pré-configurées
 */

export { CircuitMap, type CircuitMapProps } from './CircuitMap';

// Layers (pour composition manuelle)
export { TrackLayer, type TrackLayerProps } from './layers/TrackLayer';
export { CornersLayer, type CornersLayerProps, type CornerColorMode } from './layers/CornersLayer';
export { StartArrowLayer } from './layers/StartArrowLayer';

// Presets
export { PublicPreset, type PublicPresetProps } from './presets/PublicPreset';

// Projection (réutilisable hors layers)
export { projectToScene, getScenePoints, getCircuitViewBox } from './projection';
export type { ScenePoint } from './projection';
