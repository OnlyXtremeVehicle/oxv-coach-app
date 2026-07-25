/**
 * biometryCaptureBuffer — registre LOCAL des échantillons cardio d'une séance
 * en attente de préservation (V2-BIO-2, Livrable 3).
 *
 * RÈGLE CARDINALE : ce registre NE TOUCHE JAMAIS `captureSyncQueue` (la chaîne
 * durcie Valence). C'est un mécanisme SÉPARÉ et léger, propre au flux biométrie,
 * exactement sur le patron de [[incidentOffline]] (registre incident séparé).
 *
 * DOCTRINE (RGPD art. 9 — donnée de santé). Purement LOCAL, injecté (aucun import
 * natif au chargement) : la logique (persistance par séance, filtrage des lectures
 * non physiologiques, mapping vers l'insert, rejeu) est testable sous ts-jest node.
 * Le stockage MMKV réel est injecté par le runtime (`biometryCaptureRunner`), lui
 * gaté par le triple verrou biométrie — ici, on ne fait QUE stocker/relire du local.
 *
 * Offline-first : les échantillons vivent en MMKV tant que `saveSamples` n'a pas
 * confirmé leur écriture ; un rejeu idempotent (upsert clé naturelle côté base) les
 * envoie au retour réseau, sans doublon.
 */

import type { BioSample } from '@/services/v2/biometryBufferLogic';
import { qualityFromSamples } from '@/services/v2/biometryBufferLogic';
import type { BiometryInputSample } from '@/services/v2/biometryService';

/** Sous-ensemble de l'API MMKV utilisé ici (réel injecté par le runtime). */
export interface KVStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

/** Espace de noms `rec:biometry:` distinct de tout autre registre. */
export const BIOMETRY_SAMPLES_PREFIX = 'rec:biometry:samples:';
/** Registre des séances ayant des échantillons en attente (JSON: string[]). */
export const BIOMETRY_PENDING_KEY = 'rec:biometry:pending';

/** Clé MMKV des échantillons d'une séance. */
export function samplesKey(sessionId: string): string {
  return BIOMETRY_SAMPLES_PREFIX + sessionId;
}

/**
 * Bornes physiologiques de la fréquence cardiaque, miroir du CHECK base
 * (`biometry_raw.hr` ∈ [25, 250]). Une lecture hors bornes = décrochage capteur,
 * jamais une mesure : on l'ÉCARTE (sinon l'upsert du lot entier échouerait).
 */
export const HR_MIN_BPM = 25;
export const HR_MAX_BPM = 250;

// ---------------------------------------------------------------------------
// Réducteurs purs (testés directement)
// ---------------------------------------------------------------------------

/** Un échantillon local est-il exploitable ? (ts + hrBpm finis, contact connu). */
function isValidSample(x: unknown): x is BioSample {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.ts === 'number' &&
    Number.isFinite(s.ts) &&
    typeof s.hrBpm === 'number' &&
    Number.isFinite(s.hrBpm) &&
    (s.contact === 'ok' || s.contact === 'poor' || s.contact === 'unsupported') &&
    Array.isArray(s.rrMs)
  );
}

/** Désérialise un lot d'échantillons. JSON invalide / forme inattendue → [] (jamais un throw). */
export function parseSamples(raw: string | undefined): BioSample[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSample).map((s) => ({
      ts: s.ts,
      hrBpm: s.hrBpm,
      rrMs: s.rrMs.filter((v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)),
      contact: s.contact,
    }));
  } catch {
    return [];
  }
}

export function serializeSamples(samples: readonly BioSample[]): string {
  return JSON.stringify(samples);
}

/** Désérialise le registre des séances en attente. */
export function parsePending(raw: string | undefined): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

/**
 * Convertit les échantillons locaux en insert `biometry_raw`, en ÉCARTANT les
 * lectures non physiologiques (hr hors [25, 250] = décrochage). Chaque insert
 * porte la `quality` DE LA SÉANCE (contact × densité, cf. qualityFromSamples) —
 * un fait mesuré sur le flux, jamais un score inventé. Tableau vide si aucune
 * lecture exploitable.
 */
export function toBiometryInput(
  samples: readonly BioSample[],
  windowMs?: number
): BiometryInputSample[] {
  const usable = samples.filter((s) => s.hrBpm >= HR_MIN_BPM && s.hrBpm <= HR_MAX_BPM);
  if (usable.length === 0) return [];
  const quality = qualityFromSamples([...usable], windowMs != null ? { windowMs } : undefined);
  return usable.map((s) => ({
    ts: s.ts,
    hr: s.hrBpm,
    rrMs: s.rrMs.length > 0 ? s.rrMs : null,
    quality,
  }));
}

// ---------------------------------------------------------------------------
// Registre adossé au MMKV injecté
// ---------------------------------------------------------------------------

/** Tous les échantillons persistés d'une séance (ordre d'écriture conservé). */
export function loadSamples(storage: KVStorage, sessionId: string): BioSample[] {
  return parseSamples(storage.getString(samplesKey(sessionId)));
}

/** Séances ayant des échantillons en attente de préservation. */
export function loadPendingSessions(storage: KVStorage): string[] {
  return parsePending(storage.getString(BIOMETRY_PENDING_KEY));
}

/**
 * Écrit (remplace) le lot complet d'une séance et INSCRIT la séance au registre
 * des séances en attente (idempotent). Le remplacement complet est sûr : le
 * runtime persiste le buffer mémoire cumulé, jamais un delta.
 */
export function persistSamples(
  storage: KVStorage,
  sessionId: string,
  samples: readonly BioSample[]
): void {
  storage.set(samplesKey(sessionId), serializeSamples(samples));
  const pending = loadPendingSessions(storage);
  if (!pending.includes(sessionId)) {
    storage.set(BIOMETRY_PENDING_KEY, JSON.stringify([...pending, sessionId]));
  }
}

/** Efface les échantillons d'une séance et la retire du registre en attente. */
export function clearSession(storage: KVStorage, sessionId: string): void {
  storage.delete(samplesKey(sessionId));
  const pending = loadPendingSessions(storage).filter((id) => id !== sessionId);
  storage.set(BIOMETRY_PENDING_KEY, JSON.stringify(pending));
}
