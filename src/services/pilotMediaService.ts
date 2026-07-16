/**
 * Médias de profil pilote — photos et vidéos, vues par le coach affilié.
 *
 * Contrairement à la vitrine coach (publique), les médias du pilote sont PRIVÉS :
 * bucket `pilot-media` (privé), lecture réservée au pilote, à son coach affilié
 * et aux admins (RLS storage, migration 0011). L'affichage passe donc par des
 * URLs SIGNÉES (jamais d'URL publique).
 *
 * Métadonnées : `users.media` (jsonb) = tableau de { id, path, type, vehicleId? }.
 * Le pilote édite les siens (RLS self-update) ; le coach lit les chemins via
 * coach_pilots_view (migration 0012) puis les signe (is_coach_of l'y autorise).
 * `vehicleId` (optionnel, zéro schéma) rattache un média à un véhicule du
 * garage ; sans lui, l'item reste un média de profil (rétrocompatible).
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji. Le média est une vitrine, jamais
 * une donnée de pilotage.
 */

import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';

const BUCKET = 'pilot-media';
const SIGNED_TTL_SECONDS = 60 * 30; // 30 min

export type PilotMediaType = 'photo' | 'video';

/**
 * Entrée média telle que stockée dans le jsonb `users.media`.
 *
 * `vehicleId` (additif, zéro schéma — retour fondateur build 23) : présent =
 * photo/vidéo rattachée à un véhicule du garage ; absent = média de profil.
 * Les items historiques n'en ont pas et restent donc des médias de profil.
 */
export interface PilotMediaItem {
  id: string;
  path: string;
  type: PilotMediaType;
  vehicleId?: string;
}

/** Entrée média + URL signée temporaire (null si la signature a échoué). */
export interface PilotMediaView extends PilotMediaItem {
  signedUrl: string | null;
}

/** Parse défensif du jsonb `media` ; ignore les entrées mal formées. */
export function parsePilotMedia(raw: unknown): PilotMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PilotMediaItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : null;
    const path = typeof o.path === 'string' ? o.path : null;
    if (!id || !path) continue;
    const item: PilotMediaItem = { id, path, type: o.type === 'video' ? 'video' : 'photo' };
    // Rattachement véhicule optionnel — préservé au round-trip jsonb.
    if (typeof o.vehicleId === 'string' && o.vehicleId.length > 0) item.vehicleId = o.vehicleId;
    out.push(item);
  }
  return out;
}

/** Médias de PROFIL = sans rattachement véhicule (rétrocompatible). */
function profileScope(items: PilotMediaItem[]): PilotMediaItem[] {
  return items.filter((m) => m.vehicleId == null);
}

/** Médias d'UN véhicule du garage. */
function vehicleScope(items: PilotMediaItem[], vehicleId: string): PilotMediaItem[] {
  return items.filter((m) => m.vehicleId === vehicleId);
}

/**
 * Signe une liste d'items (URLs temporaires). Fonctionne pour le pilote (ses
 * médias) comme pour le coach affilié — la RLS storage décide. Conserve l'ordre.
 */
export async function signPilotMedia(items: PilotMediaItem[]): Promise<PilotMediaView[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(
    items.map((m) => m.path),
    SIGNED_TTL_SECONDS
  );
  if (error || !data) {
    if (error) console.warn('[OXV][pilotMedia] sign :', error.message);
    return items.map((m) => ({ ...m, signedUrl: null }));
  }
  return items.map((m, i) => ({ ...m, signedUrl: data[i]?.signedUrl ?? null }));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function readRawMedia(userId: string): Promise<PilotMediaItem[]> {
  const { data, error } = await supabase
    .from('users')
    .select('media')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[OXV][pilotMedia] readRawMedia :', error.message);
    return [];
  }
  return parsePilotMedia(data.media);
}

/**
 * Lit les médias de MON profil pilote (avec URLs signées). Les médias rattachés
 * à un véhicule (`vehicleId`) vivent dans le garage, pas ici.
 */
export async function listMyPilotMedia(): Promise<PilotMediaView[]> {
  const id = await currentUserId();
  if (!id) return [];
  return signPilotMedia(profileScope(await readRawMedia(id)));
}

/** Lit les médias d'UN de MES véhicules (avec URLs signées). */
export async function listMyVehicleMedia(vehicleId: string): Promise<PilotMediaView[]> {
  const id = await currentUserId();
  if (!id) return [];
  return signPilotMedia(vehicleScope(await readRawMedia(id), vehicleId));
}

/**
 * Première photo (cover) de CHACUN de mes véhicules, signée — une seule lecture
 * DB + une seule requête de signature pour tout le garage. Clé = vehicleId ;
 * un véhicule sans photo n'a pas d'entrée (l'écran garde alors sa silhouette).
 */
export async function getMyVehicleCovers(): Promise<Record<string, string>> {
  const id = await currentUserId();
  if (!id) return {};
  const firstPhotoByVehicle = new Map<string, PilotMediaItem>();
  for (const m of await readRawMedia(id)) {
    if (m.type !== 'photo' || !m.vehicleId) continue;
    if (!firstPhotoByVehicle.has(m.vehicleId)) firstPhotoByVehicle.set(m.vehicleId, m);
  }
  const signed = await signPilotMedia([...firstPhotoByVehicle.values()]);
  const covers: Record<string, string> = {};
  for (const v of signed) {
    if (v.vehicleId && v.signedUrl) covers[v.vehicleId] = v.signedUrl;
  }
  return covers;
}

type AddResult =
  | { ok: true; items: PilotMediaView[] }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

/**
 * Sélectionne une photo/vidéo, l'envoie dans `pilot-media/{pilotId}/…` puis
 * l'ajoute au jsonb `media`. Rollback du storage si l'écriture DB échoue.
 *
 * `opts.vehicleId` (additif) : rattache le média à un véhicule du garage. Les
 * `items` retournés sont ceux du MÊME périmètre (véhicule si fourni, profil
 * sinon) — chaque écran reçoit sa propre liste, prête à afficher.
 */
export async function addMyPilotMedia(
  type: PilotMediaType,
  opts?: { vehicleId?: string }
): Promise<AddResult> {
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

  // Le typage RN du Blob (globals.d.ts) est plus étroit que son runtime : les
  // parts sont typées Array<Blob | string> et `lastModified` est requis dans
  // les options, alors qu'un Uint8Array + { type } passent (validé en prod).
  // Signature locale fidèle au runtime — cast type-only, aucun changement.
  const BlobCtor = Blob as unknown as new (parts: Uint8Array[], options: { type: string }) => Blob;
  let blob: Blob;
  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    blob = new BlobCtor([Buffer.from(base64, 'base64')], { type: mime });
  } catch (e) {
    console.warn('[OXV][pilotMedia] read file :', e);
    return { ok: false, error: "Ce fichier n'a pas pu être lu. Réessayez avec un autre." };
  }

  const mediaId = crypto.randomUUID();
  const path = `${id}/${mediaId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (upErr) {
    console.warn('[OXV][pilotMedia] upload :', upErr.message);
    return { ok: false, error: "L'envoi du média a échoué. Réessayez dans un instant." };
  }

  const added: PilotMediaItem = { id: mediaId, path, type };
  if (opts?.vehicleId) added.vehicleId = opts.vehicleId;
  const next = [...(await readRawMedia(id)), added];
  const { error: updErr } = await supabase
    .from('users')
    // PilotMediaItem[] -> Json : l'interface n'a pas d'index signature, cast au bord DB.
    .update({ media: next as unknown as Json })
    .eq('id', id);
  if (updErr) {
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => undefined);
    console.warn('[OXV][pilotMedia] update media :', updErr.message);
    return { ok: false, error: "Le média n'a pas pu être enregistré." };
  }

  const scoped = opts?.vehicleId ? vehicleScope(next, opts.vehicleId) : profileScope(next);
  return { ok: true, items: await signPilotMedia(scoped) };
}

/**
 * Retire un média (storage + jsonb) de MON profil pilote ou de MON véhicule.
 * Les `items` retournés suivent le périmètre du média retiré (véhicule si
 * l'item était rattaché, profil sinon).
 */
export async function removeMyPilotMedia(
  mediaId: string
): Promise<{ ok: true; items: PilotMediaView[] } | { ok: false; error: string }> {
  const id = await currentUserId();
  if (!id) return { ok: false, error: 'Vous devez être connecté pour retirer un média.' };

  const current = await readRawMedia(id);
  const target = current.find((m) => m.id === mediaId);
  const next = current.filter((m) => m.id !== mediaId);

  const { error: updErr } = await supabase
    .from('users')
    .update({ media: next as unknown as Json })
    .eq('id', id);
  if (updErr) {
    console.warn('[OXV][pilotMedia] remove update :', updErr.message);
    return { ok: false, error: "Le média n'a pas pu être retiré." };
  }

  if (target) {
    await supabase.storage
      .from(BUCKET)
      .remove([target.path])
      .catch(() => undefined);
  }

  const scoped = target?.vehicleId ? vehicleScope(next, target.vehicleId) : profileScope(next);
  return { ok: true, items: await signPilotMedia(scoped) };
}
