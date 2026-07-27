/**
 * Service note vocale coach (PR-59).
 *
 * Enregistre une note vocale (expo-av), l'envoie dans le bucket prive `coach-audio`
 * et l'attache a une annotation. La RLS storage (coach_audio_select) lit l'objet
 * par son NOM = l'id de l'annotation : l'objet doit donc s'appeler EXACTEMENT
 * l'uuid de l'annotation (pas d'extension, pas de dossier). Le pilote ne peut lire
 * que les notes des annotations partagees avec lui (policy deja en place).
 *
 * IMPORTANT : l'enregistrement requiert le module natif expo-audio, fonctionnel a
 * partir du prochain build natif (rebuild EAS). Le code est complet et compile.
 *
 * MIGRATION T0 — expo-av a DISPARU du SDK 55 : il n'y est plus epingle du tout,
 * expo-audio le remplace. Ce n'est pas un renommage, l'interface est differente :
 *   Audio.requestPermissionsAsync   -> requestRecordingPermissionsAsync
 *   Audio.setAudioModeAsync         -> setAudioModeAsync, dont les cles perdent
 *                                      leur suffixe IOS (allowsRecordingIOS
 *                                      devient allowsRecording)
 *   Audio.Recording.createAsync     -> new AudioRecorder(...) puis
 *                                      prepareToRecordAsync() puis record()
 *   recording.stopAndUnloadAsync    -> stop()
 *   recording.getURI()              -> propriete .uri
 *
 * expo-audio n'expose AUCUNE fabrique d'enregistreur hors React : `AudioRecorder`
 * est un TYPE, et `useAudioRecorder` un hook. Un service ne peut donc plus creer
 * l'enregistreur — c'est l'ecran qui le tient, et ce module OPERE dessus.
 * L'inversion est imposee par la bibliotheque, pas choisie.
 *
 * RESERVE HONNETE : ce chemin n'a JAMAIS tourne. Il exigeait deja un build natif
 * qui n'a pas eu lieu, et aucun compte coach n'existe en production. La reecriture
 * n'a donc PAS pu etre comparee a un comportement observe — elle suit l'interface
 * declaree d'expo-audio, rien de plus. A eprouver au premier build.
 */

import {
  type AudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

const BUCKET = 'coach-audio';
const AUDIO_MIME = 'audio/m4a';

/** Demande la permission micro. Retourne true si accordee. */
export async function requestRecordingPermission(): Promise<boolean> {
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  } catch (e) {
    console.warn('[OXV][coachAudio] permission :', e);
    return false;
  }
}

/**
 * Demarre l'enregistrement sur l'enregistreur fourni par l'ecran
 * (`useAudioRecorder`). Retourne true si l'enregistrement a bien demarre.
 */
export async function startRecording(recorder: AudioRecorder): Promise<boolean> {
  try {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  } catch (e) {
    console.warn('[OXV][coachAudio] startRecording :', e);
    return false;
  }
}

/** Stoppe l'enregistrement et retourne l'URI local du fichier, ou null. */
export async function stopRecording(recorder: AudioRecorder): Promise<string | null> {
  try {
    await recorder.stop();
    // Rendre la session audio au systeme : sans cela, le telephone reste en mode
    // enregistrement et la lecture suivante sort par l'ecouteur.
    await setAudioModeAsync({ allowsRecording: false });
    return recorder.uri;
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
