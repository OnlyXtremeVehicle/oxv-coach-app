/**
 * Service permissions modulaires du coach (§8.1 OXV Mirror).
 *
 * Lit les flags de permission du coach courant pour gater les features
 * (dashboard business, gestion de roulages). La sécurité DATA reste
 * portée par les RLS is_coach_of — ces flags pilotent l'UI et l'accès
 * aux fonctionnalités, pas la donnée des pilotes.
 *
 * Voir migration 20260526170000_0032_coach_permissions.sql.
 */

import { supabase } from '@/lib/supabase';

export interface CoachPermissions {
  canViewPilots: boolean;
  canManageOwnSessions: boolean;
  canViewBusinessDashboard: boolean;
}

/** Permissions par défaut (fail-safe : seule la consultation de base). */
export const DEFAULT_COACH_PERMISSIONS: CoachPermissions = {
  canViewPilots: true,
  canManageOwnSessions: false,
  canViewBusinessDashboard: false,
};

interface DbRow {
  can_view_pilots: boolean;
  can_manage_own_sessions: boolean;
  can_view_business_dashboard: boolean;
}

/**
 * Charge les permissions du coach courant. Retourne les permissions de
 * base si aucune ligne (fail-safe) — jamais d'accès avancé par défaut.
 */
export async function loadMyCoachPermissions(): Promise<CoachPermissions> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return DEFAULT_COACH_PERMISSIONS;

  const { data, error } = await supabase
    .from('coach_permissions' as never)
    .select('can_view_pilots, can_manage_own_sessions, can_view_business_dashboard' as never)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[coachPermissions] load error:', error.message);
    return DEFAULT_COACH_PERMISSIONS;
  }

  const row = data as unknown as DbRow;
  return {
    canViewPilots: row.can_view_pilots ?? true,
    canManageOwnSessions: row.can_manage_own_sessions ?? false,
    canViewBusinessDashboard: row.can_view_business_dashboard ?? false,
  };
}
