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
  uniquePilots: number;
  avgMarginPct: number | null;
  /**
   * SIX COMPTES QUI PEUVENT VALOIR « INCONNU ».
   *
   * `null` = la requête a échoué. Ils valaient `number` et retombaient sur `0` :
   * « 0 pilote · 0 coach · 0 partenaire validé » s'affichait comme un fait sur
   * l'écran même où l'on juge la santé de la plateforme.
   */
  sessions30d: number | null;
  pilotsCount: number | null;
  coachesCount: number | null;
  partnersValidated: number | null;
  eventsTotal: number | null;
  eventsUpcoming: number | null;
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

  // CHAQUE COMPTE LIT SON ERREUR.
  //
  // Les six requêtes `head: true` étaient déstructurées sans jamais consulter
  // `error` : Supabase rend alors `count: null`, et `?? 0` transformait chacune
  // en un compte de zéro. « 0 pilote », « 0 coach », « 0 partenaire validé »
  // s'affichaient comme des faits mesurés alors que la lecture avait échoué —
  // et c'est l'écran sur lequel on juge la santé de la plateforme.
  //
  // Relevé par la cartographie du 02/08/2026.
  return {
    totalSessions: sessions.length,
    sessions30d: compte(sessions30d),
    uniquePilots,
    avgMarginPct,
    pilotsCount: compte(pilots),
    coachesCount: compte(coaches),
    partnersValidated: compte(partners),
    eventsTotal: compte(eventsTotal),
    eventsUpcoming: compte(eventsUpcoming),
  };
}

/**
 * Un compte lu, ou `null` si la lecture n'a pas abouti.
 *
 * `null` n'est pas `0`. Le premier se tait, le second affirme.
 */
function compte(res: { count: number | null; error: unknown }): number | null {
  if (res.error !== null && res.error !== undefined) return null;
  return typeof res.count === 'number' && Number.isFinite(res.count) ? res.count : null;
}
