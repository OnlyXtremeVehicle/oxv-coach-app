/**
 * Service Admin — Tour de contrôle du jour (PR-28).
 *
 * Agrège, en lecture seule, la photo opérationnelle d'aujourd'hui à partir des
 * tables existantes (events, event_registrations, telemetry_sessions) et de la
 * détection d'anomalies déjà en place. Zéro schéma, admin-only (RLS is_admin).
 *
 * Aucune donnée de télémétrie pilote ici : seulement des comptes opérationnels
 * (inscrits, check-ins, sessions du jour, sessions à surveiller).
 */

import { supabase } from '@/lib/supabase';

import { detectSessionAnomalies } from './adminQualityService';
import { type AdminEvent, listEventRegistrations, listEvents } from './eventsService';

export interface ControlTowerEvent {
  event: AdminEvent;
  ongoing: boolean;
  registered: number;
  checkedIn: number;
}

export interface ControlTower {
  todayEvents: ControlTowerEvent[];
  expectedPilots: number;
  checkedInPilots: number;
  sessionsToday: number;
  anomaliesCount: number;
}

function startOfDayIso(now: Date): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(now: Date): string {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Photo opérationnelle du jour : événements en cours, check-ins, sessions, anomalies. */
export async function loadControlTower(now: Date): Promise<ControlTower> {
  const dayStart = startOfDayIso(now);
  const dayEnd = endOfDayIso(now);
  const nowIso = now.toISOString();

  const all = await listEvents();
  // Événements dont l'intervalle [starts_at, ends_at] croise aujourd'hui, hors
  // brouillon / annulé (non opérationnels).
  const today = all.filter(
    (e) =>
      e.status !== 'draft' &&
      e.status !== 'cancelled' &&
      e.startsAt <= dayEnd &&
      e.endsAt >= dayStart
  );

  const todayEvents: ControlTowerEvent[] = [];
  for (const e of today) {
    const regs = await listEventRegistrations(e.id);
    const checkedIn = regs.filter((r) => r.status === 'checked_in').length;
    todayEvents.push({
      event: e,
      ongoing: e.startsAt <= nowIso && e.endsAt >= nowIso,
      registered: e.currentPilots,
      checkedIn,
    });
  }

  const { count } = await supabase
    .from('telemetry_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', dayStart)
    .lte('started_at', dayEnd);

  const anomalies = await detectSessionAnomalies();

  return {
    todayEvents,
    expectedPilots: todayEvents.reduce((sum, e) => sum + e.registered, 0),
    checkedInPilots: todayEvents.reduce((sum, e) => sum + e.checkedIn, 0),
    sessionsToday: count ?? 0,
    anomaliesCount: anomalies.length,
  };
}
