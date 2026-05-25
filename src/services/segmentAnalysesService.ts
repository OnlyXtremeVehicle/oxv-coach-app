/**
 * Lecture / écriture des stats par segment dans `app_segment_analyses`.
 *
 * Alimenté par `trackviz.analyzeTrackVizSession()` côté app (sem 12+),
 * lu par #14 Carte (marges par virage colorisées) et #15 Zoom virage
 * (stats Physique).
 *
 * Remplace `mockCornerMargins` (sem 6 V1) par de vraies marges issues
 * de l'analyse trackviz. Tant qu'aucune session n'a été analysée, le
 * service retourne `null` et l'UI peut fallback sur le mock.
 */

import { supabase } from '@/lib/supabase';
import { type MarginZone, marginZoneOf } from '@/types/domain';

import type { TrackVizSegmentAnalysis } from '@/trackviz/types';

export interface SegmentAnalysisRow {
  id: string;
  telemetrySessionId: string;
  userId: string;
  segmentIndex: number;
  segmentName: string | null;
  kind: string | null;
  startProgress: number | null;
  endProgress: number | null;
  sampleCount: number | null;
  durationSeconds: number | null;
  entrySpeedKmh: number | null;
  apexSpeedKmh: number | null;
  exitSpeedKmh: number | null;
  minSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  maxGLateral: number | null;
  maxGBraking: number | null;
  maxGAccel: number | null;
  avgLateralErrorM: number | null;
  maxLateralErrorM: number | null;
  marginPercent: number | null;
  marginZone: MarginZone | null;
  algoVersion: string;
  computedAt: string;
}

export async function listSegmentAnalysesForSession(
  telemetrySessionId: string
): Promise<SegmentAnalysisRow[]> {
  const { data, error } = await supabase
    .from('app_segment_analyses')
    .select('*')
    .eq('telemetry_session_id', telemetrySessionId)
    .order('segment_index', { ascending: true });

  if (error) {
    console.warn('[OXV] listSegmentAnalysesForSession :', error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function getSegmentAnalysis(
  telemetrySessionId: string,
  segmentIndex: number
): Promise<SegmentAnalysisRow | null> {
  const { data, error } = await supabase
    .from('app_segment_analyses')
    .select('*')
    .eq('telemetry_session_id', telemetrySessionId)
    .eq('segment_index', segmentIndex)
    .maybeSingle();

  if (error) {
    console.warn('[OXV] getSegmentAnalysis :', error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function upsertSegmentAnalyses(input: {
  telemetrySessionId: string;
  userId: string;
  segments: TrackVizSegmentAnalysis[];
}): Promise<number> {
  if (input.segments.length === 0) return 0;
  const rows = input.segments.map((s) => ({
    telemetry_session_id: input.telemetrySessionId,
    user_id: input.userId,
    segment_index: s.segmentIndex,
    segment_name: s.segmentName,
    kind: s.kind,
    start_progress: s.startProgress,
    end_progress: s.endProgress,
    sample_count: s.sampleCount,
    duration_seconds: s.durationSeconds,
    entry_speed_kmh: s.entrySpeedKmh,
    apex_speed_kmh: s.apexSpeedKmh,
    exit_speed_kmh: s.exitSpeedKmh,
    min_speed_kmh: s.minSpeedKmh,
    max_speed_kmh: s.maxSpeedKmh,
    avg_speed_kmh: s.avgSpeedKmh,
    max_g_lateral: s.maxGLateral,
    max_g_braking: s.maxGBraking,
    max_g_accel: s.maxGAccel,
    avg_lateral_error_m: s.avgLateralErrorM,
    max_lateral_error_m: s.maxLateralErrorM,
    margin_percent: s.marginPercent,
    margin_zone: s.marginZone,
    algo_version: 'trackviz-v1.0',
    computed_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from('app_segment_analyses')
    .upsert(rows, { onConflict: 'telemetry_session_id,segment_index', count: 'exact' });

  if (error) {
    console.warn('[OXV] upsertSegmentAnalyses :', error.message);
    return 0;
  }
  return count ?? rows.length;
}

export interface SegmentAggregate {
  segmentIndex: number;
  sessionCount: number;
  avgMarginPercent: number | null;
  avgEntrySpeedKmh: number | null;
  avgApexSpeedKmh: number | null;
  avgExitSpeedKmh: number | null;
  avgMaxGLateral: number | null;
  avgLateralErrorM: number | null;
  /** Distribution des zones sur toutes les sessions agrégées. */
  zoneDistribution: { green: number; yellow: number; red: number };
}

/**
 * Agrège les `app_segment_analyses` par `segment_index`, optionnellement
 * filtré par user. Renvoie pour chaque virage la marge moyenne historique
 * et la distribution de zones. Utile pour la vue admin circuit (qui sert
 * à inspecter la richesse des données collectées) et pour des analyses
 * temporelles ultérieures.
 *
 * Si `userId` est omis, on agrège sur l'ensemble des sessions de tous
 * les pilotes — réservé aux vues admin.
 */
export async function aggregateSegmentStats(userId?: string): Promise<SegmentAggregate[]> {
  let query = supabase
    .from('app_segment_analyses')
    .select(
      'segment_index, margin_percent, margin_zone, entry_speed_kmh, apex_speed_kmh, exit_speed_kmh, max_g_lateral, avg_lateral_error_m'
    );
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.warn('[OXV] aggregateSegmentStats :', error.message);
    return [];
  }

  // GroupBy segment_index côté client (les sessions sont peu nombreuses V1)
  const buckets = new Map<number, AggregateBucket>();
  for (const row of data as AggregateRow[]) {
    const idx = row.segment_index;
    if (!buckets.has(idx)) {
      buckets.set(idx, {
        segmentIndex: idx,
        sessionCount: 0,
        marginSum: 0,
        marginCount: 0,
        entrySum: 0,
        entryCount: 0,
        apexSum: 0,
        apexCount: 0,
        exitSum: 0,
        exitCount: 0,
        gLatSum: 0,
        gLatCount: 0,
        latErrSum: 0,
        latErrCount: 0,
        green: 0,
        yellow: 0,
        red: 0,
      });
    }
    const b = buckets.get(idx)!;
    b.sessionCount += 1;
    accumulate(b, 'margin', row.margin_percent);
    accumulate(b, 'entry', row.entry_speed_kmh);
    accumulate(b, 'apex', row.apex_speed_kmh);
    accumulate(b, 'exit', row.exit_speed_kmh);
    accumulate(b, 'gLat', row.max_g_lateral);
    accumulate(b, 'latErr', row.avg_lateral_error_m);
    if (row.margin_zone === 'green') b.green += 1;
    else if (row.margin_zone === 'yellow') b.yellow += 1;
    else if (row.margin_zone === 'red') b.red += 1;
  }

  return Array.from(buckets.values())
    .map(
      (b): SegmentAggregate => ({
        segmentIndex: b.segmentIndex,
        sessionCount: b.sessionCount,
        avgMarginPercent: avg(b.marginSum, b.marginCount),
        avgEntrySpeedKmh: avg(b.entrySum, b.entryCount),
        avgApexSpeedKmh: avg(b.apexSum, b.apexCount),
        avgExitSpeedKmh: avg(b.exitSum, b.exitCount),
        avgMaxGLateral: avg(b.gLatSum, b.gLatCount),
        avgLateralErrorM: avg(b.latErrSum, b.latErrCount),
        zoneDistribution: { green: b.green, yellow: b.yellow, red: b.red },
      })
    )
    .sort((a, b) => a.segmentIndex - b.segmentIndex);
}

interface AggregateRow {
  segment_index: number;
  margin_percent: number | string | null;
  margin_zone: string | null;
  entry_speed_kmh: number | string | null;
  apex_speed_kmh: number | string | null;
  exit_speed_kmh: number | string | null;
  max_g_lateral: number | string | null;
  avg_lateral_error_m: number | string | null;
}

interface AggregateBucket {
  segmentIndex: number;
  sessionCount: number;
  marginSum: number;
  marginCount: number;
  entrySum: number;
  entryCount: number;
  apexSum: number;
  apexCount: number;
  exitSum: number;
  exitCount: number;
  gLatSum: number;
  gLatCount: number;
  latErrSum: number;
  latErrCount: number;
  green: number;
  yellow: number;
  red: number;
}

function accumulate(
  b: AggregateBucket,
  key: 'margin' | 'entry' | 'apex' | 'exit' | 'gLat' | 'latErr',
  value: number | string | null
): void {
  if (value === null || value === undefined) return;
  const num = Number(value);
  if (!Number.isFinite(num)) return;
  switch (key) {
    case 'margin':
      b.marginSum += num;
      b.marginCount += 1;
      break;
    case 'entry':
      b.entrySum += num;
      b.entryCount += 1;
      break;
    case 'apex':
      b.apexSum += num;
      b.apexCount += 1;
      break;
    case 'exit':
      b.exitSum += num;
      b.exitCount += 1;
      break;
    case 'gLat':
      b.gLatSum += num;
      b.gLatCount += 1;
      break;
    case 'latErr':
      b.latErrSum += num;
      b.latErrCount += 1;
      break;
  }
}

function avg(sum: number, count: number): number | null {
  if (count === 0) return null;
  return sum / count;
}

/**
 * Récupère un mapping `{ cornerIndex: MarginZone }` compatible avec
 * `selectFocusCorner`. Si aucune analyse n'existe pour cette session,
 * retourne `null` (l'appelant peut alors fallback sur `mockCornerMargins`).
 */
export async function getCornerMarginsZones(telemetrySessionId: string): Promise<{
  zones: Record<number, MarginZone>;
  numeric: Record<number, number>;
} | null> {
  const segments = await listSegmentAnalysesForSession(telemetrySessionId);
  if (segments.length === 0) return null;

  const zones: Record<number, MarginZone> = {};
  const numeric: Record<number, number> = {};
  for (const s of segments) {
    if (s.marginPercent !== null) {
      numeric[s.segmentIndex] = Number(s.marginPercent);
      zones[s.segmentIndex] = s.marginZone ?? marginZoneOf(Number(s.marginPercent));
    }
  }
  return { zones, numeric };
}

interface RawRow {
  id: string;
  telemetry_session_id: string;
  user_id: string;
  segment_index: number;
  segment_name: string | null;
  kind: string | null;
  start_progress: number | null;
  end_progress: number | null;
  sample_count: number | null;
  duration_seconds: number | null;
  entry_speed_kmh: number | null;
  apex_speed_kmh: number | null;
  exit_speed_kmh: number | null;
  min_speed_kmh: number | null;
  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  max_g_lateral: number | null;
  max_g_braking: number | null;
  max_g_accel: number | null;
  avg_lateral_error_m: number | null;
  max_lateral_error_m: number | null;
  margin_percent: number | null;
  margin_zone: string | null;
  algo_version: string;
  computed_at: string;
}

function mapRow(row: RawRow): SegmentAnalysisRow {
  return {
    id: row.id,
    telemetrySessionId: row.telemetry_session_id,
    userId: row.user_id,
    segmentIndex: row.segment_index,
    segmentName: row.segment_name,
    kind: row.kind,
    startProgress: row.start_progress !== null ? Number(row.start_progress) : null,
    endProgress: row.end_progress !== null ? Number(row.end_progress) : null,
    sampleCount: row.sample_count,
    durationSeconds: row.duration_seconds !== null ? Number(row.duration_seconds) : null,
    entrySpeedKmh: row.entry_speed_kmh !== null ? Number(row.entry_speed_kmh) : null,
    apexSpeedKmh: row.apex_speed_kmh !== null ? Number(row.apex_speed_kmh) : null,
    exitSpeedKmh: row.exit_speed_kmh !== null ? Number(row.exit_speed_kmh) : null,
    minSpeedKmh: row.min_speed_kmh !== null ? Number(row.min_speed_kmh) : null,
    maxSpeedKmh: row.max_speed_kmh !== null ? Number(row.max_speed_kmh) : null,
    avgSpeedKmh: row.avg_speed_kmh !== null ? Number(row.avg_speed_kmh) : null,
    maxGLateral: row.max_g_lateral !== null ? Number(row.max_g_lateral) : null,
    maxGBraking: row.max_g_braking !== null ? Number(row.max_g_braking) : null,
    maxGAccel: row.max_g_accel !== null ? Number(row.max_g_accel) : null,
    avgLateralErrorM: row.avg_lateral_error_m !== null ? Number(row.avg_lateral_error_m) : null,
    maxLateralErrorM: row.max_lateral_error_m !== null ? Number(row.max_lateral_error_m) : null,
    marginPercent: row.margin_percent !== null ? Number(row.margin_percent) : null,
    marginZone: (row.margin_zone as MarginZone | null) ?? null,
    algoVersion: row.algo_version,
    computedAt: row.computed_at,
  };
}
