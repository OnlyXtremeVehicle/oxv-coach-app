/**
 * incidentOffline — registre LOCAL des signalements d'incident en attente
 * (V2-L2, spec 8/8, D4).
 *
 * RÈGLE CARDINALE : ce registre NE TOUCHE JAMAIS `captureSyncQueue` (la chaîne
 * durcie Valence). C'est un mécanisme SÉPARÉ et léger, propre au flux incident.
 *
 * Le stockage MMKV est INJECTÉ (interface `KVStorage`) : aucun import natif au
 * chargement du module → toute la logique (mise en file, déduplication par uuid
 * local, rejeu, persistance incrémentale) est testable sous ts-jest node
 * (__tests__/incidentOffline.test.ts). L'écran `app/(app2)/rec/fin.tsx` injecte
 * le MMKV réel (`storage` de `@/lib/mmkv`).
 *
 * Idempotence : la mise en file DÉDUPLIQUE par `localId` ; le rejeu retire une
 * entrée UNIQUEMENT après un envoi réussi et persiste après CHAQUE succès, si
 * bien qu'une reprise interrompue ne renvoie pas ce qui est déjà parti.
 */

/** Sous-ensemble de l'API MMKV utilisé ici (réel injecté par l'écran). */
export interface KVStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

/** Clé MMKV du registre. Espace de noms `rec:` distinct de tout autre. */
export const INCIDENT_QUEUE_KEY = 'rec:incident-offline-queue';

/** Un signalement en attente de synchronisation. */
export interface PendingIncident {
  /** UUID local — clé d'idempotence (jamais deux fois la même déclaration). */
  localId: string;
  sessionId: string | null;
  /** Heure de survenue (ISO 8601). */
  occurredAt: string;
  description: string;
  /** URI locale de la photo optionnelle. */
  photoUri?: string | null;
  /** Horodatage de mise en file (ISO 8601). */
  queuedAt: string;
}

// ---------------------------------------------------------------------------
// Réducteurs purs (testés directement)
// ---------------------------------------------------------------------------

/** Une entrée est-elle exploitable ? (localId + description non vides). */
function isValidEntry(x: unknown): x is PendingIncident {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.localId === 'string' &&
    e.localId.length > 0 &&
    typeof e.description === 'string' &&
    e.description.length > 0 &&
    typeof e.occurredAt === 'string'
  );
}

/** Désérialise le registre. JSON invalide ou forme inattendue → [] (jamais un throw). */
export function parseQueue(raw: string | undefined): PendingIncident[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).map((e) => ({
      localId: e.localId,
      sessionId: e.sessionId ?? null,
      occurredAt: e.occurredAt,
      description: e.description,
      photoUri: e.photoUri ?? null,
      queuedAt: typeof e.queuedAt === 'string' ? e.queuedAt : e.occurredAt,
    }));
  } catch {
    return [];
  }
}

export function serializeQueue(queue: readonly PendingIncident[]): string {
  return JSON.stringify(queue);
}

/** Ajoute une entrée, DÉDUPLIQUÉE par `localId` (idempotent). */
export function enqueue(
  queue: readonly PendingIncident[],
  item: PendingIncident
): PendingIncident[] {
  if (queue.some((q) => q.localId === item.localId)) return [...queue];
  return [...queue, item];
}

/** Retire l'entrée d'un `localId` (no-op si absente). */
export function removeById(queue: readonly PendingIncident[], localId: string): PendingIncident[] {
  return queue.filter((q) => q.localId !== localId);
}

// ---------------------------------------------------------------------------
// Registre adossé au MMKV injecté
// ---------------------------------------------------------------------------

export function loadQueue(storage: KVStorage): PendingIncident[] {
  return parseQueue(storage.getString(INCIDENT_QUEUE_KEY));
}

export function saveQueue(storage: KVStorage, queue: readonly PendingIncident[]): void {
  storage.set(INCIDENT_QUEUE_KEY, serializeQueue(queue));
}

/** Met en file (idempotent) et persiste. Retourne le registre résultant. */
export function enqueueIncident(storage: KVStorage, item: PendingIncident): PendingIncident[] {
  const next = enqueue(loadQueue(storage), item);
  saveQueue(storage, next);
  return next;
}

// ---------------------------------------------------------------------------
// Rejeu (au retour réseau / au foreground)
// ---------------------------------------------------------------------------

/** Envoie un signalement. `ok:true` → l'entrée est retirée de la file. */
export type IncidentReporter = (item: PendingIncident) => Promise<{ ok: boolean }>;

export interface ReplayResult {
  /** localId des entrées envoyées avec succès (retirées de la file). */
  sent: string[];
  /** Entrées restant en attente après le rejeu. */
  remaining: PendingIncident[];
}

/**
 * Rejoue la file : tente chaque entrée dans l'ordre, retire et PERSISTE après
 * chaque succès, garde les échecs pour la prochaine tentative. Ne rejette
 * jamais : une erreur du reporter est traitée comme un échec d'envoi.
 *
 * ANTI-RACE (vérif L2 [2]) : après CHAQUE succès on RELIT la file depuis le
 * stockage avant de retirer et sauver — jamais un état dérivé d'un snapshot
 * pris au début. Ainsi une déclaration ajoutée PENDANT le rejeu (l'attente
 * réseau d'un envoi) n'est plus écrasée : on ne retire que le `localId`
 * réellement envoyé, sur la file courante.
 */
export async function replayQueue(
  storage: KVStorage,
  report: IncidentReporter
): Promise<ReplayResult> {
  const snapshot = loadQueue(storage);
  const sent: string[] = [];

  for (const item of snapshot) {
    let ok = false;
    try {
      const res = await report(item);
      ok = res != null && res.ok === true;
    } catch {
      ok = false;
    }
    if (ok) {
      // Relecture atomique : la file a pu s'enrichir pendant l'envoi.
      saveQueue(storage, removeById(loadQueue(storage), item.localId));
      sent.push(item.localId);
    }
  }

  return { sent, remaining: loadQueue(storage) };
}
