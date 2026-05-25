/**
 * Service stats consolidées — agrège l'historique du pilote (km totaux,
 * tours totaux, meilleur tour all-time, par circuit).
 *
 * Lecture seule. Utilisé par l'écran `/(app)/stats.tsx` pour le pilote
 * et par les vues admin pour un pilote donné (RLS s'applique).
 */

import { supabase } from '@/lib/supabase';

export interface PilotStats {
  totalSessions: number;
  totalLaps: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  bestLapSeconds: number | null;
  bestLapCircuitName: string | null;
  maxSpeedKmh: number | null;
  /** Stats agrégées par circuit (nom -> stats). */
  byCircuit: Record<string, CircuitAggregate>;
}

export interface CircuitAggregate {
  circuitName: string;
  sessionCount: number;
  lapCount: number;
  distanceKm: number;
  bestLapSeconds: number | null;
  avgMarginPercent: number | null;
}

/**
 * Charge les stats consolidées d'un pilote.
 *
 * @param userId — id du pilote. Côté pilote = son propre user. Côté coach,
 *                 = l'id du pilote suivi (RLS coach_select s'applique).
 */
export async function loadPilotStats(userId: string): Promise<PilotStats> {
  const { data: sessions, error } = await supabase
    .from('telemetry_sessions')
    .select(
      'id, circuit_name, lap_count, best_lap_seconds, distance_km, duration_seconds, max_speed_kmh, app_session_analyses(margin_global)'
    )
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error || !sessions) {
    if (error) console.warn('[OXV][stats] loadPilotStats :', error.message);
    return {
      totalSessions: 0,
      totalLaps: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
      bestLapSeconds: null,
      bestLapCircuitName: null,
      maxSpeedKmh: null,
      byCircuit: {},
    };
  }

  let totalLaps = 0;
  let totalDistanceKm = 0;
  let totalDurationSeconds = 0;
  let bestLapSeconds: number | null = null;
  let bestLapCircuitName: string | null = null;
  let maxSpeedKmh: number | null = null;

  const byCircuit: Record<string, CircuitAggregate> = {};

  for (const s of sessions as Record<string, unknown>[]) {
    const circuit = (s.circuit_name as string | null) ?? 'Inconnu';
    const lapCount = (s.lap_count as number | null) ?? 0;
    const distanceKm = s.distance_km != null ? Number(s.distance_km) : 0;
    const durationSec = s.duration_seconds != null ? Number(s.duration_seconds) : 0;
    const bestLap = s.best_lap_seconds != null ? Number(s.best_lap_seconds) : null;
    const sessionMaxSpeed = s.max_speed_kmh != null ? Number(s.max_speed_kmh) : null;

    const analysisJoined = s.app_session_analyses as
      | { margin_global?: number | null }[]
      | { margin_global?: number | null }
      | null;
    const first = Array.isArray(analysisJoined) ? analysisJoined[0] : analysisJoined;
    const marginGlobal = first?.margin_global != null ? Number(first.margin_global) : null;

    totalLaps += lapCount;
    totalDistanceKm += distanceKm;
    totalDurationSeconds += durationSec;
    if (bestLap !== null && (bestLapSeconds === null || bestLap < bestLapSeconds)) {
      bestLapSeconds = bestLap;
      bestLapCircuitName = circuit;
    }
    if (sessionMaxSpeed !== null && (maxSpeedKmh === null || sessionMaxSpeed > maxSpeedKmh)) {
      maxSpeedKmh = sessionMaxSpeed;
    }

    if (!byCircuit[circuit]) {
      byCircuit[circuit] = {
        circuitName: circuit,
        sessionCount: 0,
        lapCount: 0,
        distanceKm: 0,
        bestLapSeconds: null,
        avgMarginPercent: null,
      };
    }
    const agg = byCircuit[circuit];
    agg.sessionCount += 1;
    agg.lapCount += lapCount;
    agg.distanceKm += distanceKm;
    if (bestLap !== null && (agg.bestLapSeconds === null || bestLap < agg.bestLapSeconds)) {
      agg.bestLapSeconds = bestLap;
    }
    // Moyenne glissante simple sur la marge
    if (marginGlobal !== null) {
      const prev = agg.avgMarginPercent;
      const n = agg.sessionCount;
      agg.avgMarginPercent = prev === null ? marginGlobal : (prev * (n - 1) + marginGlobal) / n;
    }
  }

  return {
    totalSessions: sessions.length,
    totalLaps,
    totalDistanceKm,
    totalDurationSeconds,
    bestLapSeconds,
    bestLapCircuitName,
    maxSpeedKmh,
    byCircuit,
  };
}
