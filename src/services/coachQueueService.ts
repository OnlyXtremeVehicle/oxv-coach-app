/**
 * File de lecture coach (V9 §14) — chargement + marquage via `coach_queue`.
 *
 * Réutilise `loadReadingQueue` (sessions des pilotes consentis + annotation
 * dérivée) et superpose le statut EXPLICITE de `coach_queue` (posé par le coach).
 * Le marquage (lu / archivé / à relire) est un upsert own-row : la RLS borne au
 * coach courant et à ses pilotes suivis (is_coach_of).
 *
 * Rien de ceci n'est exposé au pilote ni au partenaire (cf. RLS coach_queue).
 */

import { supabase } from '@/lib/supabase';

import { loadReadingQueue } from './coachService';
import { resolveQueueStatus, type QueueItem, type QueueStatus } from './coachQueueLogic';

export interface QueueMutationResult {
  ok: boolean;
  error?: string;
}

/** La file du coach avec statut résolu (explicite coach_queue, sinon dérivé). */
export async function loadCoachQueue(): Promise<QueueItem[]> {
  const [entries, queueRes] = await Promise.all([
    loadReadingQueue(),
    supabase.from('coach_queue').select('telemetry_session_id, status'),
  ]);

  const explicitById = new Map<string, QueueStatus>();
  for (const r of queueRes.data ?? []) {
    const row = r as { telemetry_session_id: string; status: QueueStatus };
    explicitById.set(row.telemetry_session_id, row.status);
  }

  return entries.map((e) => ({
    sessionId: e.sessionId,
    pilotId: e.pilotId,
    pilotName: e.pilotName,
    circuitName: e.circuitName,
    startedAt: e.startedAt,
    status: resolveQueueStatus(explicitById.get(e.sessionId), e.annotated),
  }));
}

/**
 * Pose le statut de lecture d'une séance pour le coach courant (upsert own-row).
 * `coach_id` vient de la session auth ; la RLS vérifie `is_coach_of(pilot_id)`.
 */
export async function setQueueStatus(input: {
  sessionId: string;
  pilotId: string;
  status: QueueStatus;
}): Promise<QueueMutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth?.user?.id;
  if (!coachId) return { ok: false, error: 'Session expirée.' };

  const { error } = await supabase.from('coach_queue').upsert(
    {
      coach_id: coachId,
      pilot_id: input.pilotId,
      telemetry_session_id: input.sessionId,
      status: input.status,
    } as never,
    { onConflict: 'coach_id,telemetry_session_id' }
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}
