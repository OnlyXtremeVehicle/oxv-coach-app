/**
 * PublicPreset — composition pour la vitrine web /circuit.
 *
 * Équivalent du PublicPreset RN, configuré pour le contexte public web :
 *   - Tracé blanc animé (effet d'entrée à l'arrivée sur la page)
 *   - Flèche de départ rouge
 *   - 7 virages neutres (gris doux, juste pour situer)
 *   - Labels visibles
 *
 * Pas de marge, pas de trajectoire, pas de comparaison. Juste la beauté
 * du tracé.
 */

'use client';

import { CircuitMap, type CircuitMapProps } from '../CircuitMap';
import { CornersLayer } from '../layers/CornersLayer';
import { StartArrowLayer } from '../layers/StartArrowLayer';
import { TrackLayer } from '../layers/TrackLayer';

export interface PublicPresetProps extends Omit<CircuitMapProps, 'children'> {
  animate?: boolean;
}

export function PublicPreset({ animate = true, ...mapProps }: PublicPresetProps) {
  return (
    <CircuitMap {...mapProps}>
      <TrackLayer animate={animate} color="#FFFFFF" opacity={0.85} strokeWidth={3} />
      <StartArrowLayer />
      <CornersLayer colorMode="neutral" showLabels radius={14} />
    </CircuitMap>
  );
}
