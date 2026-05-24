/**
 * Upload d'un fichier .ubx brut vers Supabase Storage.
 *
 * Pipeline (cf. docs/architecture/01_PARTIE_1 §4.4) :
 *   1. App stoppe BLE → fichier .ubx local
 *   2. Parser → données dérivées dans telemetry_frames/laps (autre service)
 *   3. UI montre le bilan IMMÉDIATEMENT, sans attendre l'upload
 *   4. uploadTelemetryFile() en tâche de fond, met à jour raw_data_url
 *
 * Le bucket `telemetry_raw` est attendu privé (RLS sur user_id côté
 * Storage policies). À créer en sem. 4 quand on disposera de la
 * première vraie session.
 */

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const BUCKET = 'telemetry_raw';

export interface UploadResult {
  storagePath: string;
  sizeBytes: number;
  durationMs: number;
}

/**
 * Upload un fichier .ubx local vers Supabase Storage, puis met à jour
 * telemetry_sessions.raw_data_url si telemetrySessionId fourni.
 *
 * Le path Storage est `{user_id}/{telemetry_session_id}.ubx` — cohérent
 * avec un pattern RLS basé sur le prefix utilisateur.
 *
 * Idempotent : un re-upload écrase l'objet existant (upsert: true).
 */
export async function uploadTelemetryFile(input: {
  fileUri: string;
  userId: string;
  telemetrySessionId: string;
}): Promise<UploadResult> {
  const startedAt = Date.now();

  const info = await FileSystem.getInfoAsync(input.fileUri);
  if (!info.exists) {
    throw new Error(`Fichier introuvable : ${input.fileUri}`);
  }

  const base64 = await FileSystem.readAsStringAsync(input.fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Buffer.from(base64, 'base64');

  const storagePath = `${input.userId}/${input.telemetrySessionId}.ubx`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'application/octet-stream',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('telemetry_sessions')
    .update({ raw_data_url: `${BUCKET}/${storagePath}` })
    .eq('id', input.telemetrySessionId)
    .eq('user_id', input.userId);
  if (updateError) {
    console.warn('[OXV] Upload OK mais maj raw_data_url échouée :', updateError.message);
  }

  return {
    storagePath,
    sizeBytes: bytes.length,
    durationMs: Date.now() - startedAt,
  };
}
