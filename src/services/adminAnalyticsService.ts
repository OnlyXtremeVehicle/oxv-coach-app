/**
 * Service Admin — Business Dashboard / Analytique (PR-84).
 *
 * Agrège, en lecture seule, des métriques business dérivées des tables existantes
 * (telemetry_sessions, app_session_analyses, users, partner_accounts, events).
 * Zéro schéma, admin-only (RLS is_admin). Back-office : volumes et comptes
 * opérationnels, jamais un classement entre pilotes (doctrine E1).
 */

import { supabase } from '@/lib/supabase';

export interface BusinessAnalytics {
  totalSessions: number;
  sessions30d: number;
  uniquePilots: number;
  avgMarginPct: number | null;
  pilotsCount: number;
  coachesCount: number;
  partnersValidated: number;
  eventsTotal: number;
  eventsUpcoming: number;
}

/** Charge le tableau de bord business. `null` si la lecture de base échoue. */
export async function loadBusinessAnalytics(now: Date): Promise<BusinessAnalytics | null> {
  const from30 = new Date(now);
  from30.setDate(from30.getDate() - 30);
  const from30Iso = from30.toISOString();
  const nowIso = now.toISOString();

  const [sessionsRes, analysesRes] = await Promise.all([
    supabase.from('telemetry_sessions').select('user_id').eq('status', 'completed'),
    supabase.from('app_session_analyses').select('margin_global'),
  ]);
  if (sessionsRes.error || analysesRes.error) {
    if (sessionsRes.error)
      console.warn('[OXV][admin] analytics sessions :', sessionsRes.error.message);
    return null;
  }

  const sessions = sessionsRes.data ?? [];
  const uniquePilots = new Set(sessions.map((s) => s.user_id)).size;
  const margins = (analysesRes.data ?? [])
    .map((a) => Number(a.margin_global ?? 0))
    .filter((m) => Number.isFinite(m) && m > 0);
  const avgMarginPct =
    margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : null;

  // Comptes head-only (rapides) en parallèle.
  const [sessions30d, pilots, coaches, partners, eventsTotal, eventsUpcoming] = await Promise.all([
    supabase
      .from('telemetry_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('started_at', from30Iso),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('role', ['pilot', 'pro_pilot']),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'coach'),
    supabase
      .from('partner_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'validated'),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }).gte('starts_at', nowIso),
  ]);

  return {
    totalSessions: sessions.length,
    sessions30d: sessions30d.count ?? 0,
    uniquePilots,
    avgMarginPct,
    pilotsCount: pilots.count ?? 0,
    coachesCount: coaches.count ?? 0,
    partnersValidated: partners.count ?? 0,
    eventsTotal: eventsTotal.count ?? 0,
    eventsUpcoming: eventsUpcoming.count ?? 0,
  };
}
