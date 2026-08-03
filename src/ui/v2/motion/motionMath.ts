/**
 * motionMath — logique pure du langage de motion V2 (lot L0, Livrable 5).
 *
 * Tout ce qui se calcule sans React ni react-native vit ici : angles
 * d'aiguille, découpage des digits d'un chrono, délais de cascade,
 * interpolation du header condensé, géométrie du HeroMorph.
 * Testé sous ts-jest/node (src/ui/v2/__tests__/motionMath.test.ts).
 *
 * Les fonctions appelées depuis l'UI thread portent la directive 'worklet'
 * (inoffensive sous node, indispensable dans les useAnimatedStyle).
 *
 * ---------------------------------------------------------------------------
 * RÈGLE ABSOLUE — AUCUNE VALEUR PAR DÉFAUT NE LIT UNE CONSTANTE DE MODULE
 * ---------------------------------------------------------------------------
 *
 * Dans un worklet, ceci fait planter l'application :
 *
 *     export function pullAngle(d, t, sweep = PULL_SWEEP_DEG) { 'worklet'; … }
 *
 * et ceci fonctionne :
 *
 *     export function pullAngle(d, t, sweep) { 'worklet';
 *       const course = sweep ?? PULL_SWEEP_DEG; … }
 *
 * POURQUOI. Le greffon `react-native-worklets` capture bien la constante, mais
 * il ouvre la fermeture EN TÊTE DU CORPS. Sortie réelle du compilateur, relevée
 * le 03/08/2026 :
 *
 *     function pullAngle(d, t, sweep = PULL_SWEEP_DEG) {
 *       const { PULL_SWEEP_DEG } = this.__closure;   // ← trop tard
 *       …
 *     }
 *
 * Une valeur par défaut s'évalue AVANT le corps, dans la portée des paramètres.
 * Sur le runtime UI il n'y a pas de portée de module : le nom n'existe nulle
 * part. Hermes lève `ReferenceError`, l'erreur remonte en exception C++ que
 * personne n'attrape, et le processus meurt sur `abort()`.
 *
 * CE QUE ÇA A COÛTÉ. Le build 36 (03/08/2026) s'installait et se fermait au
 * bout de ~600 ms, sans écran rouge — en release il n'y en a pas. Quatre échecs
 * de build avaient précédé, tous pour d'autres raisons ; celui-ci ne se voyait
 * qu'à l'exécution, sur un appareil.
 *
 * LA GARDE. `src/ui/v2/__tests__/gardeWorkletsDefauts.test.ts` compile chaque
 * fichier avec le vrai greffon et refuse tout défaut qui lit la fermeture. Elle
 * a été vérifiée en réintroduisant la faute : elle échoue.
 */

import { motion } from '../tokens';

/** Borne une valeur dans [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** Interpolation linéaire de `from` vers `to` (t non borné volontairement). */
export function lerp(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

// ---------------------------------------------------------------------------
// Stagger
// ---------------------------------------------------------------------------

/** Plafond du délai de cascade : au-delà, tout entre ensemble. */
export const STAGGER_MAX_DELAY_MS = 450;

/**
 * Délai d'entrée du n-ième enfant d'une cascade V2 (ms, jamais négatif).
 * Pas de cascade infinie sur les longues listes : plafonné à `maxDelay`.
 *
 * Les défauts sont résolus DANS LE CORPS, jamais dans la signature —
 * voir l'avertissement en tête de fichier. Ce n'est pas un goût de style :
 * `step: number = motion.stagger` faisait planter l'application au lancement.
 */
export function staggerDelayV2(
  index: number,
  step?: number,
  initialDelay = 0,
  maxDelay?: number
): number {
  'worklet';
  const pas = step ?? motion.stagger;
  const plafond = maxDelay ?? STAGGER_MAX_DELAY_MS;
  const safeIndex = Math.max(0, Math.floor(index));
  const raw = Math.max(0, initialDelay) + safeIndex * Math.max(0, pas);
  return Math.min(raw, Math.max(0, plafond));
}

// ---------------------------------------------------------------------------
// RollingCounter — digits d'odomètre
// ---------------------------------------------------------------------------

/** Une case du compteur : un digit qui roule, ou un séparateur statique. */
export interface DigitCell {
  /** Le caractère d'origine ('4', ':', '.'). */
  char: string;
  /** 0-9 pour un chiffre, null pour un séparateur. */
  digit: number | null;
  /** Vrai si la case est en couleur accent (millièmes). */
  accent: boolean;
}

/**
 * Découpe une valeur affichée ('1:41.203') en cases de compteur.
 * `accentMillis` marque en accent les CHIFFRES qui suivent le DERNIER
 * point — les millièmes d'un chrono. Les séparateurs et une éventuelle
 * unité ('45.123 s') restent en base : l'accent ne déborde jamais.
 */
export function digitsOf(value: string, accentMillis = false): DigitCell[] {
  const lastDot = value.lastIndexOf('.');
  const cells: DigitCell[] = [];
  for (let i = 0; i < value.length; i++) {
    const char = value.charAt(i);
    const code = char.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    cells.push({
      char,
      digit: isDigit ? code - 48 : null,
      accent: accentMillis && lastDot >= 0 && i > lastDot && isDigit,
    });
  }
  return cells;
}

/**
 * Cases qui changent entre deux valeurs affichées, alignées sur `next`.
 * Longueurs différentes → tout est considéré changé (re-rendu complet,
 * pas de morphing hasardeux entre '59.9' et '1:00.0').
 */
export function diffDigits(prev: string, next: string): boolean[] {
  if (prev === next) return new Array<boolean>(next.length).fill(false);
  if (prev.length !== next.length) return new Array<boolean>(next.length).fill(true);
  const out: boolean[] = [];
  for (let i = 0; i < next.length; i++) {
    out.push(prev.charAt(i) !== next.charAt(i));
  }
  return out;
}

/**
 * Décalage vertical (px) de la bande 0-9 pour montrer `digit`
 * dans une fenêtre de hauteur `cellHeight`. Digit borné à [0, 9].
 */
export function digitStripOffset(digit: number, cellHeight: number): number {
  'worklet';
  const d = clamp(Math.round(digit), 0, 9);
  return d === 0 ? 0 : -d * cellHeight;
}

// ---------------------------------------------------------------------------
// Aiguilles — NeedleSweep, Dial, PullToRefreshDial
// ---------------------------------------------------------------------------

/**
 * Angle d'aiguille (degrés) pour une valeur dans [min, max], mappée
 * linéairement sur [angleMin, angleMax] et bornée. Plage dégénérée
 * (max <= min) → angleMin, jamais de NaN.
 */
export function needleAngle(
  value: number,
  min: number,
  max: number,
  angleMin = -135,
  angleMax = 135
): number {
  'worklet';
  if (max <= min) return angleMin;
  const t = clamp((value - min) / (max - min), 0, 1);
  return lerp(angleMin, angleMax, t);
}

/** Course de l'aiguille du pull-to-refresh au seuil de déclenchement. */
export const PULL_SWEEP_DEG = 270;

/**
 * Angle de l'aiguille pendant le tirage : proportionnel à la distance
 * jusqu'au seuil (0 → PULL_SWEEP_DEG), puis une sur-course amortie
 * plafonnée à +30° — l'aiguille « résiste » en butée.
 */
export function pullAngle(distance: number, threshold: number, sweep?: number): number {
  'worklet';
  // Défaut résolu ici, et non dans la signature : c'est cette ligne, écrite
  // `sweep: number = PULL_SWEEP_DEG`, qui a tué le build 36 au lancement.
  // Voir l'avertissement en tête de fichier.
  const course = sweep ?? PULL_SWEEP_DEG;
  if (threshold <= 0) return 0;
  const d = Math.max(0, distance);
  const base = course * Math.min(d / threshold, 1);
  const over = d > threshold ? Math.min(30, ((d - threshold) / threshold) * course * 0.12) : 0;
  return base + over;
}

/**
 * Translation du contenu pendant le tirage : suit le doigt au départ
 * (dérivée 1 en 0) puis résiste, asymptote à 1.5 × threshold.
 */
export function dampedPull(distance: number, threshold: number): number {
  'worklet';
  if (threshold <= 0) return 0;
  const d = Math.max(0, distance);
  const limit = threshold * 1.5;
  return limit * (1 - Math.exp(-d / limit));
}

// ---------------------------------------------------------------------------
// useCondensingHeader
// ---------------------------------------------------------------------------

/**
 * Progression 0 → 1 de la condensation du header (patron Airbnb) :
 * 0 jusqu'à `threshold - band`, 1 à partir de `threshold` (défaut : condensé
 * au-delà de 64 px de scroll), linéaire entre les deux.
 */
export function condensedProgress(scrollY: number, threshold = 64, band = 24): number {
  'worklet';
  const safeBand = Math.max(1, band);
  return clamp((scrollY - (threshold - safeBand)) / safeBand, 0, 1);
}

// ---------------------------------------------------------------------------
// RecordFlash
// ---------------------------------------------------------------------------

/** Durée totale de la célébration record. */
export const RECORD_FLASH_MS = 900;

/**
 * Les 4 phases du double pulse blanc→or→blanc→or→blanc,
 * en durées égales dont la somme vaut `total`.
 */
export function recordPulsePhases(
  total: number = RECORD_FLASH_MS
): [number, number, number, number] {
  const quarter = Math.max(1, total) / 4;
  return [quarter, quarter, quarter, quarter];
}

// ---------------------------------------------------------------------------
// HeroMorph — géométrie carte → écran
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MorphTransform {
  /** Translation du centre cible vers le centre source (px). */
  dx: number;
  dy: number;
  /** Échelles cible → source (transform-origin : centre). */
  sx: number;
  sy: number;
}

/**
 * Transformée initiale de l'écran cible pour qu'il occupe exactement la
 * géométrie de la carte source (le morph anime ensuite vers l'identité).
 * Rect dégénéré → identité (fallback door, jamais de division par zéro).
 */
export function morphFromRects(source: Rect, target: Rect): MorphTransform {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
    return { dx: 0, dy: 0, sx: 1, sy: 1 };
  }
  return {
    dx: source.x + source.width / 2 - (target.x + target.width / 2),
    dy: source.y + source.height / 2 - (target.y + target.height / 2),
    sx: source.width / target.width,
    sy: source.height / target.height,
  };
}
