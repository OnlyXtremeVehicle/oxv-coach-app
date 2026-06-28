/**
 * Service support — côté ADMIN (migration 0020). Traite la file de tickets :
 * priorise (P0 en tête), change le statut, répond (is_admin=true).
 *
 * RLS : `is_admin()` voit tous les tickets/messages et seul peut modifier
 * statut/priorité. Aucune télémétrie portée par ces tables.
 */

import { supabase } from '@/lib/supabase';

import type { SupportPriority, SupportStatus, SupportTicket } from './supportService';

const TICKET_COLS =
  'id, user_id, category, subject, status, priority, session_id, device_id, created_at, updated_at';

function mapTicket(r: Record<string, unknown>): SupportTicket {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    category: r.category as SupportTicket['category'],
    subject: r.subject as string,
    status: r.status as SupportStatus,
    priority: r.priority as SupportPriority,
    sessionId: (r.session_id as string | null) ?? null,
    deviceId: (r.device_id as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export interface AdminTicketFilter {
  /** Statut exact, ou `undefined`/'all' pour tout. */
  status?: SupportStatus | 'all';
  /** Masquer les tickets clos (resolu/ferme). Défaut false. */
  hideClosed?: boolean;
}

/**
 * File de tickets pour l'admin : **P0 en tête** (priorité croissante p0→p3),
 * puis du plus récent au plus ancien.
 */
export async function listAllTickets(filter: AdminTicketFilter = {}): Promise<SupportTicket[]> {
  let q = supabase
    .from('support_tickets')
    .select(TICKET_COLS)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (filter.status && filter.status !== 'all') {
    q = q.eq('status', filter.status);
  }

  const { data, error } = await q;
  if (error) {
    console.warn('[OXV][support][admin] listAllTickets :', error.message);
    return [];
  }
  let rows = (data ?? []).map((r) => mapTicket(r as Record<string, unknown>));
  if (filter.hideClosed) {
    rows = rows.filter((t) => t.status !== 'resolu' && t.status !== 'ferme');
  }
  return rows;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

/** Change le statut d'un ticket (admin only, garanti par la RLS). */
export async function setTicketStatus(
  ticketId: string,
  status: SupportStatus
): Promise<MutationResult> {
  const { error } = await supabase
    .from('support_tickets')
    .update({ status } as never)
    .eq('id', ticketId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Change la priorité d'un ticket (admin only). */
export async function setTicketPriority(
  ticketId: string,
  priority: SupportPriority
): Promise<MutationResult> {
  const { error } = await supabase
    .from('support_tickets')
    .update({ priority } as never)
    .eq('id', ticketId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Réponse de l'admin (is_admin=true, auteur = admin courant). */
export async function replyAsAdmin(ticketId: string, body: string): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };
  const text = body.trim();
  if (text.length === 0) return { ok: false, error: 'Message vide.' };

  const { error } = await supabase
    .from('support_messages')
    .insert({ ticket_id: ticketId, author_id: uid, body: text, is_admin: true } as never);
  return error ? { ok: false, error: error.message } : { ok: true };
}
