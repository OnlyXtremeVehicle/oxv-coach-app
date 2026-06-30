/**
 * DataLabCanvas (V9, Skia) — rendu riche du tracé + trajectoire pilote, v1.
 *
 * ⚠️ BUILD-PENDING. @shopify/react-native-skia est un module NATIF : il ne tourne
 * PAS en Expo Go. Ce composant n'est volontairement câblé à AUCUNE route pour
 * l'instant — sinon l'app crasherait en Expo Go au chargement du module. À
 * BRANCHER et VÉRIFIER au prochain build EAS, puis itérer (pan/zoom gestuel,
 * couches vitesse/G par segment, scrubber timeline).
 *
 * v1 = rendu STATIQUE : le ruban du circuit (géométrie de projection partagée
 * avec le CircuitMap SVG, donc alignement cohérent) + la trajectoire colorée
 * selon la couche. Doctrine : couleurs de DONNÉE sobres — ni or de perf, ni rouge
 * de marque sur le tracé.
 */

import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import {
  getCircuitViewBox,
  getScenePoints,
  projectToScene,
} from '@/components/CircuitMap/projection';
import { theme } from '@/theme/v2';

export type CanvasLayer = 'trace' | 'vitesse' | 'marges';

export interface CanvasTrajectoryPoint {
  lat: number;
  lon: number;
  speed?: number | null;
}

function parseViewBox(): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = getCircuitViewBox().split(' ').map(Number);
  return { x, y, w, h };
}

export function DataLabCanvas({
  trajectory,
  layer = 'trace',
  height = 320,
  width = 320,
}: {
  trajectory?: CanvasTrajectoryPoint[];
  layer?: CanvasLayer;
  height?: number;
  width?: number;
}) {
  const vb = parseViewBox();
  const scale = Math.min(width / vb.w, height / vb.h);
  const offsetX = (width - vb.w * scale) / 2;
  const offsetY = (height - vb.h * scale) / 2;
  const px = (sx: number) => offsetX + (sx - vb.x) * scale;
  const py = (sy: number) => offsetY + (sy - vb.y) * scale;

  // Ruban du circuit (géométrie officielle projetée).
  const track = Skia.Path.Make();
  getScenePoints().forEach((p, i) => {
    if (i === 0) track.moveTo(px(p.x), py(p.y));
    else track.lineTo(px(p.x), py(p.y));
  });
  track.close();

  // Trajectoire du pilote (si fournie).
  let traj: ReturnType<typeof Skia.Path.Make> | null = null;
  if (trajectory && trajectory.length > 1) {
    traj = Skia.Path.Make();
    trajectory.forEach((t, i) => {
      const s = projectToScene(t);
      if (i === 0) traj!.moveTo(px(s.x), py(s.y));
      else traj!.lineTo(px(s.x), py(s.y));
    });
  }

  // Couleur de donnée par couche (ambre pilote pour la vitesse ; crème sinon).
  const trajColor = layer === 'vitesse' ? theme.palette.pilotAmber : theme.palette.cream;

  return (
    <Canvas style={{ width, height }}>
      <Path
        path={track}
        style="stroke"
        strokeWidth={2}
        color={theme.palette.line}
        strokeJoin="round"
        strokeCap="round"
      />
      {traj ? (
        <Path
          path={traj}
          style="stroke"
          strokeWidth={3}
          color={trajColor}
          strokeJoin="round"
          strokeCap="round"
        />
      ) : null}
    </Canvas>
  );
}
