/**
 * QDI 5 branches — moteur de calcul DÉTERMINISTE (Lot M1).
 *
 * Décision fondateur 2026-07-04 (spec roadmap/specs/QDI_CARTOGRAPHIE_M1.md) :
 * Trajectoire · Fluidité · Freinage · Accélération · Régularité, valeurs 0-100,
 * self-only (la référence de comparaison est l'HISTORIQUE du pilote, jamais un
 * autre pilote). `QDI_ALGO_VERSION` estampille chaque calcul : toute évolution
 * de formule est un changement tracé, pas un glissement silencieux.
 *
 * HONNÊTETÉ CAPTEURS (proxy assumé, bloc méthode obligatoire à l'affichage) :
 * le boîtier fournit GPS + centrale inertielle à 25 Hz — ni volant, ni pédales.
 * Fluidité/Freinage/Accélération sont calculées depuis les accélérations SUBIES
 * (conséquences), pas depuis les gestes. Une branche sans données suffisantes
 * vaut null (jamais de fausse valeur).
 *
 * Pur, sans réseau — testé dans __tests__/qdiLogic.test.ts.
 */

import { haversineDistance } from '@/utils/geo';

export const QDI_ALGO_VERSION = 'qdi-1.0.0';

export interface QdiFrame {
  elapsedMs: number;
  lat: number | null;
  lon: number | null;
  /** g latéral (positif = droite). */
  gLat: number | null;
  /** g longitudinal (positif = accélération, négatif = freinage). */
  gLong: number | null;
}

/** Fenêtre d'un tour valide, en ms depuis le début de la session. */
export interface QdiLapWindow {
  startMs: number;
  endMs: number;
  durationSeconds: number;
}

export interface QdiBranches {
  trajectoire: number | null;
  fluidite: number | null;
  freinage: number | null;
  acceleration: number | null;
  regularite: number | null;
}

export interface QdiResult extends QdiBranches {
  algoVersion: string;
  lapCount: number;
  frameCount: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Mappe une métrique « plus petit = mieux » sur 0-100 entre best et worst. */
const scoreDown = (value: number, best: number, worst: number) =>
  Math.round(100 * (1 - clamp01((value - best) / (worst - best))));

// ---------------------------------------------------------------------------
// Régularité — écart-type relatif des tours (définition fondateur : écart-type
// entre les tours, stabilité sur la durée). CV 0 % → 100 ; CV ≥ 6 % → 0.
// ---------------------------------------------------------------------------
export function computeRegularite(lapSeconds: number[]): number | null {
  const laps = lapSeconds.filter((s) => Number.isFinite(s) && s > 0);
  if (laps.length < 3) return null;
  const mean = laps.reduce((a, b) => a + b, 0) / laps.length;
  const variance = laps.reduce((a, b) => a + (b - mean) ** 2, 0) / laps.length;
  const cv = Math.sqrt(variance) / mean;
  return scoreDown(cv, 0, 0.06);
}

// ---------------------------------------------------------------------------
// Fluidité — douceur des transitions latérales : moyenne des |ΔG_lat| entre
// trames consécutives (proxy des corrections de volant). 0.01 g/trame → 100 ;
// 0.08 g/trame → 0.
// ---------------------------------------------------------------------------
export function computeFluidite(frames: QdiFrame[]): number | null {
  const g = frames.map((f) => f.gLat).filter((v): v is number => v !== null && Number.isFinite(v));
  if (g.length < 50) return null;
  let sum = 0;
  for (let i = 1; i < g.length; i++) sum += Math.abs(g[i] - g[i - 1]);
  const meanJerk = sum / (g.length - 1);
  return scoreDown(meanJerk, 0.01, 0.08);
}

// ---------------------------------------------------------------------------
// Phases longitudinales — freinage (G_long ≤ seuil négatif) et accélération
// (G_long ≥ seuil positif). Une phase = au moins 4 trames consécutives. Le
// score mesure la PROGRESSIVITÉ : écart-type des ΔG_long à l'intérieur des
// phases (modulation douce → faible), moyenné sur les phases.
// ---------------------------------------------------------------------------
function phaseSmoothness(frames: QdiFrame[], inPhase: (gLong: number) => boolean): number | null {
  const phases: number[][] = [];
  let current: number[] = [];
  for (const f of frames) {
    if (f.gLong !== null && Number.isFinite(f.gLong) && inPhase(f.gLong)) {
      current.push(f.gLong);
    } else if (current.length > 0) {
      if (current.length >= 4) phases.push(current);
      current = [];
    }
  }
  if (current.length >= 4) phases.push(current);
  if (phases.length < 3) return null;

  const perPhase = phases.map((p) => {
    const deltas: number[] = [];
    for (let i = 1; i < p.length; i++) deltas.push(p[i] - p[i - 1]);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
    return Math.sqrt(variance);
  });
  return perPhase.reduce((a, b) => a + b, 0) / perPhase.length;
}

/** Freinage — progressivité et modulation des phases de décélération. */
export function computeFreinage(frames: QdiFrame[]): number | null {
  const s = phaseSmoothness(frames, (g) => g <= -0.25);
  return s === null ? null : scoreDown(s, 0.02, 0.12);
}

/** Accélération — progressivité de la remise des gaz en sortie. */
export function computeAcceleration(frames: QdiFrame[]): number | null {
  const s = phaseSmoothness(frames, (g) => g >= 0.15);
  return s === null ? null : scoreDown(s, 0.02, 0.12);
}

// ---------------------------------------------------------------------------
// Trajectoire — répétabilité des lignes : chaque tour est échantillonné en K
// points à fractions égales de sa distance parcourue ; la dispersion moyenne
// (mètres) entre tours au même point mesure la précision des lignes.
// ≤ 0.5 m → 100 ; ≥ 5 m → 0.
// ---------------------------------------------------------------------------
const TRAJ_SAMPLES = 40;

function sampleLapPath(frames: QdiFrame[]): { lat: number; lon: number }[] | null {
  const pts = frames.filter(
    (f) => f.lat !== null && f.lon !== null && Number.isFinite(f.lat) && Number.isFinite(f.lon)
  ) as {
    lat: number;
    lon: number;
  }[];
  if (pts.length < TRAJ_SAMPLES) return null;
  // Distances cumulées le long du tour
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(
      cum[i - 1] + haversineDistance(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon)
    );
  }
  const total = cum[cum.length - 1];
  if (!Number.isFinite(total) || total < 100) return null; // tour improbable (< 100 m) ou NaN
  const out: { lat: number; lon: number }[] = [];
  let j = 0;
  for (let k = 0; k < TRAJ_SAMPLES; k++) {
    const target = (k / TRAJ_SAMPLES) * total;
    while (j < cum.length - 1 && cum[j] < target) j++;
    out.push(pts[j]);
  }
  return out;
}

export function computeTrajectoire(frames: QdiFrame[], laps: QdiLapWindow[]): number | null {
  const paths = laps
    .map((lap) =>
      sampleLapPath(frames.filter((f) => f.elapsedMs >= lap.startMs && f.elapsedMs <= lap.endMs))
    )
    .filter((p): p is { lat: number; lon: number }[] => p !== null);
  if (paths.length < 2) return null;

  let sum = 0;
  let n = 0;
  for (let k = 0; k < TRAJ_SAMPLES; k++) {
    // Dispersion au point k = distance moyenne de chaque tour au barycentre
    const lat0 = paths.reduce((a, p) => a + p[k].lat, 0) / paths.length;
    const lon0 = paths.reduce((a, p) => a + p[k].lon, 0) / paths.length;
    for (const p of paths) {
      sum += haversineDistance(lat0, lon0, p[k].lat, p[k].lon);
      n++;
    }
  }
  const meanDeviation = sum / n;
  return scoreDown(meanDeviation, 0.5, 5);
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------
export function computeQdi(frames: QdiFrame[], laps: QdiLapWindow[]): QdiResult {
  return {
    trajectoire: computeTrajectoire(frames, laps),
    fluidite: computeFluidite(frames),
    freinage: computeFreinage(frames),
    acceleration: computeAcceleration(frames),
    regularite: computeRegularite(laps.map((l) => l.durationSeconds)),
    algoVersion: QDI_ALGO_VERSION,
    lapCount: laps.length,
    frameCount: frames.length,
  };
}

/** Médiane par branche sur un historique (référence self-only du radar). */
export function medianBranches(history: QdiBranches[]): QdiBranches {
  const median = (key: keyof QdiBranches): number | null => {
    const vals = history
      .map((h) => h[key])
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b);
    if (vals.length === 0) return null;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 === 1 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
  };
  return {
    trajectoire: median('trajectoire'),
    fluidite: median('fluidite'),
    freinage: median('freinage'),
    acceleration: median('acceleration'),
    regularite: median('regularite'),
  };
}
