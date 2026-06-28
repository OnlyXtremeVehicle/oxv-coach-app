/**
 * Service admin — annuaire utilisateurs + gestion de rôle AUDITÉE (PR-12).
 *
 * Le changement de `users.role` est tracé automatiquement dans `admin_audit`
 * par le trigger `trg_audit_user_role_change` (migration 0015) : on n'a rien à
 * faire de plus côté app pour l'audit. On synchronise `is_admin` avec
 * `role='admin'` pour ne jamais diverger. Suspension et notes admin sont des
 * actions admin classiques (colonnes existantes).
 *
 * RLS : `is_admin()` lit/écrit la table `users` au-delà de own-row.
 */

import { supabase } from '@/lib/supabase';

import type { UserRole } from '@/store/useAuthStore';

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'pilot', label: 'Pilote' },
  { value: 'pro_pilot', label: 'Pilote pro' },
  { value: 'coach', label: 'Coach' },
  { value: 'partner', label: 'Partenaire' },
  { value: 'admin', label: 'Admin' },
];

export function roleLabel(role: UserRole | null): string {
  return USER_ROLES.find((r) => r.value === role)?.label ?? '—';
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole | null;
  isAdmin: boolean;
  suspendedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface AdminUserDetail extends AdminUser {
  suspensionReason: string | null;
  adminNotes: string | null;
  pactAcceptedAt: string | null;
  cguAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  deletionScheduledAt: string | null;
}

const LIST_COLS =
  'id, email, first_name, last_name, role, is_admin, suspended_at, last_login_at, created_at';
const DETAIL_COLS =
  LIST_COLS +
  ', suspension_reason, admin_notes, pact_accepted_at, cgu_accepted_at, privacy_accepted_at, deletion_scheduled_at';

function mapUser(r: Record<string, unknown>): AdminUser {
  return {
    id: r.id as string,
    email: r.email as string,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    role: (r.role as UserRole | null) ?? null,
    isAdmin: Boolean(r.is_admin),
    suspendedAt: (r.suspended_at as string | null) ?? null,
    lastLoginAt: (r.last_login_at as string | null) ?? null,
    createdAt: (r.created_at as string | null) ?? null,
  };
}

function mapDetail(r: Record<string, unknown>): AdminUserDetail {
  return {
    ...mapUser(r),
    suspensionReason: (r.suspension_reason as string | null) ?? null,
    adminNotes: (r.admin_notes as string | null) ?? null,
    pactAcceptedAt: (r.pact_accepted_at as string | null) ?? null,
    cguAcceptedAt: (r.cgu_accepted_at as string | null) ?? null,
    privacyAcceptedAt: (r.privacy_accepted_at as string | null) ?? null,
    deletionScheduledAt: (r.deletion_scheduled_at as string | null) ?? null,
  };
}

/** Annuaire (RLS admin). Filtre optionnel par rôle ; recherche texte côté écran. */
export async function listUsers(role?: UserRole): Promise<AdminUser[]> {
  let q = supabase
    .from('users')
    .select(LIST_COLS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (role) q = q.eq('role', role);

  const { data, error } = await q;
  if (error) {
    console.warn('[OXV][admin][users] listUsers :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapUser(r as Record<string, unknown>));
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const { data, error } = await supabase
    .from('users')
    .select(DETAIL_COLS)
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapDetail(data as unknown as Record<string, unknown>);
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

/**
 * Change le rôle (tracé dans admin_audit par le trigger 0015). `is_admin` est
 * synchronisé pour rester cohérent avec `role='admin'`.
 */
export async function setUserRole(userId: string, role: UserRole): Promise<MutationResult> {
  const { error } = await supabase
    .from('users')
    .update({ role, is_admin: role === 'admin' } as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Suspend ou réactive un compte. */
export async function setSuspended(
  userId: string,
  suspended: boolean,
  reason?: string
): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  const patch = suspended
    ? {
        suspended_at: new Date().toISOString(),
        suspended_by: uid,
        suspension_reason: reason?.trim() || null,
      }
    : { suspended_at: null, suspended_by: null, suspension_reason: null };

  const { error } = await supabase
    .from('users')
    .update(patch as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Note interne admin (jamais visible du pilote). */
export async function setAdminNotes(userId: string, notes: string): Promise<MutationResult> {
  const { error } = await supabase
    .from('users')
    .update({ admin_notes: notes.trim() || null } as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
