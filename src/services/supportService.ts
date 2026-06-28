/**
 * Service support — canal de contact pilote ⇄ admin (migration 0020).
 *
 * Côté pilote : créer un ticket (dont demande RGPD), suivre ses tickets, répondre.
 * Les fonctions admin (traiter / prioriser) vivent dans `supportAdminService`.
 *
 * RLS : le pilote ne voit/écrit QUE ses tickets et leurs messages ; l'auteur
 * d'un message est toujours l'appelant. AUCUNE télémétrie n'est portée par ces
 * tables (au plus une référence `session_id`/`device_id`).
 */

import { supabase } from '@/lib/supabase';

export type SupportCategory = 'equipement' | 'bilan' | 'data' | 'coach' | 'rgpd';
export type SupportStatus = 'nouveau' | 'ouvert' | 'en_cours' | 'resolu' | 'ferme';
export type SupportPriority = 'p0' | 'p1' | 'p2' | 'p3';

export interface SupportTicket {
  id: string;
  userId: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  sessionId: string | null;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
}

/** Libellés humains des catégories (vouvoiement, sobre). */
export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: 'equipement', label: 'Équipement' },
  { value: 'bilan', label: 'Bilan' },
  { value: 'data', label: 'Données' },
  { value: 'coach', label: 'Question coach' },
  { value: 'rgpd', label: 'Demande RGPD' },
];

const TICKET_COLS =
  'id, user_id, category, subject, status, priority, session_id, device_id, created_at, updated_at';
const MESSAGE_COLS = 'id, ticket_id, author_id, body, is_admin, created_at';

function mapTicket(r: Record<string, unknown>): SupportTicket {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    category: r.category as SupportCategory,
    subject: r.subject as string,
    status: r.status as SupportStatus,
    priority: r.priority as SupportPriority,
    sessionId: (r.session_id as string | null) ?? null,
    deviceId: (r.device_id as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapMessage(r: Record<string, unknown>): SupportMessage {
  return {
    id: r.id as string,
    ticketId: r.ticket_id as string,
    authorId: r.author_id as string,
    body: r.body as string,
    isAdmin: Boolean(r.is_admin),
    createdAt: r.created_at as string,
  };
}

/** Mes tickets (RLS : own-row), du plus récent au plus ancien. */
export async function listMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(TICKET_COLS)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][support] listMyTickets :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapTicket(r as Record<string, unknown>));
}

export interface CreateTicketInput {
  category: SupportCategory;
  subject: string;
  message?: string;
  sessionId?: string | null;
  deviceId?: string | null;
}

export interface CreateTicketResult {
  ok: boolean;
  ticketId?: string;
  error?: string;
}

/** Crée un ticket (user = appelant) + un premier message optionnel. */
export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  const subject = input.subject.trim();
  if (subject.length === 0) return { ok: false, error: 'Indiquez un objet.' };

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: uid,
      category: input.category,
      subject,
      session_id: input.sessionId ?? null,
      device_id: input.deviceId ?? null,
    } as never)
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Création impossible.' };
  }
  const ticketId = (data as { id: string }).id;

  const body = input.message?.trim();
  if (body) {
    const { error: msgErr } = await supabase
      .from('support_messages')
      .insert({ ticket_id: ticketId, author_id: uid, body, is_admin: false } as never);
    if (msgErr) console.warn('[OXV][support] createTicket message :', msgErr.message);
  }
  return { ok: true, ticketId };
}

export interface TicketThread {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

/** Un ticket et son fil (RLS : propriétaire ou admin). */
export async function getTicketThread(ticketId: string): Promise<TicketThread | null> {
  const { data: t, error: tErr } = await supabase
    .from('support_tickets')
    .select(TICKET_COLS)
    .eq('id', ticketId)
    .maybeSingle();
  if (tErr || !t) return null;

  const { data: msgs, error: mErr } = await supabase
    .from('support_messages')
    .select(MESSAGE_COLS)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (mErr) console.warn('[OXV][support] getTicketThread messages :', mErr.message);

  return {
    ticket: mapTicket(t as Record<string, unknown>),
    messages: (msgs ?? []).map((r) => mapMessage(r as Record<string, unknown>)),
  };
}

export interface ReplyResult {
  ok: boolean;
  error?: string;
}

/** Réponse du pilote à SON ticket (is_admin=false). */
export async function replyToTicket(ticketId: string, body: string): Promise<ReplyResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };
  const text = body.trim();
  if (text.length === 0) return { ok: false, error: 'Message vide.' };

  const { error } = await supabase
    .from('support_messages')
    .insert({ ticket_id: ticketId, author_id: uid, body: text, is_admin: false } as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
