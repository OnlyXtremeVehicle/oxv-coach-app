/**
 * Types trackviz — adaptés à la doctrine OXV.
 *
 * Différences avec le module partagé en sem 11 :
 *   - PAS de `verdict` ni `score` (gamification interdite)
 *   - PAS de phrases directives (`advice`, `insight`) — déléguées à
 *     `focusCorner.ts` qui passe le test anti-verbes-interdits
 *   - Renomage `segment_id` → `segmentIndex` cohérent avec notre
 *     numérotation virages 1..14
 */

import type { MarginZone } from '@/types/domain';

export type SegmentKind = 'straight' | 'turn' | 'chicane';
export type SegmentPhase = 'entry' | 'apex' | 'exit' | 'straight';

export interface TrackVizSegmentDefinition {
  id: string;
  order: number;
  name: string;
  kind: SegmentKind;
  /** Position de début du segment sur le tracé, 0..1. */
  progressStart: number;
  /** Position de fin du segment, 0..1. */
  progressEnd: number;
  /** Position de l'apex si pertinent, null pour les lignes droites. */
  apexProgress: number | null;
  /** Note interne d'aide à la formulation (jamais affichée tel quel). */
  coachingFocus: string;
}

/** Sample brut envoyé par RaceBox ou un import CSV. */
export interface TrackVizRecordingSample {
  elapsed_ms: number;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  speed_kmh: number;
  heading_deg: number | null;
  g_force_x: number;
  g_force_y: number;
  g_force_z: number;
  gps_accuracy_m: number | null;
  gps_fix: number;
  satellites: number | null;
  battery_level: number | null;
  source: 'ble' | 'csv' | 'demo';
}

/** Sample enrichi après map-matching. */
export interface TrackVizSample extends TrackVizRecordingSample {
  /** Position projetée sur le tracé, 0..1. */
  progress: number;
  /** Distance parcourue depuis le départ (m). */
  distance_m: number;
  /** Distance latérale au tracé de référence (m), signe = côté. */
  lateral_error_m: number;
  /** Phase courante du virage (ou 'straight' hors virage). */
  phase: SegmentPhase;
  /** Ajouté lors de l'upsert Supabase. */
  session_id?: string;
}

/** Stats agrégées par segment — sans verdict ni score affichable. */
export interface TrackVizSegmentAnalysis {
  segmentIndex: number;
  segmentName: string;
  kind: SegmentKind;
  sampleCount: number;
  startProgress: number;
  endProgress: number;
  durationSeconds: number;

  entrySpeedKmh: number;
  apexSpeedKmh: number | null;
  exitSpeedKmh: number;
  minSpeedKmh: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;

  maxGLateral: number;
  maxGBraking: number;
  maxGAccel: number;

  avgLateralErrorM: number;
  maxLateralErrorM: number;

  /** Marge composite pour ce segment, 0..100. Calculée doctrinalement. */
  marginPercent: number;
  marginZone: MarginZone;
}

export interface TrackVizSummary {
  sampleCount: number;
  durationSeconds: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  maxGLateral: number;
  maxBrakingG: number;
  maxAccelG: number;
  avgLateralErrorM: number;
}

export interface TrackVizAnalysisResult {
  samples: TrackVizSample[];
  segments: TrackVizSegmentAnalysis[];
  summary: TrackVizSummary;
}

/** Point projeté sur la "scène" SVG (avant remise à l'échelle viewBox). */
export interface ScenePoint {
  x: number;
  y: number;
}
