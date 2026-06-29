/**
 * File de lecture coach (V9 §14) — résolution PURE du statut de lecture.
 *
 * Le statut explicite (table `coach_queue`, posé par le coach) fait foi ; à
 * défaut, on dérive un statut initial depuis l'annotation (une séance annotée
 * est considérée lue). Pur → testable.
 *
 * Doctrine : la file aide le coach à s'organiser ; elle ne le presse pas (« à
 * votre rythme »). Lecture seule côté pilote — rien de ceci ne lui est exposé.
 */

export type QueueStatus = 'unread' | 'read' | 'archived';

export interface QueueItem {
  sessionId: string;
  pilotId: string;
  pilotName: string;
  circuitName: string | null;
  startedAt: string;
  status: QueueStatus;
}

/** Statut affiché : explicite (coach_queue) s'il existe, sinon dérivé (annotée → lue). */
export function resolveQueueStatus(
  explicit: QueueStatus | undefined,
  annotated: boolean
): QueueStatus {
  if (explicit) return explicit;
  return annotated ? 'read' : 'unread';
}

export interface QueueGroups {
  unread: QueueItem[];
  read: QueueItem[];
  archived: QueueItem[];
  counts: { unread: number; read: number; archived: number };
}

/** Répartit les éléments par statut (pour les filtres et les compteurs). */
export function groupQueue(items: QueueItem[]): QueueGroups {
  const unread = items.filter((i) => i.status === 'unread');
  const read = items.filter((i) => i.status === 'read');
  const archived = items.filter((i) => i.status === 'archived');
  return {
    unread,
    read,
    archived,
    counts: { unread: unread.length, read: read.length, archived: archived.length },
  };
}
