/**
 * Storage local rapide via react-native-mmkv.
 *
 * Tient lieu de cache (lectures Supabase fréquentes) et de file
 * d'attente offline (écritures différées). Synchrone, persistant,
 * ~30x plus rapide qu'AsyncStorage.
 *
 * NB : les tokens d'auth Supabase restent dans expo-secure-store
 * (chiffrement matériel) ; MMKV ne stocke que des données non-sensibles
 * (cache de lecture, queue d'écritures idempotentes).
 */

import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'oxv-coach-cache' });

export const STORAGE_KEYS = {
  // Cache de lecture (TTL court)
  LAST_SESSIONS: 'cache:last_sessions',
  PROFILE: 'cache:profile',
  CIRCUITS: 'cache:circuits',
  CIRCUIT_BELTOISE: 'cache:circuit_beltoise',

  // File d'attente d'écritures
  OFFLINE_QUEUE: 'queue:offline',

  /**
   * Intention de séance posée en prépa et pas encore rattachée : `{id, createdAt}`
   * gelés LOCALEMENT à l'écriture. Permet de rattacher l'intention à la séance
   * SANS aucun appel réseau au démarrage de capture — donc y compris en mode
   * avion, où le SELECT équivalent échouerait (cf. intentionsService).
   */
  PENDING_INTENTION: 'pending:intention',

  // Préférences UI persistées (par utilisateur, namespaced via suffix userId)
  PREF_DETAIL_LEVEL: 'pref:detail_level',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ============================================================
// CACHE AVEC TTL
// ============================================================

interface CacheEntry<T> {
  value: T;
  /** Timestamp ms epoch ; null = ne périme jamais. */
  expiresAt: number | null;
}

export function cacheSet<T>(key: string, value: T, ttlMs?: number): void {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: typeof ttlMs === 'number' ? Date.now() + ttlMs : null,
  };
  storage.set(key, JSON.stringify(entry));
}

/**
 * La valeur si elle est FRAÎCHE, sinon `null`.
 *
 * ── L'ENTRÉE PÉRIMÉE N'EST PLUS DÉTRUITE (13/08/2026) ────────────────────────
 *
 * Cette fonction faisait `storage.delete(key)` à l'expiration. Conséquence :
 * **il n'existait aucun « repli sur cache stale »**, alors que `circuitsService`
 * en promettait un noir sur blanc dans son commentaire, et que tout son
 * comportement hors-ligne reposait dessus. Passé le TTL, la donnée était
 * effacée ; une lecture réseau en échec retombait donc sur `null`, c'est-à-dire
 * sur rien.
 *
 * Au circuit, en rase campagne, cela veut dire : plus de liste de circuits,
 * plus de tracé, plus de choix à l'armement. Le repli existait dans le
 * commentaire et nulle part ailleurs.
 *
 * Une entrée périmée n'est pas une entrée fausse : c'est une entrée qu'on
 * préfère rafraîchir. Quand le rafraîchissement est impossible, elle vaut
 * infiniment mieux que le vide — et `cacheGetStale` la rend explicitement, pour
 * que l'appelant sache qu'il sert une donnée d'hier.
 */
export function cacheGet<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) return null;
    return entry.value;
  } catch {
    // Entrée ILLISIBLE — celle-là se supprime : elle ne sera jamais meilleure,
    // et la garder ferait échouer chaque lecture à venir.
    storage.delete(key);
    return null;
  }
}

/**
 * La valeur MÊME PÉRIMÉE, ou `null` si rien n'a jamais été mis en cache.
 *
 * À n'employer que sur un chemin d'ERREUR, et en le disant à l'utilisateur
 * quand la fraîcheur compte. Servir une donnée d'hier en la présentant comme
 * celle d'aujourd'hui serait le défaut inverse.
 */
export function cacheGetStale<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as CacheEntry<T>).value;
  } catch {
    storage.delete(key);
    return null;
  }
}

export function cacheDelete(key: string): void {
  storage.delete(key);
}

/** Vide le cache de lecture, garde la file d'écritures intacte. */
export function cacheClearReadCache(): void {
  storage.delete(STORAGE_KEYS.LAST_SESSIONS);
  storage.delete(STORAGE_KEYS.PROFILE);
  storage.delete(STORAGE_KEYS.CIRCUITS);
  storage.delete(STORAGE_KEYS.CIRCUIT_BELTOISE);
}

/** Pour les tests et la déconnexion : tout effacer. */
export function cacheClearAll(): void {
  storage.clearAll();
}
