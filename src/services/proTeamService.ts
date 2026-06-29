/**
 * Service Espace Équipe du pilote pro (PR-74).
 *
 * Le pro DÉCLARE son entourage (coach, préparateur, assistant) et le révoque d'un
 * geste. Cette table n'accorde AUCUN accès à la télémétrie : c'est une liste de
 * personnes, pas un partage de données (le partage réel sera une étape RLS dédiée
 * et consentie). RLS : le pro ne gère que ses propres membres (is_pro_pilot).
 */

import { supabase } from '@/lib/supabase';

export interface ProTeamMember {
  id: string;
  memberName: string | null;
  memberEmail: string | null;
  roleLabel: string;
  accessLevel: 'none' | 'view';
  invitedAt: string;
  revokedAt: string | null;
}

function mapRow(r: Record<string, unknown>): ProTeamMember {
  return {
    id: r.id as string,
    memberName: (r.member_name as string | null) ?? null,
    memberEmail: (r.member_email as string | null) ?? null,
    roleLabel: (r.role_label as string) ?? 'Membre',
    accessLevel: (r.access_level as 'none' | 'view') ?? 'none',
    invitedAt: r.invited_at as string,
    revokedAt: (r.revoked_at as string | null) ?? null,
  };
}

/** Membres déclarés par le pro courant (récents d'abord). */
export async function listMyTeam(): Promise<ProTeamMember[]> {
  const { data, error } = await supabase
    .from('pro_team_members')
    .select('id, member_name, member_email, role_label, access_level, invited_at, revoked_at')
    .order('invited_at', { ascending: false });
  if (error) {
    console.warn('[OXV][pro] listMyTeam :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function addMember(input: {
  memberName: string;
  memberEmail: string;
  roleLabel: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Non connecté.' };
  const { error } = await supabase.from('pro_team_members').insert({
    pro_user_id: uid,
    member_name: input.memberName.trim() || null,
    member_email: input.memberEmail.trim() || null,
    role_label: input.roleLabel.trim() || 'Membre',
  } as never);
  if (error) {
    console.warn('[OXV][pro] addMember :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Révoque un membre (marque revoked_at). RLS : owns_pro_team. */
export async function revokeMember(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('pro_team_members')
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq('id', id);
  if (error) {
    console.warn('[OXV][pro] revokeMember :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
