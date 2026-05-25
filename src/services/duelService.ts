/**
 * Service Duel pédagogique — comparaison côte à côte avec un ami pilote.
 *
 * Lecture seule des analyses d'un ami. La sécurité repose entièrement
 * sur les RLS étendues (migration 0027) qui autorisent SELECT sur
 * app_session_analyses et telemetry_sessions si `are_friends()` retourne
 * true côté serveur.
 *
 * Si ce service retourne [] alors qu'on s'attendait à des données, c'est
 * que l'amitié n'est pas (ou plus) acceptée — RGPD respecté côté DB.
 *
 * Voir migration 20260526120000_0027_pilot_friendships.sql.
 */

import { supabase } from '@/lib/supabase';
import type { MarginZone } from '@/types/domain';

export interface DuelSessionRow {
  sessionId: string;
  circuitName: string | null;
  startedAt: string;
  marginGlobal: number | null;
  marginZone: MarginZone | null;
}

export interface AggregatedStats {
  count: number;
  marginAvg: number | null;
  marginBest: number | null;
  marginZoneDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
}

interface JoinedRow {
  id: string;
  user_id: string;
  margin_global: number | null;
  margin_zone: string | null;
  computed_at: string;
  telemetry_session_id: string;
  // Jointure session
  telemetry_sessions?: {
    id: string;
    started_at: string | null;
    circuit_name: string | null;
  } | null;
}

/**
 * Liste les N dernières sessions analysées d'un ami.
 * Retourne [] si pas amis ou pas de sessions.
 */
export async function loadFriendSessionList(
  friendId: string,
  limit = 20
): Promise<DuelSessionRow[]> {
  const { data, error } = await supabase
    .from('app_session_analyses')
    .select(
      `id, user_id, margin_global, margin_zone, computed_at, telemetry_session_id,
       telemetry_sessions(id, started_at, circuit_name)`
    )
    .eq('user_id', friendId)
    .order('computed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[duel] loadFriendSessionList error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as JoinedRow[]).map((row) => ({
    sessionId: row.telemetry_session_id,
    circuitName: row.telemetry_sessions?.circuit_name ?? null,
    startedAt: row.telemetry_sessions?.started_at ?? row.computed_at,
    marginGlobal: row.margin_global,
    marginZone: (row.margin_zone as MarginZone | null) ?? null,
  }));
}

/**
 * Charge une analyse spécifique d'un ami.
 * Retourne null si pas amis ou session pas analysée.
 */
export async function loadFriendAnalysisForSession(
  friendId: string,
  sessionId: string
): Promise<DuelSessionRow | null> {
  const { data, error } = await supabase
    .from('app_session_analyses')
    .select(
      `id, user_id, margin_global, margin_zone, computed_at, telemetry_session_id,
       telemetry_sessions(id, started_at, circuit_name)`
    )
    .eq('user_id', friendId)
    .eq('telemetry_session_id', sessionId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[duel] loadFriendAnalysisForSession error:', error.message);
    return null;
  }
  const row = data as unknown as JoinedRow;
  return {
    sessionId: row.telemetry_session_id,
    circuitName: row.telemetry_sessions?.circuit_name ?? null,
    startedAt: row.telemetry_sessions?.started_at ?? row.computed_at,
    marginGlobal: row.margin_global,
    marginZone: (row.margin_zone as MarginZone | null) ?? null,
  };
}

/**
 * Calcule des stats agrégées sur les N dernières sessions d'un pilote
 * (ami ou self). Utilisé pour le mode « Agrégé » du duel.
 *
 * Note : on calcule côté client à partir des analyses brutes. Pas optimisé
 * pour les très gros volumes mais largement OK pour < 100 sessions.
 */
export async function loadAggregatedStats(
  pilotId: string,
  lastN: number
): Promise<AggregatedStats> {
  const { data, error } = await supabase
    .from('app_session_analyses')
    .select('margin_global, margin_zone')
    .eq('user_id', pilotId)
    .order('computed_at', { ascending: false })
    .limit(lastN);

  const empty: AggregatedStats = {
    count: 0,
    marginAvg: null,
    marginBest: null,
    marginZoneDistribution: { green: 0, yellow: 0, red: 0 },
  };

  if (error || !data || data.length === 0) {
    if (error) console.warn('[duel] loadAggregatedStats error:', error.message);
    return empty;
  }

  const margins = data
    .map((r) => (r as { margin_global: number | null }).margin_global)
    .filter((m): m is number => typeof m === 'number');

  if (margins.length === 0) return empty;

  const sum = margins.reduce((acc, m) => acc + m, 0);
  const avg = sum / margins.length;
  const best = Math.max(...margins);

  const distribution = { green: 0, yellow: 0, red: 0 };
  for (const r of data) {
    const z = (r as { margin_zone: string | null }).margin_zone;
    if (z === 'green' || z === 'yellow' || z === 'red') {
      distribution[z] += 1;
    }
  }

  return {
    count: margins.length,
    marginAvg: avg,
    marginBest: best,
    marginZoneDistribution: distribution,
  };
}
