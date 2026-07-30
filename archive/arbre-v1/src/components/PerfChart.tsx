/**
 * PerfChart (V9, Skia) — profil de vitesse d'une séance, v1. BUILD-PENDING.
 *
 * Même statut natif que DataLabCanvas : ne tourne PAS en Expo Go, chargé via un
 * require() gardé (cf. data-lab-canvas.tsx). Trace la courbe de vitesse dans le
 * temps. Doctrine : la vitesse est une DONNÉE → trait OR (canon, distinct de la
 * marge qui passe en ambre). Pas un verdict, une lecture. Socle commun au futur
 * perf Pro / PartnerPerfChart (mêmes charts, doc V9 Axe 2).
 *
 * À VÉRIFIER au prochain build EAS (Skia ne rend rien en Expo Go).
 */

import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import type { CanvasTrajectoryPoint } from '@/components/DataLabCanvas';
import { theme } from '@/theme/v2';

export function PerfChart({
  trajectory,
  width = 320,
  height = 120,
}: {
  trajectory: CanvasTrajectoryPoint[];
  width?: number;
  height?: number;
}) {
  const speeds = trajectory
    .map((p) => (typeof p.speed === 'number' ? p.speed : null))
    .filter((v): v is number => v !== null);

  // Sans série de vitesse exploitable, on ne dessine rien (honnêteté : pas de
  // fausse courbe). L'écran garde déjà l'affichage via `hasSpeed`.
  if (speeds.length < 2) {
    return null;
  }

  const n = speeds.length;
  const max = Math.max(...speeds, 1);
  const pad = 2;
  const usableH = height - pad * 2;

  const line = Skia.Path.Make();
  speeds.forEach((sp, i) => {
    const x = (i / (n - 1)) * width;
    const y = height - pad - (sp / max) * usableH;
    if (i === 0) line.moveTo(x, y);
    else line.lineTo(x, y);
  });

  return (
    <Canvas style={{ width, height }}>
      <Path
        path={line}
        style="stroke"
        strokeWidth={2}
        color={theme.palette.gold}
        strokeJoin="round"
        strokeCap="round"
      />
    </Canvas>
  );
}
