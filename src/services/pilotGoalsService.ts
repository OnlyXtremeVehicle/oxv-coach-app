/**
 * Service objectifs personnels du pilote.
 *
 * RLS strict propriétaire (cf. migration 0023) — chaque pilote ne
 * voit que ses propres objectifs. Le coach ne voit RIEN ici
 * (espace intime).
 */

import { supabase } from '@/lib/supabase';

export type GoalStatus = 'active' | 'achieved' | 'continued' | 'abandoned';

export interface PilotGoal {
  id: string;
  userId: string;
  body: string;
  status: GoalStatus;
  evaluatedSessionId: string | null;
  evaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: string;
  user_id: string;
  body: string;
  status: GoalStatus;
  evaluated_session_id: string | null;
  evaluated_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawRow): PilotGoal {
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    evaluatedSessionId: row.evaluated_session_id,
    evaluatedAt: row.evaluated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Récupère l'objectif actif le plus récent du pilote courant (ou null).
 */
export async function getActiveGoal(): Promise<PilotGoal | null> {
  const { data, error } = await supabase
    .from('pilot_goals')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[OXV][goals] getActiveGoal :', error.message);
    return null;
  }
  return data ? mapRow(data as unknown as RawRow) : null;
}

export async function listMyGoals(limit = 20): Promise<PilotGoal[]> {
  const { data, error } = await supabase
    .from('pilot_goals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[OXV][goals] listMyGoals :', error.message);
    return [];
  }
  return (data as unknown as RawRow[]).map(mapRow);
}

/**
 * Crée un nouvel objectif actif (et met les anciens en 'continued').
 */
export async function createGoal(body: string): Promise<PilotGoal | null> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return null;

  // Marque les anciens actifs comme 'continued' (un seul actif à la fois)
  await supabase.from('pilot_goals').update({ status: 'continued' }).eq('status', 'active');

  const { data, error } = await supabase
    .from('pilot_goals')
    .insert({
      user_id: userId,
      body: body.trim(),
      status: 'active',
    })
    .select('*')
    .single();

  if (error || !data) {
    console.warn('[OXV][goals] createGoal :', error?.message ?? 'no data');
    return null;
  }
  return mapRow(data as unknown as RawRow);
}

/**
 * Met à jour le statut d'un objectif (auto-évaluation pilote).
 */
export async function updateGoalStatus(
  id: string,
  status: GoalStatus,
  evaluatedSessionId?: string | null
): Promise<boolean> {
  const update: Record<string, unknown> = { status };
  if (status !== 'active') {
    update.evaluated_at = new Date().toISOString();
    if (evaluatedSessionId !== undefined) {
      update.evaluated_session_id = evaluatedSessionId;
    }
  }

  const { error } = await supabase
    .from('pilot_goals')
    // objet construit dynamiquement (champs conditionnels) -> cast assumé
    .update(update as never)
    .eq('id', id);

  if (error) {
    console.warn('[OXV][goals] updateGoalStatus :', error.message);
    return false;
  }
  return true;
}

export async function deleteGoal(id: string): Promise<boolean> {
  const { error } = await supabase.from('pilot_goals').delete().eq('id', id);
  if (error) {
    console.warn('[OXV][goals] deleteGoal :', error.message);
    return false;
  }
  return true;
}
