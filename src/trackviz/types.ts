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
  /**
   * Distance latérale au tracé de référence (m). TOUJOURS POSITIVE.
   *
   * Ce champ a documenté « signe = côté » de son écriture au 01/09/2026, alors
   * que `mapMatchPoint` rend `bestDistance`, une distance haversine — jamais
   * négative. Aucun appelant ne pouvait donc lire un côté, et rien ne le
   * signalait. Le côté demanderait un produit vectoriel sur le segment retenu ;
   * c'est un calcul qui n'existe pas ici, et on ne le documente pas d'avance.
   */
  lateral_error_m: number;
  /**
   * La projection est tombée au-delà d'un bout du tracé — voir
   * `MapMatchResult.horsTrace`. L'écart latéral de ce point mesure la distance
   * à un sommet, pas à une trajectoire : il ne compte dans aucune statistique.
   */
  hors_trace: boolean;
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

/*
 * `ScenePoint` VIVAIT ICI. Retiré le 03/08/2026, avec `TrackProjection`
 * (`geometry.ts`), qui en était le seul lecteur.
 *
 * ATTENTION EN CAS DE RETOUR : deux autres types portent ce nom dans le dépôt,
 * et ce ne sont pas les mêmes — `src/render/projection.ts` et
 * `src/components/CircuitMap/projection.ts`. Celui-ci était le troisième.
 */
