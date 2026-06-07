/**
 * Preset Pilote — carte du bilan post-session ou consultation historique.
 *
 * Composition :
 *   - Tracé animé (dessin progressif à l'entrée si animate=true)
 *   - Flèche de départ rouge OXV discrète
 *   - Trajectoire GPS du pilote (optionnel, si trajectory fourni)
 *   - 7 virages coloriés par marge (depuis zoneByIndex) ou par pace si null
 *
 * Doctrine : ce qui s'est passé, pas ce qu'il faut faire. Aucun overlay
 * coaching ici (pas de flèches "freinez plus tard", pas de comparaison
 * avec un tour de référence).
 */

import { CircuitMap, type CircuitMapProps } from '../CircuitMap';
import { BrakingPointsLayer, type BrakingMarker } from '../layers/BrakingPointsLayer';
import { CornersLayer } from '../layers/CornersLayer';
import { StartArrowLayer } from '../layers/StartArrowLayer';
import { TrackLayer } from '../layers/TrackLayer';
import {
  TrajectoryLayer,
  type TrajectoryColorMode,
  type TrajectoryPoint,
} from '../layers/TrajectoryLayer';
import { type MarginZone } from '@/types/domain';

export interface PilotPresetProps extends Omit<CircuitMapProps, 'children'> {
  /** Animation d'entrée du tracé (~1.5s). True par défaut pour le bilan. */
  animate?: boolean;
  /** Trajectoire GPS du pilote (samples depuis telemetry_frames). */
  trajectory?: TrajectoryPoint[];
  /** Coloration de la trajectoire si fournie. */
  trajectoryColorMode?: TrajectoryColorMode;
  /** Marges par virage (1..7) → vert/jaune/rouge. */
  zoneByIndex?: Record<number, MarginZone>;
  /** Virage sélectionné (highlight). */
  selectedIndex?: number | null;
  /** Points de freinage à superposer (pilier §3.4). Optionnel. */
  brakingPoints?: BrakingMarker[];
}

export function PilotPreset({
  animate = true,
  trajectory,
  trajectoryColorMode = 'uniform',
  zoneByIndex,
  selectedIndex = null,
  brakingPoints,
  ...mapProps
}: PilotPresetProps) {
  return (
    <CircuitMap {...mapProps}>
      <TrackLayer animate={animate} />
      <StartArrowLayer />
      {trajectory && trajectory.length > 1 ? (
        <TrajectoryLayer points={trajectory} colorMode={trajectoryColorMode} />
      ) : null}
      {brakingPoints && brakingPoints.length > 0 ? (
        <BrakingPointsLayer points={brakingPoints} />
      ) : null}
      <CornersLayer
        colorMode={zoneByIndex ? 'zone' : 'pace'}
        zoneByIndex={zoneByIndex}
        selectedIndex={selectedIndex}
      />
    </CircuitMap>
  );
}
