/**
 * Analyse de session trackviz — sans verdict, sans score affiché.
 *
 * Adapté du module partagé par Gabin en sem 11. La logique de découpage
 * en segments et de calcul des stats est conservée. Le scoring 0-100 et
 * les "verdicts" textuels sont écartés au profit d'une **marge composite
 * par segment** alignée sur la doctrine (vert/jaune/rouge, label humain).
 *
 * Les conseils contextualisés sont délégués à `focusCorner.ts` qui passe
 * déjà le test anti-verbes-interdits depuis sem 7.
 */

import { type MarginZone, marginZoneOf } from '@/types/domain';

import { HAUTE_SAINTONGE_SEGMENTS, HAUTE_SAINTONGE_TRACK } from './hauteSaintonge';
import {
  buildTrackGeometry,
  mapMatchPoint,
  phaseForProgress,
  segmentForProgress,
} from './geometry';
import type {
  TrackVizAnalysisResult,
  TrackVizRecordingSample,
  TrackVizSample,
  TrackVizSegmentAnalysis,
  TrackVizSegmentDefinition,
} from './types';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function withNumbers(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

function clamp01to100(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

/**
 * Normalise un flux de samples bruts en samples enrichis (progress,
 * distance, lateral_error, phase). Triés par elapsed_ms croissant.
 */
export function normalizeTrackVizSamples(
  recordingSamples: TrackVizRecordingSample[]
): TrackVizSample[] {
  const geometry = buildTrackGeometry(HAUTE_SAINTONGE_TRACK);

  return recordingSamples
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .sort((a, b) => a.elapsed_ms - b.elapsed_ms)
    .map((sample) => {
      const match = mapMatchPoint({ lat: sample.latitude, lon: sample.longitude }, geometry);
      const segment = segmentForProgress(match.progress, HAUTE_SAINTONGE_SEGMENTS);
      return {
        ...sample,
        progress: match.progress,
        distance_m: match.distanceM,
        lateral_error_m: match.lateralErrorM,
        phase: phaseForProgress(match.progress, segment),
      };
    });
}

/**
 * Calcule la marge composite d'UN segment, doctrinale.
 *
 * Marge segment = 100 - utilisation. Plus l'erreur latérale est grande,
 * plus la marge baisse. Plus le G_lat dépasse le seuil "confortable",
 * plus la marge baisse aussi. Pondération volontairement simple :
 *   - 50% précision trajectoire (lateral_error vs seuil 4 m)
 *   - 50% sécurité pneumatique (G_lat vs seuil 1.2 g)
 *
 * Sem 13+ : on enrichira avec le smoothness (jerk) et la stabilité
 * dynamique (sous/sur-virage) du document algos P2.
 */
function computeSegmentMargin(input: { maxLateralErrorM: number; maxGLateral: number }): number {
  const LATERAL_THRESHOLD_M = 4; // au-delà = trajectoire dispersée
  const GLAT_THRESHOLD = 1.2; // au-delà = limite pneumatique

  const trajectoryUsage = Math.min(1, input.maxLateralErrorM / LATERAL_THRESHOLD_M);
  const tyreUsage = Math.min(1, input.maxGLateral / GLAT_THRESHOLD);

  const margin = 100 * (1 - 0.5 * trajectoryUsage - 0.5 * tyreUsage);
  return clamp01to100(margin);
}

function analyzeSegment(
  segment: TrackVizSegmentDefinition,
  samples: TrackVizSample[]
): TrackVizSegmentAnalysis | null {
  const inSegment = samples.filter(
    (s) => s.progress >= segment.progressStart && s.progress <= segment.progressEnd
  );
  if (inSegment.length < 2) return null;

  const speeds = withNumbers(inSegment.map((s) => s.speed_kmh));
  const lateralErrors = withNumbers(inSegment.map((s) => s.lateral_error_m));
  const gLat = withNumbers(inSegment.map((s) => Math.abs(s.g_force_y)));
  const braking = withNumbers(inSegment.map((s) => (s.g_force_x > 0 ? s.g_force_x : 0)));
  const accel = withNumbers(inSegment.map((s) => (s.g_force_x < 0 ? Math.abs(s.g_force_x) : 0)));

  const apexSamples =
    segment.apexProgress === null
      ? []
      : inSegment.filter((s) => Math.abs(s.progress - (segment.apexProgress ?? 0)) <= 0.018);
  const apexSpeeds = withNumbers(apexSamples.map((s) => s.speed_kmh));

  const durationSeconds =
    (inSegment[inSegment.length - 1].elapsed_ms - inSegment[0].elapsed_ms) / 1000;
  const entrySliceSize = Math.max(1, Math.ceil(inSegment.length * 0.18));
  const exitSliceStart = Math.max(0, Math.floor(inSegment.length * 0.82));
  const entrySpeed = average(inSegment.slice(0, entrySliceSize).map((s) => s.speed_kmh));
  const exitSpeed = average(inSegment.slice(exitSliceStart).map((s) => s.speed_kmh));
  const apexSpeed = apexSpeeds.length > 0 ? percentile(apexSpeeds, 0.25) : null;

  const maxLateralError = Math.max(...lateralErrors, 0);
  const maxGLateral = Math.max(...gLat, 0);
  const marginPercent = computeSegmentMargin({
    maxLateralErrorM: maxLateralError,
    maxGLateral,
  });
  const marginZone: MarginZone = marginZoneOf(marginPercent);

  return {
    segmentIndex: segment.order,
    segmentName: segment.name,
    kind: segment.kind,
    sampleCount: inSegment.length,
    startProgress: segment.progressStart,
    endProgress: segment.progressEnd,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    entrySpeedKmh: Number(entrySpeed.toFixed(1)),
    apexSpeedKmh: apexSpeed === null ? null : Number(apexSpeed.toFixed(1)),
    exitSpeedKmh: Number(exitSpeed.toFixed(1)),
    minSpeedKmh: Number(Math.min(...speeds).toFixed(1)),
    maxSpeedKmh: Number(Math.max(...speeds).toFixed(1)),
    avgSpeedKmh: Number(average(speeds).toFixed(1)),
    maxGLateral: Number(maxGLateral.toFixed(3)),
    maxGBraking: Number(Math.max(...braking, 0).toFixed(3)),
    maxGAccel: Number(Math.max(...accel, 0).toFixed(3)),
    avgLateralErrorM: Number(average(lateralErrors).toFixed(2)),
    maxLateralErrorM: Number(maxLateralError.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(2)),
    marginZone,
  };
}

export function analyzeTrackVizSession(
  recordingSamples: TrackVizRecordingSample[]
): TrackVizAnalysisResult {
  const samples = normalizeTrackVizSamples(recordingSamples);

  const segments = HAUTE_SAINTONGE_SEGMENTS.map((segment) =>
    analyzeSegment(segment, samples)
  ).filter((s): s is TrackVizSegmentAnalysis => Boolean(s));

  const speeds = withNumbers(samples.map((s) => s.speed_kmh));
  const lateralErrors = withNumbers(samples.map((s) => s.lateral_error_m));
  const gLat = withNumbers(samples.map((s) => Math.abs(s.g_force_y)));
  const braking = withNumbers(samples.map((s) => (s.g_force_x > 0 ? s.g_force_x : 0)));
  const accel = withNumbers(samples.map((s) => (s.g_force_x < 0 ? Math.abs(s.g_force_x) : 0)));
  const durationSeconds =
    samples.length > 1
      ? (samples[samples.length - 1].elapsed_ms - samples[0].elapsed_ms) / 1000
      : 0;

  return {
    samples,
    segments,
    summary: {
      sampleCount: samples.length,
      durationSeconds: Number(durationSeconds.toFixed(3)),
      maxSpeedKmh: Number(Math.max(...speeds, 0).toFixed(1)),
      avgSpeedKmh: Number(average(speeds).toFixed(1)),
      maxGLateral: Number(Math.max(...gLat, 0).toFixed(3)),
      maxBrakingG: Number(Math.max(...braking, 0).toFixed(3)),
      maxAccelG: Number(Math.max(...accel, 0).toFixed(3)),
      avgLateralErrorM: Number(average(lateralErrors).toFixed(2)),
    },
  };
}

/**
 * Génère des samples de démo cohérents avec le tracé Beltoise. Utile
 * pour tester l'analyse sans device, et pour les fixtures Jest.
 *
 * Adapté du module partagé par Gabin sem 11.
 */
export function buildDemoTrackVizSamples(): TrackVizRecordingSample[] {
  const totalMs = 95_000;
  const samples: TrackVizRecordingSample[] = [];
  const tau = Math.PI * 2;

  for (let i = 0; i < 240; i++) {
    const progress = i / 239;
    const trackIndex = Math.min(
      HAUTE_SAINTONGE_TRACK.length - 1,
      Math.floor(progress * (HAUTE_SAINTONGE_TRACK.length - 1))
    );
    const point = HAUTE_SAINTONGE_TRACK[trackIndex];
    const segment = segmentForProgress(progress, HAUTE_SAINTONGE_SEGMENTS);
    const phase = phaseForProgress(progress, segment);
    const isTurn = segment.kind === 'turn';
    const phasePenalty = phase === 'apex' ? 58 : phase === 'entry' ? 36 : phase === 'exit' ? 22 : 0;
    const speed = Math.max(
      70,
      216 - (isTurn ? phasePenalty : 0) - Math.sin(progress * tau * 4) * 8
    );
    const gLong = phase === 'entry' ? 0.8 : phase === 'exit' ? -0.45 : 0.04;
    const gLat = isTurn ? 0.78 + Math.sin(progress * tau * 7) * 0.14 : 0.08;

    samples.push({
      elapsed_ms: Math.round(progress * totalMs),
      latitude: point.lat,
      longitude: point.lon,
      altitude_m: null,
      speed_kmh: speed,
      heading_deg: null,
      g_force_x: gLong,
      g_force_y: gLat,
      g_force_z: 1,
      gps_accuracy_m: 0.8,
      gps_fix: 3,
      satellites: 18,
      battery_level: 85,
      source: 'demo',
    });
  }

  return samples;
}
