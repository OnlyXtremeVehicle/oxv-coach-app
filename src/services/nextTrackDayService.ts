/**
 * Prochaine journée sur circuit (maquette §7.1, bloc « PROCHAINE JOURNÉE » du
 * Paddock). Lit les inscriptions du pilote (site oxvehicle.fr) et retourne la
 * prochaine journée non annulée à venir — rien si aucune (le bloc se masque,
 * honnête). RLS : registrations own-row.
 */

import { supabase } from '@/lib/supabase';

export interface NextTrackDay {
  date: string; // ISO (date de la journée)
  circuitName: string | null;
  startTime: string | null;
}

export interface GetMyNextTrackDayOptions {
  /**
   * true → une erreur DB sur les lectures principales (inscriptions, journées)
   * REJETTE (throw) au lieu de rendre null. Extension ADDITIVE (lot V2-L1,
   * règle « données réelles câblées ») : null reste réservé au VRAI vide
   * (« aucune journée ») pour que l'écran puisse distinguer un état d'erreur
   * honnête d'une absence réelle. Le défaut (non-strict) est inchangé pour
   * les appelants existants. La lecture du NOM de circuit reste best-effort
   * même en strict (une journée réelle sans nom vaut mieux que rien).
   */
  strict?: boolean;
}

export async function getMyNextTrackDay(
  userId: string,
  options: GetMyNextTrackDayOptions = {}
): Promise<NextTrackDay | null> {
  // .neq exclurait les status NULL en PostgREST → .or pour les conserver.
  const { data: regs, error: regsError } = await supabase
    .from('registrations')
    .select('session_id, status')
    .eq('user_id', userId)
    .or('status.is.null,status.neq.cancelled')
    .order('created_at', { ascending: false })
    .limit(100);
  if (options.strict && regsError) {
    throw new Error(`getMyNextTrackDay : ${regsError.message}`);
  }
  const sessionIds = [...new Set((regs ?? []).map((r) => r.session_id).filter(Boolean))];
  if (sessionIds.length === 0) return null;

  // Date LOCALE (pas UTC) : à 0h30 heure de Paris, la journée d'hier est finie.
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, date, start_time, circuit_id, status')
    .in('id', sessionIds)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(5);
  if (options.strict && sessionsError) {
    throw new Error(`getMyNextTrackDay : ${sessionsError.message}`);
  }
  // Une journée ANNULÉE/ARCHIVÉE par OXV ne doit jamais s'afficher comme
  // « prochaine journée », même si l'inscription n'a pas été annulée ligne à
  // ligne. Filtre côté client pour conserver les status NULL.
  const next = (
    (sessions ?? []) as {
      id: string;
      date: string;
      start_time: string | null;
      circuit_id: string | null;
      status: string | null;
    }[]
  ).find((s) => s.status !== 'cancelled' && s.status !== 'archived');
  if (!next) return null;

  let circuitName: string | null = null;
  if (next.circuit_id) {
    const { data: circuit } = await supabase
      .from('circuits')
      .select('name')
      .eq('id', next.circuit_id)
      .maybeSingle();
    circuitName = (circuit as { name?: string } | null)?.name ?? null;
  }
  return { date: next.date, circuitName, startTime: next.start_time ?? null };
}
