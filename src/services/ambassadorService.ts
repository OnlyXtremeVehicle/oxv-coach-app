/**
 * Service Ambassadeur OXV (PR-77).
 *
 * Le pilote pose sa candidature (status `pending`) et rédige une bio ; OXV (admin)
 * active ou révoque. Aucun classement, aucun rang : un rôle factuel. Le statut est
 * gouverné côté base (trigger : seul un admin peut le changer).
 */

import { supabase } from '@/lib/supabase';

export type AmbassadorStatus = 'pending' | 'active' | 'revoked';

export interface AmbassadorProfile {
  id: string;
  userId: string;
  status: AmbassadorStatus;
  bio: string | null;
  since: string | null;
}

function mapRow(r: Record<string, unknown>): AmbassadorProfile {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    status: r.status as AmbassadorStatus,
    bio: (r.bio as string | null) ?? null,
    since: (r.since as string | null) ?? null,
  };
}

/** Profil ambassadeur du user courant, ou null s'il n'a pas candidaté. */
export async function loadMyAmbassador(): Promise<AmbassadorProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('ambassador_profiles')
    .select('id, user_id, status, bio, since')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[OXV] loadMyAmbassador :', error.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

/** Dépose une candidature (status pending). */
export async function applyAsAmbassador(bio: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Non connecté.' };
  const { error } = await supabase
    .from('ambassador_profiles')
    .insert({ user_id: uid, bio: bio.trim() || null } as never);
  if (error) {
    console.warn('[OXV] applyAsAmbassador :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Met à jour sa bio (le statut reste gouverné par OXV). */
export async function updateMyBio(bio: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Non connecté.' };
  const { error } = await supabase
    .from('ambassador_profiles')
    .update({ bio: bio.trim() || null } as never)
    .eq('user_id', uid);
  if (error) {
    console.warn('[OXV] updateMyBio :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── Admin ──────────────────────────────────────────────────────────────────

export interface AdminAmbassador extends AmbassadorProfile {
  pilotName: string;
}

/** Toutes les candidatures (admin). Plus récentes d'abord. */
export async function listAmbassadors(): Promise<AdminAmbassador[]> {
  const { data, error } = await supabase
    .from('ambassador_profiles')
    .select('id, user_id, status, bio, since, created_at, users(first_name, last_name)')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][admin] listAmbassadors :', error.message);
    return [];
  }
  return (data ?? []).map((r0) => {
    const r = r0 as Record<string, unknown>;
    const u = r.users as { first_name?: string | null; last_name?: string | null } | null;
    const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
    return { ...mapRow(r), pilotName: name || 'Pilote' };
  });
}

/** Change le statut d'une candidature (admin uniquement, garanti par trigger + RLS). */
export async function setAmbassadorStatus(
  id: string,
  status: AmbassadorStatus
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { status };
  if (status === 'active') patch.since = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('ambassador_profiles')
    .update(patch as never)
    .eq('id', id);
  if (error) {
    console.warn('[OXV][admin] setAmbassadorStatus :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
