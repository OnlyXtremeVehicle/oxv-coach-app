/**
 * Évolution d'un virage pure (L3 DATA) — superpose les traces GPS du SEUL
 * pilote sur un même virage, passage après passage, normalisées dans une boîte
 * unité pour être dessinées l'une sur l'autre.
 *
 * Doctrine :
 *   - SELF-ONLY : on ne superpose que les passages du pilote courant. Aucun
 *     chrono, aucune trace d'un autre pilote (le loader n'appelle que des
 *     lecteurs self-only).
 *   - HONNÊTETÉ : un passage sans forme exploitable (< 2 points GPS valides, ou
 *     une trace d'étendue nulle) est ÉCARTÉ, jamais complété artificiellement.
 *     Si tout est écarté, on rend `{ passes: [] }` (vide assumé).
 *   - Le virage est défini par une fenêtre de PROGRESSION dans le tour
 *     (fraction 0..1 = index/(n-1)), car aucune table de segments n'existe.
 *
 * Module PUR : `import type` seul (aucun runtime React / RN / Supabase). Les
 * frames arrivent déjà mappées par le loader (`cornerEvolutionService.ts`).
 */

import type { SessionFrame } from '@/services/sessionTelemetryMapping';

/** Fenêtre du virage, en fraction de progression du tour [0..1]. */
export interface CornerWindow {
  startProgress: number;
  endProgress: number;
}

/** Point normalisé dans la boîte unité [0..1] × [0..1]. */
export interface CornerPassPoint {
  x: number;
  y: number;
}

/** Une trace de virage prête à dessiner. */
export interface CornerPass {
  sessionId: string;
  startedAt: string;
  points: CornerPassPoint[];
  /** `true` pour le passage le plus récent survivant (le seul mis en avant). */
  isCurrent: boolean;
}

export interface CornerEvolution {
  passes: CornerPass[];
}

/** Entrée d'un passage : les frames d'un tour d'une séance. */
export interface CornerPassInput {
  sessionId: string;
  startedAt: string;
  frames: SessionFrame[];
}

/** Nombre de passages superposés par défaut (les plus récents). */
export const DEFAULT_MAX_PASSES = 5;

/**
 * Découpe les frames sur la fenêtre de progression du virage, ne garde que les
 * points GPS réels, puis normalise le segment dans la boîte unité en
 * préservant le ratio d'aspect (même échelle sur lat et lon).
 *
 * Retourne `[]` si le segment n'a pas de forme exploitable (< 2 points valides
 * ou étendue nulle) — un passage indigent est écarté, pas inventé.
 */
export function sliceAndNormalize(frames: SessionFrame[], corner: CornerWindow): CornerPassPoint[] {
  const n = frames.length;
  if (n < 2) return [];

  const lo = Math.min(corner.startProgress, corner.endProgress);
  const hi = Math.max(corner.startProgress, corner.endProgress);

  // 1. Fenêtre de progression : progress = index / (n - 1).
  const windowFrames: SessionFrame[] = [];
  for (let i = 0; i < n; i++) {
    const progress = i / (n - 1);
    if (progress >= lo && progress <= hi) windowFrames.push(frames[i]);
  }

  // 2. Ne garde que les points GPS réels.
  const geo = windowFrames
    .filter(
      (f) => f.lat !== null && f.lon !== null && Number.isFinite(f.lat) && Number.isFinite(f.lon)
    )
    .map((f) => ({ lat: f.lat as number, lon: f.lon as number }));
  if (geo.length < 2) return [];

  // 3. Boîte unité, min-max, échelle partagée (ratio d'aspect préservé).
  const lats = geo.map((p) => p.lat);
  const lons = geo.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);
  const spanLat = Math.max(...lats) - minLat;
  const spanLon = Math.max(...lons) - minLon;
  const maxSpan = Math.max(spanLat, spanLon);
  if (!Number.isFinite(maxSpan) || maxSpan <= 0) return []; // étendue nulle → écarté

  const scale = 1 / maxSpan;
  // x = longitude (est-ouest), y = latitude (nord-sud).
  return geo.map((p) => ({
    x: (p.lon - minLon) * scale,
    y: (p.lat - minLat) * scale,
  }));
}

/**
 * Construit l'évolution d'un virage à partir de plusieurs passages.
 *
 * Ordre antéchronologique (le plus récent d'abord, sur `startedAt`). Chaque
 * passage est découpé + normalisé ; les passages sans forme exploitable sont
 * écartés. On conserve au plus `maxPasses` passages survivants (les plus
 * récents) ; le premier survivant porte `isCurrent = true`.
 */
export function buildCornerEvolution(
  passes: CornerPassInput[],
  corner: CornerWindow,
  opts?: { maxPasses?: number }
): CornerEvolution {
  const maxPasses = opts?.maxPasses ?? DEFAULT_MAX_PASSES;

  const ordered = [...passes].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  const built: CornerPass[] = [];
  for (const pass of ordered) {
    const points = sliceAndNormalize(pass.frames, corner);
    if (points.length < 2) continue; // passage écarté (honnêteté)
    built.push({
      sessionId: pass.sessionId,
      startedAt: pass.startedAt,
      points,
      isCurrent: false,
    });
    if (built.length >= maxPasses) break; // on ne garde que les plus récents
  }

  if (built.length > 0) built[0].isCurrent = true;
  return { passes: built };
}
