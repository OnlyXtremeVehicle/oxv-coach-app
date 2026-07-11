/**
 * coachMessagesService — messagerie coach↔pilote (durable, table `coach_messages`).
 *
 * Fil ATTRIBUÉ (sender_id), SANS coordonnées (RGPD : la table ne porte que le
 * texte). RLS : les deux membres lisent ; l'expéditeur = auth.uid() et le binôme
 * doit être actif + consenti. L'affichage temps réel passe par Supabase Realtime
 * (postgres_changes), la persistance vit dans la table.
 *
 * Doctrine : c'est le COACH (ou le pilote) qui parle, jamais « l'app ». Aucune
 * coordonnée n'est exposée. Le fil n'existe que si le pilote a consenti.
 */

import { supabase } from '@/lib/supabase';

export interface CoachMessage {
  id: string;
  coachPilotId: string;
  senderId: string;
  body: string;
  sessionId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface MessageThread {
  coachPilotId: string;
  coachId: string;
  pilotId: string;
  /** Nom de l'autre membre (celui qui n'est pas le user courant). */
  otherName: string;
  lastBody: string | null;
  lastAt: string | null;
  /** Messages reçus non lus (envoyés par l'autre, read_at null). */
  unread: number;
}

interface UserLite {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
}

function nameOf(u: UserLite | UserLite[] | null | undefined): string {
  const one = Array.isArray(u) ? u[0] : u;
  return [one?.first_name, one?.last_name].filter(Boolean).join(' ') || 'Pilote';
}

/** Les fils du user courant (binômes actifs + consentis), avec dernier message + non-lus. */
export async function listMyThreads(currentUserId: string): Promise<MessageThread[]> {
  const { data: pairs, error } = await supabase
    .from('coach_pilots')
    .select(
      'id, coach_id, pilot_id, coach:users!coach_pilots_coach_id_fkey(id, first_name, last_name), pilot:users!coach_pilots_pilot_id_fkey(id, first_name, last_name)'
    )
    .eq('active', true)
    .not('pilot_consent_at', 'is', null);
  if (error || !pairs) return [];

  const ids = pairs.map((p) => (p as { id: string }).id);
  if (ids.length === 0) return [];

  const { data: msgs } = await supabase
    .from('coach_messages')
    .select('coach_pilot_id, sender_id, body, created_at, read_at')
    .in('coach_pilot_id', ids)
    .order('created_at', { ascending: false });

  type MsgRow = {
    coach_pilot_id: string;
    sender_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
  };
  const byPair = new Map<string, { last?: MsgRow; unread: number }>();
  for (const m of msgs ?? []) {
    const row = m as MsgRow;
    const acc = byPair.get(row.coach_pilot_id) ?? { unread: 0 };
    if (!acc.last) acc.last = row; // msgs triés desc → le 1er vu est le dernier
    if (row.read_at === null && row.sender_id !== currentUserId) acc.unread += 1;
    byPair.set(row.coach_pilot_id, acc);
  }

  return pairs.map((p) => {
    const row = p as unknown as {
      id: string;
      coach_id: string;
      pilot_id: string;
      coach: UserLite | UserLite[] | null;
      pilot: UserLite | UserLite[] | null;
    };
    const iAmCoach = row.coach_id === currentUserId;
    const acc = byPair.get(row.id);
    const last = acc?.last as { body?: string; created_at?: string } | undefined;
    return {
      coachPilotId: row.id,
      coachId: row.coach_id,
      pilotId: row.pilot_id,
      otherName: iAmCoach ? nameOf(row.pilot) : nameOf(row.coach),
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? null,
      unread: acc?.unread ?? 0,
    };
  });
}

/** Les messages d'un fil, du plus ancien au plus récent. */
export async function listThreadMessages(coachPilotId: string): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, coach_pilot_id, sender_id, body, session_id, created_at, read_at')
    .eq('coach_pilot_id', coachPilotId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((m) => {
    const r = m as {
      id: string;
      coach_pilot_id: string;
      sender_id: string;
      body: string;
      session_id: string | null;
      created_at: string;
      read_at: string | null;
    };
    return {
      id: r.id,
      coachPilotId: r.coach_pilot_id,
      senderId: r.sender_id,
      body: r.body,
      sessionId: r.session_id,
      createdAt: r.created_at,
      readAt: r.read_at,
    };
  });
}

/** Envoie un message (sender_id = user courant). Le binôme doit être consenti (RLS). */
export async function sendMessage(input: {
  coachPilotId: string;
  coachId: string;
  pilotId: string;
  senderId: string;
  body: string;
  sessionId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'empty' };
  const { error } = await supabase.from('coach_messages').insert({
    coach_pilot_id: input.coachPilotId,
    coach_id: input.coachId,
    pilot_id: input.pilotId,
    sender_id: input.senderId,
    body: body.slice(0, 2000),
    session_id: input.sessionId ?? null,
  });
  if (error) {
    console.warn('[OXV][messages] sendMessage :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Marque comme lus les messages REÇUS (envoyés par l'autre) d'un fil. */
export async function markThreadRead(coachPilotId: string, currentUserId: string): Promise<void> {
  await supabase
    .from('coach_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('coach_pilot_id', coachPilotId)
    .neq('sender_id', currentUserId)
    .is('read_at', null);
}
