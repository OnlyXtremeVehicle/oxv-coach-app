/**
 * Hook de données du Support (lot V2-L4, mission D, écran 8/8).
 *
 * Liste des tickets du pilote, création d'une demande, et fil d'un ticket
 * (ouvert dans un Sheet) avec réponse. Services v1 inchangés (supportService,
 * RLS own-row) — habillage v2 seulement. Erreurs remontées, jamais masquées.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  createTicket,
  getTicketThread,
  listMyTickets,
  replyToTicket,
  type SupportCategory,
  type SupportTicket,
  type TicketThread,
} from '@/services/supportService';

export function useSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Composer (nouvelle demande)
  const [category, setCategory] = useState<SupportCategory>('equipement');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Fil (Sheet)
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await listMyTickets();
      setTickets(rows);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyTickets();
        if (!cancelled) {
          setTickets(rows);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitTicket = useCallback(async (): Promise<boolean> => {
    if (sending) return false;
    setSending(true);
    setComposerError(null);
    const res = await createTicket({ category, subject, message: message || undefined });
    setSending(false);
    if (res.ok) {
      setSubject('');
      setMessage('');
      setCategory('equipement');
      await reload();
      return true;
    }
    setComposerError(res.error ?? "L'envoi n'a pas pu aboutir.");
    return false;
  }, [sending, category, subject, message, reload]);

  const openThread = useCallback(async (ticketId: string) => {
    setThread(null);
    setReply('');
    setThreadError(null);
    setThreadLoading(true);
    const t = await getTicketThread(ticketId);
    setThreadLoading(false);
    setThread(t);
  }, []);

  const closeThread = useCallback(() => {
    setThread(null);
    setReply('');
    setThreadError(null);
  }, []);

  const submitReply = useCallback(async () => {
    if (!thread || replying) return;
    setReplying(true);
    setThreadError(null);
    const res = await replyToTicket(thread.ticket.id, reply);
    setReplying(false);
    if (res.ok) {
      setReply('');
      const refreshed = await getTicketThread(thread.ticket.id);
      setThread(refreshed);
      await reload();
    } else {
      setThreadError(res.error ?? "L'envoi n'a pas pu aboutir.");
    }
  }, [thread, replying, reply, reload]);

  return {
    tickets,
    status,
    reload,
    // composer
    category,
    setCategory,
    subject,
    setSubject,
    message,
    setMessage,
    sending,
    composerError,
    submitTicket,
    // thread
    thread,
    threadLoading,
    reply,
    setReply,
    replying,
    threadError,
    openThread,
    closeThread,
    submitReply,
  };
}
