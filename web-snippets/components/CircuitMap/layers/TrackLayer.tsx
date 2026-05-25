/**
 * TrackLayer — polyline du circuit avec animation draw-on (~1.5s).
 *
 * Équivalent web de src/components/CircuitMap/layers/TrackLayer.tsx.
 * Différence : utilise CSS animations natives (stroke-dasharray + transition)
 * au lieu de l'Animated API de React Native.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { colors } from '@/data/tokens';

import { getScenePoints } from '../projection';

export interface TrackLayerProps {
  /** Anime le dessin progressif du tracé à l'entrée (~1.5s). */
  animate?: boolean;
  /** Couleur du tracé. */
  color?: string;
  /** Largeur du trait. */
  strokeWidth?: number;
  /** Opacité du tracé. */
  opacity?: number;
}

export function TrackLayer({
  animate = false,
  color = colors.text.secondary,
  strokeWidth = 4,
  opacity = 0.85,
}: TrackLayerProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState<number | null>(null);

  const d = useMemo(() => {
    const points = getScenePoints();
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  }, []);

  // Mesure la longueur réelle du chemin (plus précise que l'approx polyline).
  useEffect(() => {
    if (!animate || !pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    setPathLength(len);
  }, [animate]);

  return (
    <path
      ref={pathRef}
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={opacity}
      style={
        animate && pathLength != null
          ? {
              strokeDasharray: pathLength,
              strokeDashoffset: pathLength,
              animation: 'oxvDrawTrack 1500ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }
          : undefined
      }
    />
  );
}
