/**
 * Preset Coach — carte d'observation d'un pilote suivi.
 *
 * Composition :
 *   - Tracé statique (pas d'animation, le coach veut voir l'info vite)
 *   - Flèche de départ
 *   - Trajectoire GPS du pilote (obligatoire si pilote a une session)
 *   - 7 virages coloriés par marge moyenne ou dernière session
 *   - Labels visibles
 *
 * Doctrine : le coach observe ce que le pilote vit. Pas d'overlay
 * "voici ce qu'il aurait dû faire". L'interprétation est humaine.
 */

import { CircuitMap, type CircuitMapProps } from '../CircuitMap';
import { CornersLayer } from '../layers/CornersLayer';
import { StartArrowLayer } from '../layers/StartArrowLayer';
import { TrackLayer } from '../layers/TrackLayer';
import { TrajectoryLayer, type TrajectoryPoint } from '../layers/TrajectoryLayer';
import { type MarginZone } from '@/types/domain';

export interface CoachPresetProps extends Omit<CircuitMapProps, 'children'> {
  trajectory?: TrajectoryPoint[];
  zoneByIndex?: Record<number, MarginZone>;
  selectedIndex?: number | null;
}

export function CoachPreset({
  trajectory,
  zoneByIndex,
  selectedIndex = null,
  ...mapProps
}: CoachPresetProps) {
  return (
    <CircuitMap {...mapProps}>
      <TrackLayer animate={false} />
      <StartArrowLayer />
      {trajectory && trajectory.length > 1 ? (
        <TrajectoryLayer points={trajectory} colorMode="speed-heatmap" />
      ) : null}
      <CornersLayer
        colorMode="zone"
        zoneByIndex={zoneByIndex}
        selectedIndex={selectedIndex}
        showLabels={true}
      />
    </CircuitMap>
  );
}
