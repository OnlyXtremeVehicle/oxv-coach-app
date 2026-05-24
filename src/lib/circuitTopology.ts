/**
 * Topologie statique du circuit Haute Saintonge (tracé Beltoise).
 *
 * Pour V1 : 14 virages avec positions GPS approximatives et coordonnées
 * SVG dans le viewBox du tracé. Ces valeurs sont des placeholders cohérents
 * avec la doctrine ("14 virages") mais ne sont PAS issues d'un relevé
 * topométrique précis. La calibration officielle viendra en sem 11
 * (procédure section 9 de docs/architecture/02_PARTIE_2_algorithmes.md).
 *
 * En attendant, l'app affiche un rendu plausible et permet de valider
 * la grammaire visuelle (pastilles colorées, zoom virage, navigation).
 */

import type { MarginZone } from '@/types/domain';

export interface CornerTopology {
  /** Numéro de virage, 1-14. */
  index: number;
  /** Nom poétique du virage — à valider avec Gabin (V1 = placeholders). */
  name: string;
  /** Position GPS approximative du point de corde. */
  apexLat: number;
  apexLon: number;
  /** Position dans le viewBox SVG du circuit (pour rendu direct sans projection). */
  svgX: number;
  svgY: number;
  /** Profil de virage — utilisé pour le manifeste contextuel. */
  pace: 'fast' | 'medium' | 'slow';
}

/** ViewBox du SVG `circuits.track_svg_path` du circuit Haute Saintonge. */
export const BELTOISE_SVG_VIEWBOX = { width: 1000, height: 600 } as const;

/**
 * 14 virages estimés visuellement sur le tracé SVG simplifié.
 * Les coordonnées GPS sont des approximations dans le bbox connu du circuit.
 *
 * Bbox réel : lat ∈ [45.6002, 45.6023], lon ∈ [-0.1440, -0.1379].
 * Centre approximatif : lat 45.6012, lon -0.1410.
 */
export const BELTOISE_CORNERS: readonly CornerTopology[] = [
  {
    index: 1,
    name: 'V1 — Entrée',
    apexLat: 45.60055,
    apexLon: -0.14,
    svgX: 700,
    svgY: 405,
    pace: 'medium',
  },
  { index: 2, name: 'V2', apexLat: 45.60085, apexLon: -0.1393, svgX: 870, svgY: 360, pace: 'fast' },
  {
    index: 3,
    name: 'V3 — Épingle nord',
    apexLat: 45.6011,
    apexLon: -0.1395,
    svgX: 900,
    svgY: 310,
    pace: 'slow',
  },
  {
    index: 4,
    name: 'V4',
    apexLat: 45.60135,
    apexLon: -0.1405,
    svgX: 815,
    svgY: 260,
    pace: 'medium',
  },
  {
    index: 5,
    name: 'V5',
    apexLat: 45.60155,
    apexLon: -0.1415,
    svgX: 720,
    svgY: 195,
    pace: 'medium',
  },
  {
    index: 6,
    name: 'V6 — Le S des chênes (entrée)',
    apexLat: 45.60175,
    apexLon: -0.1425,
    svgX: 600,
    svgY: 165,
    pace: 'fast',
  },
  {
    index: 7,
    name: 'V7 — Le S des chênes (sortie)',
    apexLat: 45.602,
    apexLon: -0.1432,
    svgX: 470,
    svgY: 175,
    pace: 'fast',
  },
  {
    index: 8,
    name: 'V8',
    apexLat: 45.6022,
    apexLon: -0.1438,
    svgX: 330,
    svgY: 200,
    pace: 'medium',
  },
  {
    index: 9,
    name: 'V9 — Épingle ouest',
    apexLat: 45.6021,
    apexLon: -0.144,
    svgX: 200,
    svgY: 235,
    pace: 'slow',
  },
  {
    index: 10,
    name: 'V10',
    apexLat: 45.6017,
    apexLon: -0.1438,
    svgX: 130,
    svgY: 300,
    pace: 'medium',
  },
  { index: 11, name: 'V11', apexLat: 45.6013, apexLon: -0.1432, svgX: 90, svgY: 360, pace: 'fast' },
  {
    index: 12,
    name: 'V12',
    apexLat: 45.6009,
    apexLon: -0.1425,
    svgX: 115,
    svgY: 415,
    pace: 'medium',
  },
  {
    index: 13,
    name: 'V13',
    apexLat: 45.60065,
    apexLon: -0.1418,
    svgX: 180,
    svgY: 455,
    pace: 'medium',
  },
  {
    index: 14,
    name: 'V14 — Ligne droite',
    apexLat: 45.6005,
    apexLon: -0.1412,
    svgX: 290,
    svgY: 445,
    pace: 'fast',
  },
] as const;

export function getCorner(index: number): CornerTopology | null {
  return BELTOISE_CORNERS.find((c) => c.index === index) ?? null;
}

export function nextCornerIndex(currentIndex: number): number {
  if (currentIndex >= BELTOISE_CORNERS.length) return 1;
  return currentIndex + 1;
}

export function previousCornerIndex(currentIndex: number): number {
  if (currentIndex <= 1) return BELTOISE_CORNERS.length;
  return currentIndex - 1;
}

/**
 * Marges par virage pour une session donnée. V1 = mock random reproductible
 * basé sur le sessionId (pour que la même session affiche les mêmes couleurs
 * d'ouverture en ouverture). Sem 7+ : vraie data depuis margin_breakdown.
 */
export function mockCornerMargins(sessionId: string): Record<number, MarginZone> {
  const margins: Record<number, MarginZone> = {};
  const seed = hashString(sessionId);
  for (let i = 1; i <= BELTOISE_CORNERS.length; i++) {
    const r = pseudoRandom(seed + i);
    if (r < 0.15) margins[i] = 'red';
    else if (r < 0.45) margins[i] = 'yellow';
    else margins[i] = 'green';
  }
  return margins;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
