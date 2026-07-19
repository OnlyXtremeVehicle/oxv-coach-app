/**
 * Service biométrie (BE-1, MISSION A) — I/O Supabase sur `biometry_raw`.
 *
 * La logique pure (calcul de qualité, découpage, normalisation) vit dans
 * `biometryLogic.ts` et se teste sans réseau. Ce fichier ne fait que l'I/O.
 *
 * Schéma prod `biometry_raw` :
 *   (id, session_id→telemetry_sessions, user_id, ts timestamptz, hr 25-250,
 *    rr_ms smallint[] null, source 'polar_h10'|'apple_watch', quality 0-100 null,
 *    created_at) — UNIQUE (session_id, ts, source).
 *
 * RLS : le pilote a tous les droits sur ses lignes (auth.uid() = user_id) ; le
 * coach binôme détaillé lit si le partage biométrie est consenti. Aucune policy
 * partner/staff. Le service ne force donc pas de filtre `user_id` en lecture :
 * la RLS s'en charge (own-row + coach autorisé).
 *
 * Erreurs REMONTÉES (throw), à l'image de l'écriture idempotente de
 * `captureSyncQueue` : ce sont des écritures/lectures de fond dont l'échec doit
 * être visible de l'appelant, jamais avalé.
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import { chunk, DEFAULT_CHUNK_SIZE } from './biometryLogic';

/** Sources matérielles autorisées (miroir du CHECK côté base). */
export type BiometrySource = 'polar_h10' | 'apple_watch';

type BiometryInsert = Database['public']['Tables']['biometry_raw']['Insert'];
export type BiometryRow = Database['public']['Tables']['biometry_raw']['Row'];

/** Échantillon fourni par un capteur avant persistance. */
export interface BiometryInputSample {
  /** Horodatage : chaîne ISO 8601 ou epoch millisecondes (converti en ISO). */
  ts: string | number;
  /** Fréquence cardiaque (bpm). Le CHECK base rejette hors [25, 250]. */
  hr: number;
  /** Intervalles R-R en ms (Polar uniquement). Absent → null. */
  rrMs?: number[] | null;
  /** Qualité 0-100 si connue à la capture, sinon null. */
  quality?: number | null;
}

function toIso(ts: string | number): string {
  return typeof ts === 'number' ? new Date(ts).toISOString() : ts;
}

/**
 * Persiste des échantillons cardiaques d'une session, par lots de 500, en
 * upsert idempotent (onConflict `session_id,ts,source`, `ignoreDuplicates`).
 *
 * Idempotent : rejouer la même capture (reprise après coupure réseau) ne crée
 * pas de doublons — la clé naturelle (session, instant, source) dédoublonne.
 * Le `user_id` est résolu depuis la session authentifiée (jamais fourni par
 * l'appelant) pour rester aligné avec la RLS own-row.
 *
 * @returns { saved } nombre d'échantillons ENVOYÉS (tentés). Avec
 *   `ignoreDuplicates`, les collisions ne comptent pas comme insertions réelles
 *   mais l'idempotence est garantie côté base.
 */
export async function saveSamples(
  sessionId: string,
  samples: BiometryInputSample[],
  source: BiometrySource
): Promise<{ saved: number }> {
  if (samples.length === 0) return { saved: 0 };

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = auth?.user?.id;
  if (!userId) {
    throw new Error('[OXV][biometry] Aucun utilisateur authentifié — écriture refusée.');
  }

  const rows: BiometryInsert[] = samples.map((s) => ({
    session_id: sessionId,
    user_id: userId,
    ts: toIso(s.ts),
    hr: s.hr,
    rr_ms: s.rrMs ?? null,
    source,
    quality: s.quality ?? null,
  }));

  let saved = 0;
  for (const batch of chunk(rows, DEFAULT_CHUNK_SIZE)) {
    const { error } = await supabase
      .from('biometry_raw')
      .upsert(batch, { onConflict: 'session_id,ts,source', ignoreDuplicates: true });
    if (error) throw error;
    saved += batch.length;
  }
  return { saved };
}

/**
 * Tous les échantillons biométriques d'une session, ordonnés par `ts` croissant.
 * L'accès (pilote propriétaire ou coach autorisé) est arbitré par la RLS.
 */
export async function getSessionBiometry(sessionId: string): Promise<BiometryRow[]> {
  const { data, error } = await supabase
    .from('biometry_raw')
    .select('*')
    .eq('session_id', sessionId)
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BiometryRow[];
}

/**
 * Échantillons d'une session bornés à un intervalle de temps [fromTs, toTs]
 * (bornes incluses) — p. ex. le cardio d'un seul run/tour. Accepte des chaînes
 * ISO ou des epoch millisecondes (converties en ISO pour la comparaison `ts`).
 */
export async function getRunBiometry(
  sessionId: string,
  fromTs: string | number,
  toTs: string | number
): Promise<BiometryRow[]> {
  const { data, error } = await supabase
    .from('biometry_raw')
    .select('*')
    .eq('session_id', sessionId)
    .gte('ts', toIso(fromTs))
    .lte('ts', toIso(toTs))
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BiometryRow[];
}
