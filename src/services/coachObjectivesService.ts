/**
 * Objectifs de plan coach (P-plan). Câble la table EXISTANTE `coach_objectives`
 * (aucun schéma nouveau). Le coach assigne à SON pilote des objectifs mesurables
 * (métrique + direction + cible), suivis par statut. Côté pilote, ils
 * apparaissent attribués (« les objectifs de votre coach ») — le coach est un
 * humain, il peut viser ; l'app ne fait que stocker/afficher, jamais prescrire.
 *
 * RLS : le coach ne voit/gère que SES objectifs pour SES pilotes ; le pilote lit
 * les siens. Aucune donnée fabriquée : cible/baseline restent null si non posées.
 */

import { supabase } from '@/lib/supabase';
import type {
  ObjectiveMetric,
  ObjectiveDirection,
  ObjectiveStatus,
} from '@/services/coachObjectivesLogic';

// Logique pure (labels, métriques, formatage) déportée hors Supabase pour être
// testable — le service la ré-exporte pour les écrans.
export {
  METRIC_LABEL,
  DIRECTION_LABEL,
  METRICS,
  objectiveTargetLabel,
} from '@/services/coachObjectivesLogic';
export type {
  ObjectiveMetric,
  ObjectiveDirection,
  ObjectiveStatus,
} from '@/services/coachObjectivesLogic';

export interface CoachObjective {
  id: string;
  pilotId: string;
  title: string;
  detail: string | null;
  metric: ObjectiveMetric;
  targetDirection: ObjectiveDirection;
  targetValue: number | null;
  baselineValue: number | null;
  circuitId: string | null;
  cornerIndex: number | null;
  priority: number;
  status: ObjectiveStatus;
  achievedAt: string | null;
  createdAt: string;
}

interface ObjectiveRow {
  id: string;
  pilot_id: string;
  title: string;
  detail: string | null;
  metric: ObjectiveMetric;
  target_direction: ObjectiveDirection;
  target_value: number | null;
  baseline_value: number | null;
  circuit_id: string | null;
  corner_index: number | null;
  priority: number;
  status: ObjectiveStatus;
  achieved_at: string | null;
  created_at: string;
}

function mapRow(r: ObjectiveRow): CoachObjective {
  return {
    id: r.id,
    pilotId: r.pilot_id,
    title: r.title,
    detail: r.detail ?? null,
    metric: r.metric,
    targetDirection: r.target_direction,
    targetValue: r.target_value ?? null,
    baselineValue: r.baseline_value ?? null,
    circuitId: r.circuit_id ?? null,
    cornerIndex: r.corner_index ?? null,
    priority: r.priority,
    status: r.status,
    achievedAt: r.achieved_at ?? null,
    createdAt: r.created_at,
  };
}

async function currentCoachId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Objectifs que CE coach a posés pour CE pilote (actifs d'abord, par priorité). */
export async function listObjectivesForPilot(pilotId: string): Promise<CoachObjective[]> {
  const coachId = await currentCoachId();
  if (!coachId) return [];
  const { data } = await supabase
    .from('coach_objectives')
    .select(
      'id, pilot_id, title, detail, metric, target_direction, target_value, baseline_value, circuit_id, corner_index, priority, status, achieved_at, created_at'
    )
    .eq('coach_id', coachId)
    .eq('pilot_id', pilotId)
    .order('status', { ascending: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });
  const rows = (data as unknown as ObjectiveRow[] | null) ?? [];
  return rows.map(mapRow);
}

export interface CreateObjectiveInput {
  pilotId: string;
  title: string;
  detail?: string | null;
  metric: ObjectiveMetric;
  targetDirection: ObjectiveDirection;
  targetValue?: number | null;
  priority?: number;
}

/** Assigne un nouvel objectif au pilote (émetteur = coach). */
export async function createObjective(
  input: CreateObjectiveInput
): Promise<{ ok: boolean; error?: string }> {
  const coachId = await currentCoachId();
  if (!coachId) return { ok: false, error: 'not_authenticated' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'title_required' };
  const { error } = await supabase.from('coach_objectives').insert({
    coach_id: coachId,
    pilot_id: input.pilotId,
    title,
    detail: input.detail?.trim() || null,
    metric: input.metric,
    target_direction: input.targetDirection,
    target_value: input.targetValue ?? null,
    priority: input.priority ?? 1,
    status: 'active',
  } as never);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Change le statut d'un objectif (achieved renseigne achieved_at côté client). */
export async function setObjectiveStatus(
  id: string,
  status: ObjectiveStatus,
  achievedAtIso: string | null
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { status };
  if (status === 'achieved') patch.achieved_at = achievedAtIso;
  const { error } = await supabase
    .from('coach_objectives')
    .update(patch as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
