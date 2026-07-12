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

export async function getMyNextTrackDay(userId: string): Promise<NextTrackDay | null> {
  const { data: regs } = await supabase
    .from('registrations')
    .select('session_id, status')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .limit(50);
  const sessionIds = [...new Set((regs ?? []).map((r) => r.session_id).filter(Boolean))];
  if (sessionIds.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, date, start_time, circuit_id')
    .in('id', sessionIds)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1);
  const next = (sessions ?? [])[0] as
    | { id: string; date: string; start_time: string | null; circuit_id: string | null }
    | undefined;
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
