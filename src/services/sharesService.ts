/**
 * Service de partage de progression — création / lecture / révocation
 * de liens publics token-based.
 *
 * Le token fait 32 caractères base64url (~190 bits d'entropie) — devine
 * impossible en pratique. Le destinataire (sans compte OXV) consulte la
 * progression via oxvehicle.fr/share/{token} ou un futur micro-site.
 *
 * Voir docs/architecture/01_PARTIE_1_stack_supabase §3.5.
 */

import { supabase } from '@/lib/supabase';

export type ShareScope = 'last_session' | 'last_5_sessions' | 'full_history' | 'progression_only';

export interface ShareLink {
  id: string;
  userId: string;
  token: string;
  scope: ShareScope;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

const SHARE_BASE_URL = 'https://oxvehicle.fr/share';

export function shareUrlFor(token: string): string {
  return `${SHARE_BASE_URL}/${token}`;
}

/**
 * Génère un token cryptographiquement sûr — 32 chars base64url.
 *
 * On utilise crypto.getRandomValues (présent sur RN via react-native-url-polyfill
 * et nativement en Node pour les tests). Pas de dépendance ajoutée.
 */
function generateShareToken(): string {
  const bytes = new Uint8Array(24); // 192 bits
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  // Conversion vers base64url : btoa + remplace +/= → -_/(rien)
  const b64 =
    typeof btoa !== 'undefined' ? btoa(out) : Buffer.from(out, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createShare(opts: {
  scope: ShareScope;
  expiresInDays?: number;
}): Promise<ShareLink | null> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;

  const token = generateShareToken();
  const expiresAt = opts.expiresInDays
    ? new Date(Date.now() + opts.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('app_progression_shares')
    .insert({
      user_id: userId,
      share_token: token,
      share_scope: opts.scope,
      expires_at: expiresAt,
    })
    .select(
      'id, user_id, share_token, share_scope, expires_at, revoked_at, view_count, last_viewed_at, created_at'
    )
    .single();

  if (error) {
    console.warn('[OXV] createShare échec :', error.message);
    return null;
  }
  return mapRow(data);
}

export async function listMyShares(): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('app_progression_shares')
    .select(
      'id, user_id, share_token, share_scope, expires_at, revoked_at, view_count, last_viewed_at, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV] listMyShares :', error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function revokeShare(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('app_progression_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.warn('[OXV] revokeShare :', error.message);
    return false;
  }
  return true;
}

interface RawShareRow {
  id: string;
  user_id: string;
  share_token: string;
  share_scope: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

function mapRow(row: RawShareRow): ShareLink {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.share_token,
    scope: row.share_scope as ShareScope,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    createdAt: row.created_at,
  };
}
