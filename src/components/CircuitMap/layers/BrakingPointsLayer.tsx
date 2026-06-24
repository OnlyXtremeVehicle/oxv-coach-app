/**
 * Layer Points de freinage — marque les zones de forte décélération sur
 * le tracé. Complète le pilier §3.4 (carte de chaleur) du cahier OXV
 * Mirror : « vitesse, trajectoires ET points de freinage ».
 *
 * Chaque point est un cercle dont l'opacité reflète l'intensité du
 * freinage (chute de vitesse normalisée). Couleur bleue (sémantique
 * « freinage »), sans jugement.
 */

import { Circle } from 'react-native-svg';

import { theme } from '@/theme/v2';

import { projectToScene } from '../projection';

export interface BrakingMarker {
  lat: number;
  lon: number;
  /** 0..1 — intensité du freinage. */
  intensity: number;
}

export interface BrakingPointsLayerProps {
  points: BrakingMarker[];
  /** Rayon de base du marqueur (scène = mètres). Défaut 6. */
  baseRadius?: number;
}

export function BrakingPointsLayer({ points, baseRadius = 6 }: BrakingPointsLayerProps) {
  if (points.length === 0) return null;
  return (
    <>
      {points.map((p, i) => {
        const scene = projectToScene(p);
        // Rayon et opacité croissent avec l'intensité (0.4 → 1).
        const radius = baseRadius * (0.7 + 0.6 * p.intensity);
        const opacity = 0.35 + 0.45 * p.intensity;
        return (
          <Circle
            key={i}
            cx={scene.x}
            cy={scene.y}
            r={radius}
            fill={theme.dataColors.brake}
            fillOpacity={opacity}
            stroke={theme.dataColors.brake}
            strokeWidth={1}
            strokeOpacity={0.8}
          />
        );
      })}
    </>
  );
}
