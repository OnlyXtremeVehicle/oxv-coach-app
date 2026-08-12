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
  /**
   * Identifiant de la séance commerciale. Le service le LISAIT déjà (`select
   * 'id, …'`) et le jetait : aucun appelant ne pouvait relier la journée
   * affichée à sa ligne en base.
   */
  sessionId: string;
  /**
   * Circuit de la journée. Il était lu, employé pour aller chercher le NOM,
   * puis jeté — si bien que l'écran d'armement, à deux pas de là, ne pouvait
   * pas savoir sur quel tracé le pilote venait rouler. C'est ce qui a fait
   * partir la séance du 13/08/2026 sur Haute Saintonge.
   */
  circuitId: string | null;
  /** Heure de fin déclarée (`HH:MM:SS`), pour savoir si la journée est finie. */
  endTime: string | null;
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

  /**
   * LA VEILLE EST INCLUSE, ET CE N'EST PAS UN CONFORT.
   *
   * Le filtre valait `date >= aujourd'hui`. Une journée de NUIT — 22h00 → 02h00,
   * datée de la veille — disparaissait donc de l'application à minuit pile,
   * pendant que le pilote roulait encore. Et comme tout le chemin vers
   * l'armement pend à cette lecture, c'est la capture entière qui s'évanouissait
   * en pleine séance.
   *
   * On élargit d'un jour, et on écarte ensuite côté client les journées
   * RÉELLEMENT terminées — en comparant à l'heure de fin, pas à la date. Le
   * bon critère n'a jamais été le jour, c'est la fin de la séance.
   */
  const d = new Date();
  const jourLocal = (decalage: number) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + decalage);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, date, start_time, end_time, circuit_id, status')
    .in('id', sessionIds)
    .gte('date', jourLocal(-1))
    .order('date', { ascending: true })
    .limit(10);
  if (options.strict && sessionsError) {
    throw new Error(`getMyNextTrackDay : ${sessionsError.message}`);
  }

  type Ligne = {
    id: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    circuit_id: string | null;
    status: string | null;
  };

  /** Instant de FIN de la journée, minuit passé compris. */
  const finDe = (s: Ligne): number => {
    const debut = new Date(`${s.date}T${(s.start_time ?? '00:00:00').slice(0, 8)}`).getTime();
    let fin = new Date(`${s.date}T${(s.end_time ?? '23:59:59').slice(0, 8)}`).getTime();
    if (!Number.isFinite(fin)) return Number.POSITIVE_INFINITY;
    // Fin < début : la journée franchit minuit, sa fin appartient au lendemain.
    if (Number.isFinite(debut) && fin < debut) fin += 24 * 60 * 60 * 1000;
    return fin;
  };

  // Une journée ANNULÉE/ARCHIVÉE par OXV ne doit jamais s'afficher comme
  // « prochaine journée », même si l'inscription n'a pas été annulée ligne à
  // ligne. Filtre côté client pour conserver les status NULL.
  const maintenant = d.getTime();
  const next = ((sessions ?? []) as Ligne[])
    .filter((s) => s.status !== 'cancelled' && s.status !== 'archived')
    .filter((s) => finDe(s) >= maintenant)
    .sort((a, b) => finDe(a) - finDe(b))[0];
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
  return {
    date: next.date,
    circuitName,
    startTime: next.start_time ?? null,
    endTime: next.end_time ?? null,
    sessionId: next.id,
    circuitId: next.circuit_id ?? null,
  };
}
