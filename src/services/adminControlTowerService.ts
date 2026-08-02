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
  /**
   * CHAQUE MESURE PEUT VALOIR « INCONNUE ».
   *
   * `null` = la lecture n'a pas abouti. Ces champs valaient `number` et
   * retombaient sur `0` : un réseau coupé affichait « 0 pilote attendu · 0
   * pointé · 0 session », c'est-à-dire le tableau d'une journée où personne ne
   * serait venu. L'administrateur y lisait un fait ; c'était une panne.
   *
   * Une mesure peut manquer sans que les autres manquent : elles sont lues
   * séparément, et une seule requête en échec ne doit pas noircir l'écran
   * entier. Relevé par la cartographie du 02/08/2026.
   */
  expectedPilots: number | null;
  checkedInPilots: number | null;
  sessionsToday: number | null;
  anomaliesCount: number | null;
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

  // LES ÉVÉNEMENTS DU JOUR. Un échec ici rend TOUT le bloc inconnu : sans la
  // liste, ni les attendus ni les pointés n'ont de sens.
  let todayEvents: ControlTowerEvent[] | null = null;
  try {
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

    const liste: ControlTowerEvent[] = [];
    for (const e of today) {
      const regs = await listEventRegistrations(e.id);
      const checkedIn = regs.filter((r) => r.status === 'checked_in').length;
      liste.push({
        event: e,
        ongoing: e.startsAt <= nowIso && e.endsAt >= nowIso,
        registered: e.currentPilots,
        checkedIn,
      });
    }
    todayEvents = liste;
  } catch {
    todayEvents = null;
  }

  // LES SÉANCES DU JOUR. `error` était ignoré : Supabase rend `count: null` sur
  // échec, et `?? 0` transformait la panne en un compte de zéro.
  const { count, error: erreurSeances } = await supabase
    .from('telemetry_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', dayStart)
    .lte('started_at', dayEnd);
  const sessionsToday = erreurSeances !== null || typeof count !== 'number' ? null : count;

  // LES SÉANCES À SURVEILLER. Zéro anomalie est une bonne nouvelle ; ne pas
  // avoir pu regarder n'en est pas une.
  let anomaliesCount: number | null = null;
  try {
    anomaliesCount = (await detectSessionAnomalies()).length;
  } catch {
    anomaliesCount = null;
  }

  return {
    todayEvents: todayEvents ?? [],
    expectedPilots:
      todayEvents === null ? null : todayEvents.reduce((sum, e) => sum + e.registered, 0),
    checkedInPilots:
      todayEvents === null ? null : todayEvents.reduce((sum, e) => sum + e.checkedIn, 0),
    sessionsToday,
    anomaliesCount,
  };
}
