/**
 * Service media de session — lecture côté pilote, upload côté admin OXV.
 *
 * Architecture :
 *   - Table session_media (métadonnées + chemin storage)
 *   - Bucket Supabase Storage `session-media` (RLS strict)
 *   - Convention path : {pilot_user_id}/{session_id}/{media_id}.{ext}
 *
 * Les RLS DB ET les RLS Storage filtrent ensemble : un pilote ne voit
 * QUE ses médias (ou ceux de ses amis/coachs si applicable). Les
 * admins voient tout.
 *
 * Voir migration 20260526160000_0031_session_media.sql.
 */

import { supabase } from '@/lib/supabase';

export type MediaType = 'photo' | 'video';

export interface SessionMediaItem {
  id: string;
  telemetrySessionId: string;
  pilotUserId: string;
  storagePath: string;
  mediaType: MediaType;
  mimeType: string | null;
  fileSizeBytes: number | null;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  caption: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
  displayOrder: number;
  /**
   * Signed URL temporaire pour afficher le média (15 min de validité).
   * Calculée à la demande via getSignedUrlFor.
   */
  signedUrl?: string;
}

interface DbRow {
  id: string;
  telemetry_session_id: string;
  pilot_user_id: string;
  storage_path: string;
  media_type: MediaType;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  duration_seconds: number | null;
  caption: string | null;
  uploaded_by_user_id: string | null;
  uploaded_at: string;
  display_order: number;
}

const BUCKET = 'session-media';
const SIGNED_URL_TTL_SECONDS = 60 * 15; // 15 min

function mapRow(row: DbRow): SessionMediaItem {
  return {
    id: row.id,
    telemetrySessionId: row.telemetry_session_id,
    pilotUserId: row.pilot_user_id,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    durationSeconds: row.duration_seconds,
    caption: row.caption,
    uploadedByUserId: row.uploaded_by_user_id,
    uploadedAt: row.uploaded_at,
    displayOrder: row.display_order,
  };
}

/**
 * Liste les médias d'une session, ordre `display_order` puis `uploaded_at`.
 * RLS filtre automatiquement : pilote / ami / coach / admin.
 * Inclut une `signedUrl` valide 15 min pour chaque entrée.
 */
export async function listSessionMedia(telemetrySessionId: string): Promise<SessionMediaItem[]> {
  const { data, error } = await supabase
    .from('session_media')
    .select('*')
    .eq('telemetry_session_id', telemetrySessionId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .order('uploaded_at', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[sessionMedia] list error:', error.message);
    return [];
  }

  const rows = (data as unknown as DbRow[]).map(mapRow);
  // Génère les signed URLs en parallèle (15 min de TTL)
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const url = await getSignedUrlFor(row.storagePath);
      return { ...row, signedUrl: url };
    })
  );
  return withUrls;
}

/**
 * Galerie pilote (PR-67) : TOUS les médias du pilote courant, toutes séances
 * confondues, du plus récent au plus ancien. RLS own-row (pilot_user_id =
 * auth.uid(), deleted_at null). Utilise l'index idx_session_media_pilot. Chaque
 * entrée porte une signedUrl (15 min).
 */
export async function listAllPilotMedia(): Promise<SessionMediaItem[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('session_media')
    .select('*')
    .eq('pilot_user_id', uid)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false });

  if (error || !data) {
    if (error) console.warn('[sessionMedia] listAll error:', error.message);
    return [];
  }
  const rows = (data as unknown as DbRow[]).map(mapRow);
  return Promise.all(
    rows.map(async (row) => ({ ...row, signedUrl: await getSignedUrlFor(row.storagePath) }))
  );
}

/**
 * Génère une URL signée pour afficher un média (lecture).
 * Retourne null en cas d'erreur (ex: storage object supprimé manuellement).
 */
export async function getSignedUrlFor(storagePath: string): Promise<string | undefined> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn('[sessionMedia] signed url error for', storagePath, ':', error?.message);
    return undefined;
  }
  return data.signedUrl;
}

/**
 * Upload admin : place un fichier dans le bucket + insère la ligne DB.
 * Convention path : {pilot_user_id}/{session_id}/{media_id}.{ext}
 */
export async function uploadSessionMedia(opts: {
  telemetrySessionId: string;
  pilotUserId: string;
  fileBlob: Blob;
  mimeType: string;
  fileNameSuggestedExtension: string; // ex: 'jpg', 'mp4'
  mediaType: MediaType;
  caption?: string | null;
  uploadedByUserId: string;
  widthPx?: number | null;
  heightPx?: number | null;
  durationSeconds?: number | null;
}): Promise<SessionMediaItem | { error: string }> {
  const mediaId = crypto.randomUUID();
  const path = `${opts.pilotUserId}/${opts.telemetrySessionId}/${mediaId}.${opts.fileNameSuggestedExtension}`;

  // 1. Upload storage
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, opts.fileBlob, {
    contentType: opts.mimeType,
    upsert: false,
  });
  if (uploadErr) {
    console.warn('[sessionMedia] upload storage error:', uploadErr.message);
    return { error: uploadErr.message };
  }

  // 2. Insert DB row
  const { data: createdRaw, error: insertErr } = await supabase
    .from('session_media')
    .insert({
      id: mediaId,
      telemetry_session_id: opts.telemetrySessionId,
      pilot_user_id: opts.pilotUserId,
      storage_path: path,
      media_type: opts.mediaType,
      mime_type: opts.mimeType,
      file_size_bytes: opts.fileBlob.size,
      width_px: opts.widthPx ?? null,
      height_px: opts.heightPx ?? null,
      duration_seconds: opts.durationSeconds ?? null,
      caption: opts.caption ?? null,
      uploaded_by_user_id: opts.uploadedByUserId,
    })
    .select('*')
    .single();

  if (insertErr || !createdRaw) {
    // Rollback storage si DB insert a échoué
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => undefined);
    console.warn('[sessionMedia] insert DB error:', insertErr?.message);
    return { error: insertErr?.message ?? 'unknown_insert_error' };
  }

  return mapRow(createdRaw as unknown as DbRow);
}

/**
 * Soft delete (admin only). Le storage object reste en place — un cron
 * séparé peut le purger plus tard.
 */
export async function softDeleteSessionMedia(mediaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('session_media')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', mediaId);

  if (error) {
    console.warn('[sessionMedia] soft delete error:', error.message);
    return false;
  }
  return true;
}

/**
 * Update caption ou display_order (admin only).
 */
export async function updateSessionMedia(
  mediaId: string,
  patch: { caption?: string | null; displayOrder?: number }
): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.displayOrder !== undefined) update.display_order = patch.displayOrder;
  if (Object.keys(update).length === 0) return true;

  const { error } = await supabase
    .from('session_media')
    // objet construit dynamiquement (champs conditionnels) -> cast assumé
    .update(update as never)
    .eq('id', mediaId);

  if (error) {
    console.warn('[sessionMedia] update error:', error.message);
    return false;
  }
  return true;
}
