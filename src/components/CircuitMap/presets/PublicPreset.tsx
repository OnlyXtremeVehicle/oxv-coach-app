/**
 * Preset Public — vitrine sans données pilote.
 *
 * Composition :
 *   - Tracé animé blanc
 *   - Flèche de départ
 *   - 7 virages neutres (gris, juste pour situer)
 *   - Labels visibles
 *
 * Pas de marge, pas de trajectoire, pas de comparaison. Juste la
 * beauté du tracé. Pour usage admin demo, écran d'accueil, ou écran
 * intermédiaire avant qu'une session soit disponible.
 *
 * Note : la vraie surface 1 (page web oxvehicle.fr) est codée en
 * Next.js dans web-snippets/ — ce preset RN est l'équivalent côté
 * app mobile pour les contextes hors session.
 */

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
      <CornersLayer colorMode="neutral" showLabels={true} radius={14} />
    </CircuitMap>
  );
}
