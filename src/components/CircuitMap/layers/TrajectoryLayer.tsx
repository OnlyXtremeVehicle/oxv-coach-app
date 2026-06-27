/**
 * Layer Trajectoire pilote — chemin GPS réel d'une session, superposé
 * au ruban officiel.
 *
 * Source des points : un tableau de samples GPS (depuis telemetry_frames
 * ou parse UBX). Peut afficher une couleur uniforme ou une heatmap par
 * vitesse (gradient d'intensité, froid → chaud : faint → ambre). Couleur de
 * donnée, pas de jugement — l'ambre marque la vitesse la plus haute.
 */

import { Polyline } from 'react-native-svg';

import { theme } from '@/theme/v2';

import { projectToScene } from '../projection';

export type TrajectoryColorMode = 'uniform' | 'speed-heatmap';

export interface TrajectoryPoint {
  lat: number;
  lon: number;
  /** km/h, requis si colorMode === 'speed-heatmap'. */
  speed?: number | null;
}

export interface TrajectoryLayerProps {
  /** Liste de points GPS de la trajectoire du pilote. */
  points: TrajectoryPoint[];
  /** Mode de coloration. Uniform par défaut. */
  colorMode?: TrajectoryColorMode;
  /** Couleur si mode 'uniform'. Par défaut blanc semi-transparent. */
  color?: string;
  /** Épaisseur du trait. */
  strokeWidth?: number;
}

export function TrajectoryLayer({
  points,
  colorMode = 'uniform',
  color = 'rgba(255, 255, 255, 0.85)',
  strokeWidth = 3,
}: TrajectoryLayerProps) {
  if (points.length < 2) return null;

  if (colorMode === 'uniform') {
    const pointsStr = points
      .map((p) => {
        const scene = projectToScene(p);
        return `${scene.x.toFixed(2)},${scene.y.toFixed(2)}`;
      })
      .join(' ');
    return (
      <Polyline
        points={pointsStr}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }

  // Heatmap par vitesse : segments colorés
  const validSpeeds = points
    .map((p) => p.speed)
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1;

  return (
    <>
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const a = projectToScene(p);
        const b = projectToScene(next);
        const avgSpeed = ((p.speed ?? 0) + (next.speed ?? 0)) / 2;
        const ratio = maxSpeed > 0 ? avgSpeed / maxSpeed : 0;
        // Gradient d'intensité (carte de chaleur) : froid → chaud, le long du
        // tracé. Le plus chaud = ambre pilote (#F2792B). Couleur de donnée, jamais
        // un verdict — pas de rouge (réservé marque/coach/REC) ni d'or Heritage
        // (réservé Heritage + numéros de virage) dans les visualisations.
        const segColor =
          ratio < 0.25
            ? theme.palette.faint
            : ratio < 0.5
              ? theme.palette.creamMute
              : ratio < 0.75
                ? theme.palette.gold
                : '#F2792B';
        return (
          <Polyline
            key={i}
            points={`${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`}
            stroke={segColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}
