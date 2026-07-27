/**
 * Service signalements d'incident (lot BE-1, Mission B) — I/O Supabase.
 *
 * Table `incident_reports` : IMMUABLE (RLS = insert own + select own/admin, ni
 * update ni delete). Un signalement décrit un fait ; on ne le réécrit pas.
 * Photo optionnelle dans le bucket privé `pilot-media`, dossier
 * `{uid}/incidents/` (mêmes règles de stockage que les autres médias pilote).
 *
 * Validation de la description (10..4000, après trim) extraite en pur ci-dessous
 * pour rester testable sans réseau. Erreurs remontées, jamais masquées.
 *
 * Ton OXV : vouvoiement, sec, sans emoji.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

import { supabase } from '@/lib/supabase';

const BUCKET = 'pilot-media';

/** Longueur minimale de la description, en caractères (après trim). */
export const INCIDENT_DESCRIPTION_MIN = 10;
/** Longueur maximale de la description, en caractères (après trim). */
export const INCIDENT_DESCRIPTION_MAX = 4000;

/**
 * Valide la description d'un signalement. Longueur mesurée APRÈS trim, comme la
 * contrainte SQL. Pur : aucun accès réseau, testable directement.
 */
export function validateIncidentDescription(input: string): { ok: boolean; error?: string } {
  const trimmed = (input ?? '').trim();
  if (trimmed.length < INCIDENT_DESCRIPTION_MIN) {
    return {
      ok: false,
      error: `Votre description doit compter au moins ${INCIDENT_DESCRIPTION_MIN} caractères.`,
    };
  }
  if (trimmed.length > INCIDENT_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Votre description ne peut pas dépasser ${INCIDENT_DESCRIPTION_MAX} caractères.`,
    };
  }
  return { ok: true };
}

/** Ligne de signalement telle qu'exposée à l'UI. */
export interface IncidentRow {
  id: string;
  sessionId: string | null;
  occurredAt: string;
  description: string;
  photoPath: string | null;
  createdAt: string;
}

/**
 * Envoie la photo dans `pilot-media/{uid}/incidents/{uuid}.jpg` et retourne son
 * chemin. Lit d'abord le fichier local en base64 (URI ImagePicker/caméra) puis
 * le transforme en Blob.
 */
async function uploadIncidentPhoto(
  uid: string,
  photoUri: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  // Le typage RN du Blob (globals.d.ts) est plus étroit que son runtime : parts
  // typées Array<Blob | string> et `lastModified` requis, alors qu'un
  // Uint8Array + { type } passent (validé en prod, cf. pilotMediaService).
  // Cast type-only fidèle au runtime, aucun changement de comportement.
  const BlobCtor = Blob as unknown as new (parts: Uint8Array[], options: { type: string }) => Blob;

  let blob: Blob;
  try {
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    blob = new BlobCtor([Buffer.from(base64, 'base64')], { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[OXV][incident] read photo :', e);
    return { ok: false, error: "Cette photo n'a pas pu être lue. Réessayez." };
  }

  const path = `${uid}/incidents/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) {
    console.warn('[OXV][incident] upload photo :', error.message);
    return { ok: false, error: "L'envoi de la photo a échoué. Réessayez dans un instant." };
  }
  return { ok: true, path };
}

/**
 * Enregistre un signalement d'incident. Si une photo est fournie, elle est
 * envoyée AVANT l'insertion ; en cas d'échec d'insertion, la photo est retirée
 * du bucket (pas d'orpheline). La ligne est immuable une fois créée.
 */
export async function report(input: {
  sessionId?: string | null;
  occurredAt: Date | string;
  description: string;
  photoUri?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const check = validateIncidentDescription(input.description);
  if (!check.ok) return { ok: false, error: check.error };

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  const occurredAtIso =
    input.occurredAt instanceof Date ? input.occurredAt.toISOString() : input.occurredAt;

  let photoPath: string | null = null;
  if (input.photoUri) {
    const uploaded = await uploadIncidentPhoto(uid, input.photoUri);
    if (!uploaded.ok) return { ok: false, error: uploaded.error };
    photoPath = uploaded.path;
  }

  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      user_id: uid,
      session_id: input.sessionId ?? null,
      occurred_at: occurredAtIso,
      description: input.description.trim(),
      photo_path: photoPath,
    })
    .select('id')
    .single();

  if (error || !data) {
    // Rollback de la photo si l'insertion échoue, pour ne pas laisser d'orpheline.
    if (photoPath) {
      await supabase.storage
        .from(BUCKET)
        .remove([photoPath])
        .catch(() => undefined);
    }
    return { ok: false, error: error?.message ?? "Le signalement n'a pas pu être enregistré." };
  }
  return { ok: true, id: data.id };
}

/**
 * Liste MES signalements, du plus récent au plus ancien (par date de survenue).
 * La RLS restreint déjà à mes lignes ; le filtre `user_id` reste explicite.
 */
export async function listMine(): Promise<IncidentRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('incident_reports')
    .select('id, session_id, occurred_at, description, photo_path, created_at')
    .eq('user_id', uid)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.warn('[OXV][incident] listMine :', error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    occurredAt: r.occurred_at,
    description: r.description,
    photoPath: r.photo_path,
    createdAt: r.created_at,
  }));
}
