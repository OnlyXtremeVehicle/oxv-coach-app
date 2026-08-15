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

import { polylineLength, polylineToPathD, type Point2D } from '@/components/motion/pathMath';
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

/**
 * CINQ IMPLÉMENTATIONS D'UNE MÊME CHOSE — RAMENÉES À UNE, LE 15/08/2026.
 *
 * Le dépôt portait cinq façons de transformer une polyligne en chaîne `d` :
 * ici, dans `components/motion/pathMath`, dans `lib/geoToSvg`, en local dans
 * l'écran de séance, et en ligne dans `DebriefMirror`. Elles ne rendaient pas
 * la même chose :
 *
 *   pathMath  `M 1.00 2.00`  · arrondi paramétrable · ne ferme PAS par défaut
 *   geoToSvg  `M 1.00,2.00`  · arrondi fixe         · ne ferme jamais
 *   ici       `M1 2`         · aucun arrondi        · **ferme par défaut**
 *   écran     `M 1 2`        · aucun arrondi        · '' sous deux points
 *
 * Le vrai piège n'était pas la mise en forme — SVG traite l'espace et la
 * virgule à l'identique — mais `polylineLength`, qui existait ici avec
 * `closed = true` et là-bas avec `close = false`. **Deux fonctions de même nom
 * aux valeurs par défaut opposées** : changer un import déplaçait la longueur
 * d'un segment entier, en silence, et cette longueur pilote le
 * `strokeDasharray` de toutes les animations de tracé.
 *
 * Les deux relais d'ici ont été SUPPRIMÉS, pas délégués : `EMPTY_CIRCUIT_PATH`
 * et `EMPTY_CIRCUIT_LENGTH` appellent `pathMath` directement, en passant la
 * fermeture EXPLICITEMENT. Un relais aurait gardé deux noms pour une fonction,
 * et masqué l'appel réel au recensement des entrées optionnelles — qui compte
 * par NOM d'appelé et ne suit pas les alias d'import.
 *
 * `geoToSvg` garde la sienne, et c'est délibéré : elle écrit dans la BASE
 * (`user_circuits.svg_path`), pas à l'écran. Une chaîne persistée ne change pas
 * de forme sans raison.
 */
const versXY = (points: readonly Point[]): Point2D[] => points.map(([x, y]) => ({ x, y }));

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

// `decimals: 0` — ces points sont des entiers de grille dessinés à la main ;
// `close: true` — le motif est une boucle, et la fermeture se dit EXPLICITEMENT
// plutôt que de dépendre d'une valeur par défaut (c'est ce qui divergeait).
export const EMPTY_CIRCUIT_PATH = polylineToPathD(versXY(EMPTY_CIRCUIT_POINTS), 0, true);

/** Longueur réelle du tracé — sert au strokeDasharray, jamais estimée. */
export const EMPTY_CIRCUIT_LENGTH = polylineLength(versXY(EMPTY_CIRCUIT_POINTS), true);
