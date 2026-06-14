/**
 * Moteur d'insights `mirror-insights-v1` — version app-side, alignée 7 virages.
 *
 * Transforme l'analyse RÉELLE déjà calculée (segments par virage + tours +
 * comptage de trames) en blocs du contrat `session_insights`. PUR (sans React
 * Native ni Supabase, ni Deno) → réutilisable côté edge function ET testable.
 *
 * Doctrine + règle d'or « simple, conforme, pas spéculatif » :
 *  - L'app raisonne en 7 virages (générateur de courbure + démo). Le moteur
 *    SERVEUR de référence numérote 13 virages (minima vitesse) — leur
 *    réconciliation est un calibrage post-Valence (données réelles requises).
 *    Ici on produit donc des insights pour les 7 virages que le tracé rend.
 *  - On ne calcule QUE ce qui dérive proprement de l'analyse réelle :
 *    `anatomy` (vitesse d'apex, G latéral, distances frein/accel estimées) et
 *    `data_quality` ; `ideal_lap` est minimal et honnête (meilleur tour réel,
 *    sans gain théorique inventé). `dispersion`, `chassis_balance`,
 *    `load_transfer` exigent du multi-tours / de la modélisation gyro calée sur
 *    de vraies données → laissés VIDES (le tracé affiche un état vide honnête).
 */

import type { AnatomyCorner, CornerRecord, DataQuality, IdealLap } from '@/circuit/sessionInsights';

export const INSIGHTS_ENGINE_VERSION = 'mirror-insights-v1';

const G = 9.81;

/** Segment d'analyse réduit aux champs nécessaires (1 segment = 1 virage). */
export interface InsightSegmentInput {
  cornerIndex: number;
  apexSpeedKmh: number | null;
  entrySpeedKmh: number;
  minSpeedKmh: number;
  exitSpeedKmh: number;
  maxGLateral: number;
  maxGBraking: number;
  maxGAccel: number;
  marginPercent: number;
}

export interface InsightLapInput {
  lapNumber: number;
  durationSeconds: number;
  isOutlap?: boolean | null;
  isInlap?: boolean | null;
}

export interface InsightsEngineInput {
  segments: InsightSegmentInput[];
  laps: InsightLapInput[];
  /** Nombre total de trames écrites pour la session. */
  frameCount: number;
  /** Trames avec un fix GPS valide (pour la fiabilité). Défaut = frameCount. */
  validFrameCount?: number;
}

/** Blocs calculés du contrat session_insights (les ids + computed_at sont ajoutés par l'appelant). */
export interface InsightsBlocks {
  engine_version: string;
  n_laps: number;
  n_frames: number;
  anatomy: AnatomyCorner[];
  dispersion: CornerRecord | null;
  chassis_balance: CornerRecord | null;
  load_transfer: CornerRecord | null;
  ideal_lap: IdealLap | null;
  data_quality: DataQuality;
}

/** Distance de décélération (m) entre deux vitesses (km/h) sous |g| longitudinal. */
function distanceBetweenSpeeds(vFromKmh: number, vToKmh: number, gAbs: number): number {
  if (gAbs <= 0) return 0;
  const vFrom = vFromKmh / 3.6;
  const vTo = vToKmh / 3.6;
  const d = Math.abs(vFrom * vFrom - vTo * vTo) / (2 * gAbs * G);
  return Math.round(d);
}

function anatomyFromSegment(s: InsightSegmentInput): AnatomyCorner {
  return {
    corner_index: s.cornerIndex,
    apex_speed_kmh: s.apexSpeedKmh != null ? Number(s.apexSpeedKmh.toFixed(1)) : 0,
    // Distance de freinage : de l'entrée jusqu'au point le plus lent, sous le G
    // de freinage observé. Estimation physique simple (V1), pas une mesure.
    brake_dist_m: distanceBetweenSpeeds(s.entrySpeedKmh, s.minSpeedKmh, s.maxGBraking),
    // Distance de remise des gaz : du point le plus lent à la sortie.
    accel_dist_m: distanceBetweenSpeeds(s.exitSpeedKmh, s.minSpeedKmh, s.maxGAccel),
    g_lat_apex: Number(s.maxGLateral.toFixed(2)),
  };
}

/**
 * Calcule les blocs d'insights à partir de l'analyse réelle. Déterministe.
 */
export function computeInsightsBlocks(input: InsightsEngineInput): InsightsBlocks {
  const segments = [...input.segments].sort((a, b) => a.cornerIndex - b.cornerIndex);
  const anatomy = segments.map(anatomyFromSegment);

  const validLaps = input.laps.filter((l) => !l.isOutlap && !l.isInlap);
  const lapTimes = validLaps
    .map((l) => ({ n: l.lapNumber, t: l.durationSeconds }))
    .filter((l) => Number.isFinite(l.t) && l.t > 0);

  let idealLap: IdealLap | null = null;
  if (lapTimes.length > 0) {
    const best = lapTimes.reduce((m, l) => (l.t < m.t ? l : m), lapTimes[0]);
    idealLap = {
      // V1 honnête : pas de tour idéal théorique reconstitué (faute de splits
      // par secteur multi-tours). On expose le meilleur tour RÉEL, sans gain
      // inventé. La répartition de la perte par secteur viendra avec le moteur
      // serveur calé à Valence.
      ideal_time_s: Number(best.t.toFixed(3)),
      real_best_s: Number(best.t.toFixed(3)),
      gap_s: 0,
      best_lap: best.n,
      loss_by_sector_pct: [],
      worst_sector: 0,
    };
  }

  const frameCount = Math.max(0, Math.round(input.frameCount));
  const validFrames =
    input.validFrameCount != null ? Math.max(0, Math.round(input.validFrameCount)) : frameCount;
  const pctValid = frameCount > 0 ? Math.round((validFrames / frameCount) * 100) : 0;

  const dataQuality: DataQuality = {
    frames_used: frameCount,
    frames_dropped: Math.max(0, frameCount - validFrames),
    pct_valid: pctValid,
    corners_detected: anatomy.length,
    laps_detected: validLaps.length,
  };

  return {
    engine_version: INSIGHTS_ENGINE_VERSION,
    n_laps: validLaps.length,
    n_frames: frameCount,
    anatomy,
    // Calage multi-tours / gyro requis (données réelles) → vides en V1, honnête.
    dispersion: {},
    chassis_balance: {},
    load_transfer: {},
    ideal_lap: idealLap,
    data_quality: dataQuality,
  };
}
