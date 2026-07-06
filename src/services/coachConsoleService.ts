/**
 * Console de direction coach — chargement (P4, VISION_COACH_STUDIO.md).
 *
 * État de CHAQUE pilote suivi (consenti) : dernière séance + tendance de marge
 * vs SA propre séance précédente. **Aucun classement inter-pilotes** (C1). Pas
 * de temps réel (le boîtier enregistre puis synchronise) : c'est l'état « à la
 * dernière synchro ». RLS : le coach ne voit que les séances des pilotes
 * consentis (policies coach_select existantes).
 */

import { computeSelfTrend, latestPerPilot, type SelfTrend } from '@/services/coachConsoleLogic';
import { listMyPilots } from '@/services/coachService';
import { supabase } from '@/lib/supabase';
import type { MarginZone } from '@/types/domain';

export interface ConsolePilotStatus {
  pilotId: string;
  name: string;
  pilotLevel: string | null;
  lastSessionId: string | null;
  lastSessionAt: string | null;
  circuitName: string | null;
  lapCount: number | null;
  status: string | null;
  marginGlobal: number | null;
  marginZone: MarginZone | null;
  /** Tendance de la marge vs la séance précédente DU MÊME pilote (factuel). */
  trend: SelfTrend;
}

interface SessionRow {
  id: string;
  userId: string;
  startedAt: string | null;
  circuitName: string | null;
  lapCount: number | null;
  status: string | null;
}

export async function listConsoleStatus(): Promise<ConsolePilotStatus[]> {
  const pilots = await listMyPilots();
  if (pilots.length === 0) return [];
  const pilotIds = pilots.map((p) => p.pilotId);

  // Séances des pilotes suivis, plus récentes d'abord (RLS coach consenti).
  const { data: rows } = await supabase
    .from('telemetry_sessions')
    .select('id, user_id, started_at, circuit_name, lap_count, status')
    .in('user_id', pilotIds)
    .order('started_at', { ascending: false });
  const sessions: SessionRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    startedAt: r.started_at ?? null,
    circuitName: r.circuit_name ?? null,
    lapCount: r.lap_count ?? null,
    status: r.status ?? null,
  }));
  const byPilot = latestPerPilot(sessions);

  // Marges des deux dernières séances de chaque pilote → tendance vs soi.
  const relevantSessionIds = [...byPilot.values()]
    .flatMap((list) => list.slice(0, 2))
    .map((s) => s.id);
  const marginBySession = new Map<string, { global: number | null; zone: MarginZone | null }>();
  if (relevantSessionIds.length > 0) {
    const { data: analyses } = await supabase
      .from('app_session_analyses')
      .select('telemetry_session_id, margin_global, margin_zone')
      .in('telemetry_session_id', relevantSessionIds);
    for (const a of analyses ?? []) {
      marginBySession.set(a.telemetry_session_id, {
        global: a.margin_global,
        zone: (a.margin_zone as MarginZone | null) ?? null,
      });
    }
  }

  return pilots.map((p) => {
    const list = byPilot.get(p.pilotId) ?? [];
    const last = list[0];
    const prev = list[1];
    const lastMargin = last ? (marginBySession.get(last.id)?.global ?? null) : null;
    const prevMargin = prev ? (marginBySession.get(prev.id)?.global ?? null) : null;
    return {
      pilotId: p.pilotId,
      name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Pilote',
      pilotLevel: p.pilotLevel,
      lastSessionId: last?.id ?? null,
      lastSessionAt: last?.startedAt ?? null,
      circuitName: last?.circuitName ?? null,
      lapCount: last?.lapCount ?? null,
      status: last?.status ?? null,
      marginGlobal: lastMargin,
      marginZone: last ? (marginBySession.get(last.id)?.zone ?? null) : null,
      trend: computeSelfTrend(lastMargin, prevMargin),
    };
  });
}
