/**
 * Médias de la fiche coach — photos et vidéos visibles par les pilotes.
 *
 * Stockage : bucket public `coach-media`, convention `{coachId}/{uuid}.{ext}`.
 * Métadonnées : `coach_profiles.media` (jsonb) = tableau de { id, path, type }.
 *
 * Sécurité : les RLS Storage sont déjà en place — un coach n'écrit que dans SON
 * dossier (is_coach() + foldername[1] = auth.uid()), lecture publique. Aucune
 * migration nécessaire. La fiche `coach_profiles` est éditée sous RLS owner.
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji. Le média est une vitrine, jamais
 * une donnée de pilotage.
 */

import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';

const BUCKET = 'coach-media';

export type CoachMediaType = 'photo' | 'video';

/** Entrée média telle que stockée dans le jsonb `coach_profiles.media`. */
export interface CoachMediaItem {
  id: string;
  path: string;
  type: CoachMediaType;
}

/** Entrée média enrichie de son URL publique (pour affichage). */
export interface CoachMediaView extends CoachMediaItem {
  url: string;
}

/** URL publique d'un chemin du bucket `coach-media`. */
export function coachMediaUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Parse défensif du jsonb `media` ; ignore les entrées mal formées. */
export function parseCoachMedia(raw: unknown): CoachMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachMediaItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : null;
    const path = typeof o.path === 'string' ? o.path : null;
    if (!id || !path) continue;
    out.push({ id, path, type: o.type === 'video' ? 'video' : 'photo' });
  }
  return out;
}

/** Enrichit une liste d'items de leur URL publique. */
export function withCoachMediaUrls(items: CoachMediaItem[]): CoachMediaView[] {
  return items.map((m) => ({ ...m, url: coachMediaUrl(m.path) }));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function readRawMedia(coachId: string): Promise<CoachMediaItem[]> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('media')
    .eq('coach_id', coachId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[OXV][coachMedia] readRawMedia :', error.message);
    return [];
  }
  return parseCoachMedia(data.media);
}

/**
 * Lit les médias publiés d'un coach (avec URLs). Lecture publique du bucket ;
 * la fiche `coach_profiles` reste filtrée par RLS (publiée).
 */
export async function listCoachMedia(coachId: string): Promise<CoachMediaView[]> {
  return withCoachMediaUrls(await readRawMedia(coachId));
}

/** Lit les médias de MA fiche coach (édition). */
export async function listMyCoachMedia(): Promise<CoachMediaView[]> {
  const id = await currentUserId();
  if (!id) return [];
  return withCoachMediaUrls(await readRawMedia(id));
}

type AddResult =
  | { ok: true; items: CoachMediaView[] }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

/**
 * Sélectionne une photo ou une vidéo, l'envoie dans `coach-media/{coachId}/…`
 * puis l'ajoute au jsonb `media`. Rollback du storage si l'écriture DB échoue.
 */
export async function addMyCoachMedia(type: CoachMediaType): Promise<AddResult> {
  const id = await currentUserId();
  if (!id) return { ok: false, error: 'Vous devez être connecté pour ajouter un média.' };

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    return {
      ok: false,
      error: "Autorisez l'accès aux médias pour ajouter une photo ou une vidéo.",
    };
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:
      type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85,
  });
  if (picked.canceled || !picked.assets?.length) return { ok: false, cancelled: true };

  const asset = picked.assets[0];
  const ext = (asset.uri.split('?')[0].split('.').pop() ?? (type === 'video' ? 'mp4' : 'jpg'))
    .toLowerCase()
    .slice(0, 5);
  const mime =
    asset.mimeType ?? (type === 'video' ? 'video/mp4' : ext === 'png' ? 'image/png' : 'image/jpeg');

  // URI local -> Blob via base64 (compatible RN, sans fetch d'URI).
  let blob: Blob;
  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    blob = new Blob([Buffer.from(base64, 'base64')], { type: mime });
  } catch (e) {
    console.warn('[OXV][coachMedia] read file :', e);
    return { ok: false, error: "Ce fichier n'a pas pu être lu. Réessayez avec un autre." };
  }

  const mediaId = crypto.randomUUID();
  const path = `${id}/${mediaId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (upErr) {
    console.warn('[OXV][coachMedia] upload :', upErr.message);
    return { ok: false, error: "L'envoi du média a échoué. Réessayez dans un instant." };
  }

  const next = [...(await readRawMedia(id)), { id: mediaId, path, type }];
  const { error: updErr } = await supabase
    .from('coach_profiles')
    // CoachMediaItem[] -> Json : l'interface n'a pas d'index signature, cast au bord DB.
    .update({ media: next as unknown as Json })
    .eq('coach_id', id);
  if (updErr) {
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => undefined);
    console.warn('[OXV][coachMedia] update media :', updErr.message);
    return { ok: false, error: "Le média n'a pas pu être enregistré." };
  }

  return { ok: true, items: withCoachMediaUrls(next) };
}

/** Retire un média (storage + jsonb) de MA fiche coach. */
export async function removeMyCoachMedia(
  mediaId: string
): Promise<{ ok: true; items: CoachMediaView[] } | { ok: false; error: string }> {
  const id = await currentUserId();
  if (!id) return { ok: false, error: 'Vous devez être connecté pour retirer un média.' };

  const current = await readRawMedia(id);
  const target = current.find((m) => m.id === mediaId);
  const next = current.filter((m) => m.id !== mediaId);

  const { error: updErr } = await supabase
    .from('coach_profiles')
    // CoachMediaItem[] -> Json : l'interface n'a pas d'index signature, cast au bord DB.
    .update({ media: next as unknown as Json })
    .eq('coach_id', id);
  if (updErr) {
    console.warn('[OXV][coachMedia] remove update :', updErr.message);
    return { ok: false, error: "Le média n'a pas pu être retiré." };
  }

  if (target) {
    await supabase.storage
      .from(BUCKET)
      .remove([target.path])
      .catch(() => undefined);
  }

  return { ok: true, items: withCoachMediaUrls(next) };
}
