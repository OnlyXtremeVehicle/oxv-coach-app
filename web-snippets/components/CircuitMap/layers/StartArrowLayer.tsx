/**
 * StartArrowLayer — indicateur de direction de départ.
 *
 * Équivalent web de src/components/CircuitMap/layers/StartArrowLayer.tsx.
 */

'use client';

import { colors } from '@/data/tokens';

import { getScenePoints } from '../projection';

export function StartArrowLayer() {
  const points = getScenePoints();
  if (points.length < 2) return null;
  return (
    <line
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
