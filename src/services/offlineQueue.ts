/**
 * File d'attente d'écritures différées.
 *
 * Les écritures critiques (acceptation pacte, marquage notification lu,
 * ajout marqueur Flic, etc.) sont d'abord poussées dans MMKV. Quand le
 * réseau revient (cf. [[netinfo]]), `flushQueue()` rejoue chaque action
 * contre Supabase dans l'ordre FIFO.
 *
 * Doctrine : ces actions doivent être **idempotentes** côté serveur
 * (utiliser `upsert` ou contraintes UNIQUE) — si une action est rejouée
 * deux fois suite à un crash, le résultat doit être identique.
 *
 * Gestion d'échec : 5 tentatives max par action, puis abandon avec log.
 * Aucun mécanisme de DLQ en V1 — si une action échoue 5x, on la perd.
 * Acceptable pour les actions de la V1 (toutes optionnelles).
 */

import { storage, STORAGE_KEYS } from '@/lib/mmkv';
import { supabase } from '@/lib/supabase';

export type QueuedActionKind =
  | 'accept_pact'
  | 'mark_notification_read'
  | 'register_lap_marker'
  | 'update_pilot_level';

export interface QueuedAction {
  id: string;
  kind: QueuedActionKind;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

function readQueue(): QueuedAction[] {
  const raw = storage.getString(STORAGE_KEYS.OFFLINE_QUEUE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedAction[];
  } catch {
    storage.delete(STORAGE_KEYS.OFFLINE_QUEUE);
    return [];
  }
}

function writeQueue(queue: QueuedAction[]): void {
  storage.set(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueueAction(input: {
  kind: QueuedActionKind;
  payload: Record<string, unknown>;
}): string {
  const action: QueuedAction = {
    id: genId(),
    kind: input.kind,
    payload: input.payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  writeQueue([...readQueue(), action]);
  return action.id;
}

export function getQueue(): QueuedAction[] {
  return readQueue();
}

export function clearQueue(): void {
  storage.delete(STORAGE_KEYS.OFFLINE_QUEUE);
}

export async function flushQueue(): Promise<{
  succeeded: number;
  failed: number;
  remaining: number;
}> {
  const queue = readQueue();
  if (queue.length === 0) {
    return { succeeded: 0, failed: 0, remaining: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      await executeAction(action);
      succeeded++;
    } catch (err) {
      const next: QueuedAction = { ...action, attempts: action.attempts + 1 };
      if (next.attempts < MAX_ATTEMPTS) {
        remaining.push(next);
      } else {
        console.warn(
          `[OXV] Action ${action.kind} (${action.id}) abandonnée après ${MAX_ATTEMPTS} tentatives :`,
          err
        );
      }
      failed++;
    }
  }

  writeQueue(remaining);
  return { succeeded, failed, remaining: remaining.length };
}

async function executeAction(action: QueuedAction): Promise<void> {
  switch (action.kind) {
    case 'accept_pact': {
      const { userId, pactVersion } = action.payload as {
        userId: string;
        pactVersion: string;
      };
      // Miroir du couple online acceptPact() + completeOnboarding() : on écrit
      // pact_accepted_at (horodaté à l'instant du tap = valeur juridique),
      // pact_version ET profile_completed_at en une seule update. Sans
      // pact_accepted_at, isOnboardingComplete() renvoie false pour un pilote
      // et le re-route en onboarding à chaque boot.
      const { error } = await supabase
        .from('users')
        .update({
          pact_accepted_at: new Date(action.createdAt).toISOString(),
          pact_version: pactVersion,
          profile_completed_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
      return;
    }

    case 'mark_notification_read': {
      // Placeholder : le wiring effectif viendra avec l'écran #23 (sem. 10).
      // L'action ne fait rien côté serveur pour l'instant ; on la conserve
      // dans la file pour valider la mécanique.
      return;
    }

    case 'register_lap_marker': {
      // Placeholder : viendra avec le bouton Flic en sem. 4.
      return;
    }

    case 'update_pilot_level': {
      const { userId, level } = action.payload as {
        userId: string;
        level: string;
      };
      const { error } = await supabase
        .from('users')
        .update({ pilot_level: level })
        .eq('id', userId);
      if (error) throw error;
      return;
    }

    default: {
      const exhaustive: never = action.kind;
      throw new Error(`Action inconnue : ${String(exhaustive)}`);
    }
  }
}
