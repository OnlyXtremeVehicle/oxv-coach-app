/**
 * Service note vocale coach (PR-59).
 *
 * Enregistre une note vocale (expo-av), l'envoie dans le bucket prive `coach-audio`
 * et l'attache a une annotation. La RLS storage (coach_audio_select) lit l'objet
 * par son NOM = l'id de l'annotation : l'objet doit donc s'appeler EXACTEMENT
 * l'uuid de l'annotation (pas d'extension, pas de dossier). Le pilote ne peut lire
 * que les notes des annotations partagees avec lui (policy deja en place).
 *
 * IMPORTANT : l'enregistrement requiert le module natif expo-av, fonctionnel a
 * partir du prochain build natif (rebuild EAS). Le code est complet et compile.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const BUCKET = 'coach-audio';
const AUDIO_MIME = 'audio/m4a';

/** Demande la permission micro. Retourne true si accordee. */
export async function requestRecordingPermission(): Promise<boolean> {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  } catch (e) {
    console.warn('[OXV][coachAudio] permission :', e);
    return false;
  }
}

/** Demarre un enregistrement. Retourne l'objet Recording ou null. */
export async function startRecording(): Promise<Audio.Recording | null> {
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    return recording;
  } catch (e) {
    console.warn('[OXV][coachAudio] startRecording :', e);
    return null;
  }
}

/** Stoppe l'enregistrement et retourne l'URI local du fichier, ou null. */
export async function stopRecording(recording: Audio.Recording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    return recording.getURI();
  } catch (e) {
    console.warn('[OXV][coachAudio] stopRecording :', e);
    return null;
  }
}

/**
 * Envoie le fichier local dans coach-audio (objet nomme = annotationId) et ecrit
 * audio_url = annotationId sur l'annotation. RLS : seul le coach proprietaire peut
 * uploader/ecrire. upsert=true pour permettre un re-enregistrement.
 */
export async function attachAudioToAnnotation(
  annotationId: string,
  localUri: string
): Promise<{ ok: boolean; error?: string }> {
  let blob: Blob;
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    blob = new Blob([Buffer.from(base64, 'base64')], { type: AUDIO_MIME });
  } catch (e) {
    console.warn('[OXV][coachAudio] read file :', e);
    return { ok: false, error: "L'enregistrement n'a pas pu etre lu." };
  }

  // Le NOM de l'objet doit etre l'uuid de l'annotation (cf. policy storage).
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(annotationId, blob, { contentType: AUDIO_MIME, upsert: true });
  if (upErr) {
    console.warn('[OXV][coachAudio] upload :', upErr.message);
    return { ok: false, error: "L'envoi de la note vocale a echoue." };
  }

  const { error: updErr } = await supabase
    .from('coach_annotations')
    .update({ audio_url: annotationId } as never)
    .eq('id', annotationId);
  if (updErr) {
    console.warn('[OXV][coachAudio] set audio_url :', updErr.message);
    return { ok: false, error: updErr.message };
  }
  return { ok: true };
}

/**
 * Resout une URL signee (1h) lisible pour jouer la note. `path` = audio_url
 * stocke (= id de l'annotation). RLS : coach proprietaire ou pilote en partage.
 */
export async function getAnnotationAudioUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) {
    if (error) console.warn('[OXV][coachAudio] signed url :', error.message);
    return null;
  }
  return data.signedUrl;
}
