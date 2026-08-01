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
  /** Nombre de tours (réel), null si non renseigné. Sous-label « N tours ». */
  lapCount: number | null;
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

/**
 * LA SÉANCE PAR LAQUELLE COMMENCER — une seule, jamais deux.
 *
 * *« Liseré rouge sur une seule séance, la plus ancienne en attente : une file où
 * tout est urgent n'est plus une file. »* — Plan de montage, jalon 6, phase 5.
 *
 * ---
 *
 * CE N'EST PAS UN SIGNAL D'URGENCE
 *
 * Marquer toutes les séances non lues ne dirait rien : si tout est signalé, rien
 * ne l'est, et le coach se retrouve devant un mur rouge qui ne l'aide pas à
 * choisir. Une seule marque, et elle désigne — elle ne presse pas.
 *
 * La doctrine de la file est écrite en tête de ce module : elle aide le coach à
 * s'organiser, elle ne le bouscule pas. Le liseré dit « commencez par là », pas
 * « vous êtes en retard ». Aucun décompte, aucun délai, aucun reproche.
 *
 * ---
 *
 * POURQUOI LA PLUS ANCIENNE
 *
 * Parce que c'est le pilote qui attend depuis le plus longtemps. Trier par
 * autre chose — la marge la plus courte, le pilote le plus assidu — reviendrait
 * à hiérarchiser les élèves, ce que la doctrine refuse.
 *
 * Rend `null` quand rien n'est en attente : une file à jour ne porte aucune
 * marque, et c'est une information en soi.
 */
export function seanceParLaquelleCommencer(items: readonly QueueItem[]): string | null {
  if (!Array.isArray(items)) return null;

  let choisie: QueueItem | null = null;
  let plusAncien = Number.POSITIVE_INFINITY;

  for (const i of items) {
    if (i === null || typeof i !== 'object') continue;
    if (i.status !== 'unread') continue;
    if (typeof i.sessionId !== 'string' || i.sessionId.length === 0) continue;

    const t = Date.parse(i.startedAt);
    // Une date illisible ne peut pas être comparée : la séance reste dans la
    // file, elle ne peut simplement pas être désignée comme point de départ.
    if (!Number.isFinite(t)) continue;

    if (t < plusAncien) {
      plusAncien = t;
      choisie = i;
    }
  }

  return choisie?.sessionId ?? null;
}
