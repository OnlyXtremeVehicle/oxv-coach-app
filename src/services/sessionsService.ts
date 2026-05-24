/**
 * Service sessions OXV — v0.2 (Module B.5)
 *
 * Ajouts B.5 :
 * - fetchAllSessions : récupère toutes les sessions du user
 * - calculateGlobalStats : stats all-time
 * - deleteSession : suppression
 * - renameSession : custom_name
 */

import { supabase } from '@/lib/supabase';
import type { TelemetrySession, Lap } from '@/types/telemetry';

// ============================================================
// PRÉCÉDENTES FONCTIONS B.2 — Conservées
// ============================================================

export async function fetchPreviousSessions(
  userId: string,
  circuitId: string | null,
  limit: number = 5,
  excludeSessionId?: string
): Promise<TelemetrySession[]> {
  try {
    let query = supabase
      .from('telemetry_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (circuitId) {
      query = query.eq('circuit_id', circuitId);
    }

    if (excludeSessionId) {
      query = query.neq('id', excludeSessionId);
    }

    const { data, error } = await query;

    if (error || !data) return [];
    return data as TelemetrySession[];
  } catch (error) {
    console.error('[Sessions] Fetch previous error:', error);
    return [];
  }
}

export async function fetchSessionLaps(sessionId: string): Promise<Lap[]> {
  try {
    const { data, error } = await supabase
      .from('laps')
      .select('*')
      .eq('session_id', sessionId)
      .order('lap_number', { ascending: true });

    if (error || !data) return [];
    return data as Lap[];
  } catch (error) {
    console.error('[Sessions] Fetch laps error:', error);
    return [];
  }
}

export interface Evolution {
  maxSpeedDelta: number | null;
  maxSpeedPctChange: number | null;
  maxGLateralDelta: number | null;
  maxGBrakingDelta: number | null;
  bestLapDelta: number | null;
  distanceDelta: number | null;
  comparedTo: 'previous_session' | 'best_session' | null;
  comparedSessionId: string | null;
  comparedSessionDate: string | null;
  totalPreviousSessions: number;
}

export function calculateEvolution(
  currentSession: {
    max_speed_kmh: number | null;
    max_g_lateral: number | null;
    max_g_longitudinal: number | null;
    best_lap_seconds: number | null;
    distance_km: number | null;
  },
  previousSessions: TelemetrySession[]
): Evolution {
  if (previousSessions.length === 0) {
    return {
      maxSpeedDelta: null,
      maxSpeedPctChange: null,
      maxGLateralDelta: null,
      maxGBrakingDelta: null,
      bestLapDelta: null,
      distanceDelta: null,
      comparedTo: null,
      comparedSessionId: null,
      comparedSessionDate: null,
      totalPreviousSessions: 0,
    };
  }

  const previous = previousSessions[0];

  // Helper safe number
  const num = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? null : n;
  };

  const curMaxSpeed = num(currentSession.max_speed_kmh);
  const prevMaxSpeed = num(previous.max_speed_kmh);
  const curGLat = num(currentSession.max_g_lateral);
  const prevGLat = num(previous.max_g_lateral);
  const curGLong = num(currentSession.max_g_longitudinal);
  const prevGLong = num(previous.max_g_longitudinal);
  const curBestLap = num(currentSession.best_lap_seconds);
  const prevBestLap = num(previous.best_lap_seconds);
  const curDistance = num(currentSession.distance_km);
  const prevDistance = num(previous.distance_km);

  let maxSpeedDelta = null;
  let maxSpeedPctChange = null;
  if (curMaxSpeed !== null && prevMaxSpeed !== null) {
    maxSpeedDelta = curMaxSpeed - prevMaxSpeed;
    maxSpeedPctChange = prevMaxSpeed > 0 ? (maxSpeedDelta / prevMaxSpeed) * 100 : null;
  }

  return {
    maxSpeedDelta,
    maxSpeedPctChange,
    maxGLateralDelta: curGLat !== null && prevGLat !== null ? curGLat - prevGLat : null,
    maxGBrakingDelta: curGLong !== null && prevGLong !== null ? curGLong - prevGLong : null,
    bestLapDelta: curBestLap !== null && prevBestLap !== null ? curBestLap - prevBestLap : null,
    distanceDelta:
      curDistance !== null && prevDistance !== null ? curDistance - prevDistance : null,
    comparedTo: 'previous_session',
    comparedSessionId: previous.id,
    comparedSessionDate: previous.started_at,
    totalPreviousSessions: previousSessions.length,
  };
}

export interface SpeedSample {
  elapsedSeconds: number;
  speedKmh: number;
}

export async function fetchSpeedSamples(sessionId: string): Promise<SpeedSample[]> {
  const laps = await fetchSessionLaps(sessionId);
  if (laps.length === 0) return [];

  const num = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  };

  const samples: SpeedSample[] = [];
  let cumulativeTime = 0;

  for (const lap of laps) {
    const lapDuration = num(lap.duration_seconds);

    samples.push({
      elapsedSeconds: cumulativeTime,
      speedKmh: num(lap.avg_speed_kmh),
    });

    samples.push({
      elapsedSeconds: cumulativeTime + lapDuration / 2,
      speedKmh: num(lap.max_speed_kmh),
    });

    cumulativeTime += lapDuration;

    samples.push({
      elapsedSeconds: cumulativeTime,
      speedKmh: num(lap.avg_speed_kmh),
    });
  }

  return samples;
}

// ============================================================
// NOUVEAU B.5 — Liste sessions et stats globales
// ============================================================

/**
 * Récupère TOUTES les sessions complétées d'un user
 */
export async function fetchAllSessions(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    circuitId?: string;
    fromDate?: string;
    toDate?: string;
  } = {}
): Promise<TelemetrySession[]> {
  try {
    let query = supabase
      .from('telemetry_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false });

    if (options.circuitId) {
      query = query.eq('circuit_id', options.circuitId);
    }

    if (options.fromDate) {
      query = query.gte('started_at', options.fromDate);
    }

    if (options.toDate) {
      query = query.lte('started_at', options.toDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Sessions] Fetch all error:', error);
      return [];
    }
    return (data || []) as TelemetrySession[];
  } catch (error) {
    console.error('[Sessions] Fetch all exception:', error);
    return [];
  }
}

/**
 * Statistiques globales all-time du user
 */
export interface GlobalStats {
  totalSessions: number;
  totalLaps: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;

  bestMaxSpeedKmh: number | null;
  bestMaxSpeedSessionId: string | null;
  bestMaxSpeedDate: string | null;

  bestLapSeconds: number | null;
  bestLapSessionId: string | null;
  bestLapDate: string | null;
  bestLapCircuit: string | null;

  uniqueCircuits: number;

  firstSessionDate: string | null;
  lastSessionDate: string | null;
}

export async function fetchGlobalStats(userId: string): Promise<GlobalStats> {
  const empty: GlobalStats = {
    totalSessions: 0,
    totalLaps: 0,
    totalDistanceKm: 0,
    totalDurationMinutes: 0,
    bestMaxSpeedKmh: null,
    bestMaxSpeedSessionId: null,
    bestMaxSpeedDate: null,
    bestLapSeconds: null,
    bestLapSessionId: null,
    bestLapDate: null,
    bestLapCircuit: null,
    uniqueCircuits: 0,
    firstSessionDate: null,
    lastSessionDate: null,
  };

  try {
    const sessions = await fetchAllSessions(userId);
    if (sessions.length === 0) return empty;

    // Helper safe number
    const num = (v: any): number => {
      if (v === null || v === undefined) return 0;
      const n = typeof v === 'string' ? parseFloat(v) : v;
      return isNaN(n) ? 0 : n;
    };

    // Total
    let totalLaps = 0;
    let totalDistanceKm = 0;
    let totalDurationSec = 0;

    let bestMaxSpeed: TelemetrySession | null = null;
    let bestLap: TelemetrySession | null = null;

    const circuitIds = new Set<string>();

    for (const s of sessions) {
      totalLaps += s.lap_count || 0;
      totalDistanceKm += num(s.distance_km);
      totalDurationSec += num(s.duration_seconds);

      // Best max speed
      const speed = num(s.max_speed_kmh);
      if (speed > 0) {
        if (!bestMaxSpeed || speed > num(bestMaxSpeed.max_speed_kmh)) {
          bestMaxSpeed = s;
        }
      }

      // Best lap
      const lapSec = num(s.best_lap_seconds);
      if (lapSec > 0) {
        if (!bestLap || lapSec < num(bestLap.best_lap_seconds)) {
          bestLap = s;
        }
      }

      // Circuits
      if (s.circuit_id) {
        circuitIds.add(s.circuit_id);
      }
    }

    return {
      totalSessions: sessions.length,
      totalLaps,
      totalDistanceKm,
      totalDurationMinutes: Math.round(totalDurationSec / 60),

      bestMaxSpeedKmh: bestMaxSpeed ? num(bestMaxSpeed.max_speed_kmh) : null,
      bestMaxSpeedSessionId: bestMaxSpeed?.id ?? null,
      bestMaxSpeedDate: bestMaxSpeed?.started_at ?? null,

      bestLapSeconds: bestLap ? num(bestLap.best_lap_seconds) : null,
      bestLapSessionId: bestLap?.id ?? null,
      bestLapDate: bestLap?.started_at ?? null,
      bestLapCircuit: bestLap?.circuit_name ?? null,

      uniqueCircuits: circuitIds.size,

      firstSessionDate: sessions[sessions.length - 1]?.started_at ?? null,
      lastSessionDate: sessions[0]?.started_at ?? null,
    };
  } catch (error) {
    console.error('[Sessions] Global stats error:', error);
    return empty;
  }
}

/**
 * Supprime une session (cascade : laps + weather)
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('telemetry_sessions').delete().eq('id', sessionId);

    if (error) {
      console.error('[Sessions] Delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Sessions] Delete exception:', error);
    return false;
  }
}

/**
 * Renomme une session (custom_name)
 */
export async function renameSession(sessionId: string, customName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('telemetry_sessions')
      .update({ custom_name: customName.trim() })
      .eq('id', sessionId);

    if (error) {
      console.error('[Sessions] Rename error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Sessions] Rename exception:', error);
    return false;
  }
}

/**
 * Récupère les circuits utilisés par le user (pour filtres)
 */
export async function fetchUsedCircuits(
  userId: string
): Promise<Array<{ id: string; name: string; count: number }>> {
  try {
    const { data, error } = await supabase
      .from('telemetry_sessions')
      .select('circuit_id, circuit_name')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('circuit_id', 'is', null);

    if (error || !data) return [];

    // Agréger
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of data) {
      if (!s.circuit_id) continue;
      const existing = map.get(s.circuit_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(s.circuit_id, {
          id: s.circuit_id,
          name: s.circuit_name || 'Inconnu',
          count: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('[Sessions] Fetch used circuits error:', error);
    return [];
  }
}
