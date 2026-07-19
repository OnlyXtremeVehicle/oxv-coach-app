/**
 * Service overlay vidéo (métadonnées d'alignement) — v2.
 *
 * La vidéo reste STRICTEMENT on-device : cette table ne stocke jamais le média,
 * seulement l'identifiant d'asset local (`local_asset_id`, PHAsset/MediaLibrary)
 * et le décalage temporel image ↔ télémétrie. RLS own-only (ni coach ni staff) —
 * doctrine + RGPD. Idempotence via UNIQUE(session_id, user_id, local_asset_id) :
 * re-caler le même asset met à jour la même ligne.
 *
 * La validation de l'offset est pure et testée dans `videoOverlayLogic.ts`.
 */

import { supabase } from '@/lib/supabase';
import { validateOverlayOffset } from './videoOverlayLogic';

export interface VideoOverlay {
  id: string;
  sessionId: string;
  localAssetId: string;
  /** Décalage image ↔ télémétrie en ms (peut être négatif). */
  offsetMs: number;
  /** Durée du média en ms, si connue. */
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveOffsetInput {
  sessionId: string;
  localAssetId: string;
  offsetMs: number;
  durationMs?: number | null;
}

/**
 * Enregistre (ou re-cale) l'alignement d'un asset vidéo local pour une session.
 * Upsert sur la contrainte d'unicité : un second appel sur le même asset écrase
 * l'offset précédent et rafraîchit `updated_at`. `user_id` = appelant courant.
 */
export async function saveOffset(input: SaveOffsetInput): Promise<{ ok: boolean; error?: string }> {
  const check = validateOverlayOffset({ offsetMs: input.offsetMs, durationMs: input.durationMs });
  if (!check.ok) return { ok: false, error: check.error };

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase.from('video_overlays').upsert(
    {
      session_id: input.sessionId,
      user_id: uid,
      local_asset_id: input.localAssetId,
      offset_ms: input.offsetMs,
      duration_ms: input.durationMs ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,user_id,local_asset_id' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Alignements de l'appelant pour une session (own-row via RLS). Ordonnés par
 * date de création. Erreur transport/RLS remontée.
 */
export async function getForSession(sessionId: string): Promise<VideoOverlay[]> {
  const { data, error } = await supabase
    .from('video_overlays')
    .select('id, session_id, local_asset_id, offset_ms, duration_ms, created_at, updated_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    localAssetId: r.local_asset_id,
    offsetMs: r.offset_ms,
    durationMs: r.duration_ms ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
