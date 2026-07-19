/**
 * vizMath — logique pure des composants data-viz V2 (lot L0, livrable 7) :
 * géométrie du radar QDI, normalisation de sparkline biométrique, période de
 * pulsation cardiaque, projection centerline → chemin Skia, ratios de pilier.
 *
 * Zéro dépendance React Native : testé en node (vizMath.test.ts).
 *
 * Règle données réelles (fondateur) : rien n'est inventé ici — une valeur
 * absente reste absente (branche masquée, « — », chemin vide), jamais un
 * défaut plausible.
 *
 * Projection géographique : on RÉUTILISE `projectToMeters` du générateur de
 * circuits (équirectangulaire, même patron que src/utils/geo.ts), sans le
 * modifier — doctrine « reproduire, ne pas réinventer ».
 */

import { projectToMeters, type LatLon } from '@/circuit/circuitGenerator';

import { clamp } from './motion/motionMath';
import { colors, motion } from './tokens';

/** Point écran (px) ou métrique (m), x vers la droite, y vers le haut en métrique. */
export interface XY {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Radar QDI — pentagone 5 axes
// ---------------------------------------------------------------------------

/** Ordre canonique des 5 branches QDI (aligné sur colors.qdi et qdiLogic). */
export const QDI_BRANCHES = [
  'trajectoire',
  'fluidite',
  'freinage',
  'acceleration',
  'regularite',
] as const satisfies readonly (keyof typeof colors.qdi)[];

export type QdiBranch = (typeof QDI_BRANCHES)[number];

/** Libellés français par défaut (les écrans peuvent les remplacer). */
export const QDI_BRANCH_LABELS: Record<QdiBranch, string> = {
  trajectoire: 'Trajectoire',
  fluidite: 'Fluidité',
  freinage: 'Freinage',
  acceleration: 'Accélération',
  regularite: 'Régularité',
};

/** Échelle QDI : valeurs 0..100 (qdiLogic). */
export const QDI_MAX = 100;

/** Pas du séquencement des puces qui « claquent » (radar, tracé) — 80 ms. */
export const DOT_STAGGER_MS = 80;

/** Angle (rad) de la branche `index` : la première pointe vers le haut. */
export function radarAngle(index: number, count = QDI_BRANCHES.length): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, count);
}

/** Sommet à `value01` (0..1, borné) le long de la branche `index`. */
export function radarVertex(
  cx: number,
  cy: number,
  r: number,
  index: number,
  value01: number,
  count = QDI_BRANCHES.length
): XY {
  const a = radarAngle(index, count);
  const v = clamp(value01, 0, 1);
  return { x: cx + Math.cos(a) * r * v, y: cy + Math.sin(a) * r * v };
}

/** Anneau de grille : pentagone fermé à la fraction donnée (0..1). */
export function radarRingPath(
  cx: number,
  cy: number,
  r: number,
  fraction: number,
  count = QDI_BRANCHES.length
): string {
  const pts: XY[] = [];
  for (let i = 0; i < count; i++) pts.push(radarVertex(cx, cy, r, i, fraction, count));
  return pointsToSvgPath(pts, true);
}

export interface RadarAxisPx {
  branch: QdiBranch;
  /** Index canonique de la branche (0..4), même pour un radar partiel. */
  index: number;
  /** Extrémité de l'axe (valeur 1). */
  tip: XY;
}

export interface RadarPointPx {
  branch: QdiBranch;
  index: number;
  /** Valeur réelle, bornée 0..QDI_MAX. */
  value: number;
  point: XY;
}

export interface RadarLayout {
  cx: number;
  cy: number;
  r: number;
  /** Axes des branches MESURÉES uniquement — les branches nulles sont masquées. */
  axes: RadarAxisPx[];
  points: RadarPointPx[];
  /** '' si moins de 2 points ; ouvert si 2 ; fermé (Z) si 3 ou plus. */
  polygonPath: string;
  measuredCount: number;
}

/**
 * Géométrie complète du radar dans un carré `size` px. Une branche absente,
 * null ou non finie est MASQUÉE (ni axe, ni point, ni sommet de polygone) —
 * jamais tirée à zéro, jamais inventée.
 */
export function radarLayout(
  values: Partial<Record<QdiBranch, number>>,
  size: number,
  padding = 8
): RadarLayout {
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.max(0, size / 2 - padding);

  const axes: RadarAxisPx[] = [];
  const points: RadarPointPx[] = [];
  QDI_BRANCHES.forEach((branch, index) => {
    const raw = values[branch];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return; // masquée
    const value = clamp(raw, 0, QDI_MAX);
    axes.push({ branch, index, tip: radarVertex(cx, cy, r, index, 1) });
    points.push({ branch, index, value, point: radarVertex(cx, cy, r, index, value / QDI_MAX) });
  });

  const vertices = points.map((p) => p.point);
  const polygonPath = vertices.length >= 2 ? pointsToSvgPath(vertices, vertices.length >= 3) : '';

  return { cx, cy, r, axes, points, polygonPath, measuredCount: points.length };
}

// ---------------------------------------------------------------------------
// Sparkline biométrique (FC)
// ---------------------------------------------------------------------------

export interface BiometrySample {
  /** Horodatage (ms epoch ou ms relatifs — seul l'ordre compte). */
  ts: number;
  /** Fréquence cardiaque (bpm). */
  hr: number;
}

/** Filtre les échantillons invalides (non finis, bpm <= 0) et trie par ts. */
export function cleanSamples(samples: readonly BiometrySample[]): BiometrySample[] {
  return samples
    .filter((s) => Number.isFinite(s.ts) && Number.isFinite(s.hr) && s.hr > 0)
    .sort((a, b) => a.ts - b.ts);
}

/**
 * Projette les échantillons dans un cadre width×height (px écran, y vers le
 * bas) : x proportionnel au temps, y inversé (bpm haut = point haut). Série
 * plate ou point unique → centré sur l'axe concerné.
 */
export function normalizeSparkline(
  samples: readonly BiometrySample[],
  width: number,
  height: number,
  pad = 3
): XY[] {
  const clean = cleanSamples(samples);
  if (clean.length === 0 || width <= 0 || height <= 0) return [];

  const t0 = clean[0].ts;
  const t1 = clean[clean.length - 1].ts;
  let minHr = Infinity;
  let maxHr = -Infinity;
  for (const s of clean) {
    if (s.hr < minHr) minHr = s.hr;
    if (s.hr > maxHr) maxHr = s.hr;
  }

  const spanX = Math.max(0, width - 2 * pad);
  const spanY = Math.max(0, height - 2 * pad);
  return clean.map((s) => ({
    x: t1 === t0 ? width / 2 : pad + ((s.ts - t0) / (t1 - t0)) * spanX,
    y: maxHr === minHr ? height / 2 : pad + ((maxHr - s.hr) / (maxHr - minHr)) * spanY,
  }));
}

/** Chemin SVG ouvert de la sparkline ('' si moins de 2 points). */
export function sparklinePath(points: readonly XY[]): string {
  return pointsToSvgPath(points, false);
}

/** Moyenne des bpm valides, null si aucun échantillon exploitable. */
export function meanBpm(samples: readonly BiometrySample[]): number | null {
  const clean = cleanSamples(samples);
  if (clean.length === 0) return null;
  let sum = 0;
  for (const s of clean) sum += s.hr;
  return sum / clean.length;
}

export const PULSE_PERIOD_MIN_MS = 250;
export const PULSE_PERIOD_MAX_MS = 2000;

/**
 * Période de pulsation du dernier point (ms) : 60/bpm s, bornée à des valeurs
 * animables. bpm inconnu → cadence neutre `motion.pulse` (pas une donnée).
 */
export function pulsePeriodMs(bpm: number | null): number {
  if (bpm === null || !Number.isFinite(bpm) || bpm <= 0) return motion.pulse;
  return clamp(60000 / bpm, PULSE_PERIOD_MIN_MS, PULSE_PERIOD_MAX_MS);
}

// ---------------------------------------------------------------------------
// Tracé circuit — projection centerline → chemin Skia
// ---------------------------------------------------------------------------

/**
 * Ajuste des points métriques (y vers le nord) dans un cadre écran
 * width×height (y vers le bas) : centrage + échelle uniforme (aspect
 * préservé), nord en haut. Points confondus → tous au centre.
 */
export function fitPointsToBox(
  points: readonly XY[],
  width: number,
  height: number,
  padding = 8
): XY[] {
  const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of clean) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanW = Math.max(0, width - 2 * padding);
  const spanH = Math.max(0, height - 2 * padding);
  const bw = maxX - minX;
  const bh = maxY - minY;
  const scaleX = bw > 0 ? spanW / bw : Infinity;
  const scaleY = bh > 0 ? spanH / bh : Infinity;
  let scale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(scale)) scale = 0;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return clean.map((p) => ({
    x: width / 2 + (p.x - cx) * scale,
    y: height / 2 - (p.y - cy) * scale,
  }));
}

/** Chemin SVG 'M … L …' (+ ' Z' si fermé). '' si moins de 2 points. */
export function pointsToSvgPath(points: readonly XY[], closed = true): string {
  if (points.length < 2) return '';
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i++) d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  return closed ? `${d} Z` : d;
}

export interface TraceGeometry {
  /** Chemin Skia/SVG, '' si la centerline est inexploitable. */
  path: string;
  /** Points écran correspondants (pour placer les puces d'événements). */
  points: XY[];
}

/**
 * Centerline (lat/lon en base, ou déjà métrique {x,y}) → chemin écran.
 * Lat/lon passent par `projectToMeters` (circuitGenerator, réutilisé tel
 * quel). Moins de 2 points exploitables → géométrie vide, jamais un tracé
 * inventé.
 */
export function centerlineToTrace(
  centerline: readonly LatLon[] | readonly XY[],
  width: number,
  height: number,
  padding = 8,
  closed = true
): TraceGeometry {
  if (width <= 0 || height <= 0 || centerline.length < 2) return { path: '', points: [] };

  const first = centerline[0];
  const metric: XY[] =
    'lat' in first
      ? projectToMeters([...(centerline as readonly LatLon[])])
      : [...(centerline as readonly XY[])];

  const fitted = fitPointsToBox(metric, width, height, padding);
  if (fitted.length < 2) return { path: '', points: [] };
  return { path: pointsToSvgPath(fitted, closed), points: fitted };
}

/** Longueur de la polyligne (px), segment de fermeture inclus si `closed`. */
export function traceLength(points: readonly XY[], closed = true): number {
  if (points.length < 2) return 0;
  let total = 0;
  const segs = closed ? points.length : points.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Point à l'abscisse curviligne t (0..1, borné) le long de la polyligne.
 * Liste vide → null (rien à placer, rien d'inventé).
 */
export function pointAtRatio(points: readonly XY[], t: number, closed = true): XY | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { ...points[0] };

  const total = traceLength(points, closed);
  if (total <= 0) return { ...points[0] };

  const target = clamp(t, 0, 1) * total;
  let acc = 0;
  const segs = closed ? points.length : points.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > 0 && acc + len >= target) {
      const u = (target - acc) / len;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    acc += len;
  }
  return { ...points[closed ? 0 : points.length - 1] };
}

// ---------------------------------------------------------------------------
// Barres de pilier
// ---------------------------------------------------------------------------

/** Taux de remplissage 0..1. Valeur absente ou échelle invalide → 0. */
export function pillarRatio(value: number | null | undefined, max = QDI_MAX): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (!Number.isFinite(max) || max <= 0) return 0;
  return clamp(value / max, 0, 1);
}

/** Valeur affichée : entier arrondi (+ unité), « — » si absente — JAMAIS inventée. */
export function formatPillarValue(value: number | null | undefined, unit?: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
}
