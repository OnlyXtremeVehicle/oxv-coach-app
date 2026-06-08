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

export function cacheGet<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      storage.delete(key);
      return null;
    }
    return entry.value;
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
