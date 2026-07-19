/**
 * GlowStroke — Skia : le trait de tracé lumineux V2. Deux passes sur le
 * même chemin : dessous, le trait flouté en `accentGlow` (BlurMask 6 px —
 * la lumière DU trait, jamais un néon de fond) ; dessus, le trait net.
 *
 * `progress` (0..1) trime le chemin pour le tracé progressif — accepte un
 * nombre ou une SharedValue Reanimated (Skia 1.x les consomme directement,
 * l'animation reste hors du JS thread).
 *
 * À PLACER DANS UN <Canvas> Skia (TraceCircuit, dev-galerie) : ce composant
 * rend un fragment Skia, pas une vue RN. Module natif : pas d'Expo Go.
 * Chemin SVG invalide → chemin vide, jamais de crash.
 */

import { useMemo } from 'react';
import { BlurMask, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import { colors } from '../tokens';

export interface GlowStrokeProps {
  /** Chemin Skia, ou chaîne SVG ('M 0 0 L 10 10 …'). */
  path: SkPath | string;
  /** Couleur du trait. Par défaut colors.accent. */
  color?: string;
  /** Couleur de la lumière. Par défaut colors.accentGlow. */
  glowColor?: string;
  /** Épaisseur du trait net. Par défaut 3. */
  strokeWidth?: number;
  /** Rayon du flou de la lumière. Par défaut 6. */
  glowRadius?: number;
  /** Portion tracée, 0..1. Nombre ou SharedValue. Par défaut 1. */
  progress?: number | SharedValue<number>;
  /** Opacité d'ensemble. Par défaut 1. */
  opacity?: number;
}

export function GlowStroke({
  path,
  color = colors.accent,
  glowColor = colors.accentGlow,
  strokeWidth = 3,
  glowRadius = 6,
  progress = 1,
  opacity = 1,
}: GlowStrokeProps) {
  const skPath = useMemo<SkPath>(() => {
    if (typeof path !== 'string') return path;
    return Skia.Path.MakeFromSVGString(path) ?? Skia.Path.Make();
  }, [path]);

  return (
    <Group opacity={opacity}>
      <Path
        path={skPath}
        style="stroke"
        strokeWidth={strokeWidth + glowRadius / 2}
        strokeCap="round"
        strokeJoin="round"
        color={glowColor}
        start={0}
        end={progress}
      >
        <BlurMask blur={glowRadius} style="normal" />
      </Path>
      <Path
        path={skPath}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
        color={color}
        start={0}
        end={progress}
      />
    </Group>
  );
}
