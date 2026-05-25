/**
 * Layer Flèche de départ — indique le sens de circulation au début
 * du tracé. Discret mais présent.
 */

import { Line } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { getScenePoints } from '../projection';

export function StartArrowLayer() {
  const points = getScenePoints();
  if (points.length < 2) return null;
  return (
    <Line
      x1={points[0].x}
      y1={points[0].y}
      x2={points[1].x}
      y2={points[1].y}
      stroke={colors.accent.red}
      strokeWidth={8}
      strokeLinecap="round"
    />
  );
}
