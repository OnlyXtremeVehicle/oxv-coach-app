/**
 * uiLogic — logique pure du noyau de composants V2 (Livrable 7).
 *
 * Tout ce qui se teste sans rendu vit ici : mapping des tailles du
 * ChronoHero, formes de squelette du StateView, conversion ms → label
 * chrono (via formatLapTimeMs, la référence du repo — règle « données
 * réelles câblées » : la conversion est verrouillée par test), et le
 * tracé de circuit de l'illustration d'état vide (polyligne fermée,
 * longueur calculée — jamais estimée à la main).
 */

import { tailleChiffreRoi } from '@/theme/metriques';

import { formatLapTimeMs } from '@/utils/format';

import { radius } from './tokens';

// ---------------------------------------------------------------------------
// Chrono — millisecondes → label « M:SS.mmm »
// ---------------------------------------------------------------------------

/**
 * Convertit un chrono en MILLISECONDES vers le label canon des maquettes
 * (« 1:24.318 »). formatLapTimeMs attend des secondes : la division par
 * 1000 est faite ici, une seule fois, et vérifiée par test.
 */
export function msToLapLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return formatLapTimeMs(ms / 1000);
}

// ---------------------------------------------------------------------------
// ChronoHero — tailles
// ---------------------------------------------------------------------------

export type ChronoHeroSize = 's' | 'm' | 'l';

export const CHRONO_HERO_SIZES: readonly ChronoHeroSize[] = ['s', 'm', 'l'];

export const CHRONO_HERO_FONT_SIZES: Record<ChronoHeroSize, number> = {
  s: 22,
  m: 34,
  l: 56,
};

/**
 * Taille du chrono héros — SOUHAITÉE, puis plafonnée et repliée.
 *
 * ---
 *
 * CE QUI DÉBORDAIT, ET QUE PERSONNE NE VOYAIT
 *
 * Cette fonction rendait la valeur de la table, sans regarder ni la longueur du
 * chrono ni la largeur offerte. `RollingCounter` rend une rangée de cellules à
 * largeur intrinsèque : ni `flexShrink` (0 par défaut en React Native), ni
 * `numberOfLines`, ni `adjustsFontSizeToFit`.
 *
 * Sur iPhone SE, `1:41,203` — huit glyphes, virgule comprise — occupe
 * 8 × 0,6 × 56 = **268,8 pt**. Le budget réel du héros n'est pas la largeur
 * utile : il faut en retirer le remplissage du bloc et celui du cadre. Le
 * dernier millième passait donc sous l'`overflow: 'hidden'` du héros, coupé
 * sans qu'aucune erreur ne se lève.
 *
 * Le plafond et le repli existaient déjà — `src/theme/metriques.ts`, posés au
 * jalon 2 — mais branchés sur `KingNumber`, cinq appels surtout côté coach.
 * **Le chiffre que le pilote lit vraiment n'en bénéficiait pas.**
 *
 * `valeur` et `largeurDisponible` sont facultatifs : sans eux, on rend la
 * valeur de la table, comme avant. Les appelants qui connaissent leur largeur
 * la passent — c'est `ChronoHero` qui s'en charge.
 */
export function chronoHeroFontSize(
  size: ChronoHeroSize,
  valeur?: string,
  largeurDisponible?: number | null
): number {
  const souhaitee = CHRONO_HERO_FONT_SIZES[size];
  if (valeur == null) return souhaitee;
  return tailleChiffreRoi(valeur, souhaitee, largeurDisponible);
}

// ---------------------------------------------------------------------------
// StateView — formes de squelette (Shimmer)
// ---------------------------------------------------------------------------

export type StateShape = 'hero' | 'list' | 'radar' | 'card';

export const STATE_SHAPES: readonly StateShape[] = ['hero', 'list', 'radar', 'card'];

export type SkeletonWidth = number | `${number}%`;

export interface SkeletonBlock {
  height: number;
  width: SkeletonWidth;
  radius: number;
}

const LIST_ROW_COUNT = 5;

/**
 * Blocs de squelette par section : le loading reprend la FORME réelle du
 * contenu attendu (hero photo, rangées de liste, disque radar, carte),
 * jamais un spinner.
 */
export function skeletonBlocksFor(shape: StateShape): readonly SkeletonBlock[] {
  switch (shape) {
    case 'hero':
      return [
        { height: 220, width: '100%', radius: radius.hero },
        { height: 18, width: '58%', radius: radius.cell },
        { height: 14, width: '36%', radius: radius.cell },
      ];
    case 'list':
      return Array.from({ length: LIST_ROW_COUNT }, () => ({
        height: 56,
        width: '100%' as const,
        radius: radius.cell,
      }));
    case 'radar':
      return [
        // Disque : rayon = moitié de la hauteur.
        { height: 240, width: 240, radius: 120 },
        { height: 14, width: '52%', radius: radius.cell },
      ];
    case 'card':
      return [
        { height: 120, width: '100%', radius: radius.card },
        { height: 14, width: '64%', radius: radius.cell },
      ];
  }
}

// ---------------------------------------------------------------------------
// État vide — tracé de circuit (illustration SVG maison)
// ---------------------------------------------------------------------------

export type Point = readonly [number, number];

/** Chemin SVG d'une polyligne (M/L, Z si fermée). */
export function polylinePath(points: readonly Point[], closed = true): string {
  if (points.length === 0) return '';
  const [head, ...rest] = points;
  const parts = [`M${head[0]} ${head[1]}`, ...rest.map(([x, y]) => `L${x} ${y}`)];
  if (closed && points.length > 1) parts.push('Z');
  return parts.join(' ');
}

/** Longueur d'une polyligne (segment de fermeture compris si fermée). */
export function polylineLength(points: readonly Point[], closed = true): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  if (closed) {
    const first = points[0];
    const last = points[points.length - 1];
    total += Math.hypot(first[0] - last[0], first[1] - last[1]);
  }
  return total;
}

/** Durée d'un tour de dessin de l'illustration vide (boucle lente). */
export const EMPTY_LOOP_MS = 8000;

export const EMPTY_CIRCUIT_VIEWBOX = '0 0 208 116';

/**
 * Boucle stylisée de circuit (ligne droite basse, courbe droite, chicane,
 * retour par le haut) — dessinée à la main sur la grille du viewBox.
 */
export const EMPTY_CIRCUIT_POINTS: readonly Point[] = [
  [26, 104],
  [148, 104],
  [172, 98],
  [188, 84],
  [190, 66],
  [182, 50],
  [164, 44],
  [140, 46],
  [122, 40],
  [116, 26],
  [122, 14],
  [140, 10],
  [70, 10],
  [46, 14],
  [28, 26],
  [20, 44],
  [18, 66],
  [20, 86],
];

export const EMPTY_CIRCUIT_PATH = polylinePath(EMPTY_CIRCUIT_POINTS);

/** Longueur réelle du tracé — sert au strokeDasharray, jamais estimée. */
export const EMPTY_CIRCUIT_LENGTH = polylineLength(EMPTY_CIRCUIT_POINTS);
