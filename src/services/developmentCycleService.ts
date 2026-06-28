/**
 * Service programmes adaptatifs coach (C-2, V1.5) — tables pilot_development_cycles
 * + cycle_steps (migration 0027).
 *
 * Doctrine : l'app NE génère NI n'adapte jamais. Le COACH HUMAIN authore l'en-tête
 * (intention en observation) et les axes, et les fait évoluer. Ce service ne fait
 * qu'orchestrer écriture coach / lecture pilote. Aucun score chiffré, aucune
 * suggestion. Le partage au pilote est opt-in (is_shared) ; le contenu partagé
 * passe le garde-fou doctrinal (app isDoctrineSafe + trigger DB).
 */

import { supabase } from '@/lib/supabase';
import { isDoctrineSafe } from '@/services/aiSafetyFilter';

export type CycleStatus = 'active' | 'closed';
export type StepStatus = 'en_cours' | 'atteint';

export interface DevelopmentCycle {
  id: string;
  coachId: string;
  pilotId: string;
  title: string;
  intention: string | null;
  status: CycleStatus;
  isShared: boolean;
  createdAt: string;
}

export interface CycleStep {
  id: string;
  cycleId: string;
  focus: string;
  note: string | null;
  cornerIndexes: number[];
  status: StepStatus;
  position: number;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const CYCLE_COLS = 'id, coach_id, pilot_id, title, intention, status, is_shared, created_at';
const STEP_COLS = 'id, cycle_id, focus, note, corner_indexes, status, position';

function mapCycle(r: Record<string, unknown>): DevelopmentCycle {
  return {
    id: r.id as string,
    coachId: r.coach_id as string,
    pilotId: r.pilot_id as string,
    title: r.title as string,
    intention: (r.intention as string | null) ?? null,
    status: r.status as CycleStatus,
    isShared: Boolean(r.is_shared),
    createdAt: r.created_at as string,
  };
}

function mapStep(r: Record<string, unknown>): CycleStep {
  return {
    id: r.id as string,
    cycleId: r.cycle_id as string,
    focus: r.focus as string,
    note: (r.note as string | null) ?? null,
    cornerIndexes: Array.isArray(r.corner_indexes) ? (r.corner_indexes as number[]) : [],
    status: r.status as StepStatus,
    position: Number(r.position ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Côté COACH (authoring). RLS : is_program_coach_of (niveau strict 'programme').
// ---------------------------------------------------------------------------

/** Les programmes que j'ai authorés (RLS coach). */
export async function listMyCycles(pilotId?: string): Promise<DevelopmentCycle[]> {
  let query = supabase
    .from('pilot_development_cycles')
    .select(CYCLE_COLS)
    .order('created_at', { ascending: false });
  if (pilotId) query = query.eq('pilot_id', pilotId);
  const { data, error } = await query;
  if (error) {
    console.warn('[OXV][cycles] listMyCycles :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapCycle(r as Record<string, unknown>));
}

export async function getCycle(id: string): Promise<DevelopmentCycle | null> {
  const { data, error } = await supabase
    .from('pilot_development_cycles')
    .select(CYCLE_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCycle(data as Record<string, unknown>);
}

export async function createCycle(input: {
  pilotId: string;
  title: string;
  intention?: string;
}): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titre requis.' };

  const { data, error } = await supabase
    .from('pilot_development_cycles')
    .insert({
      coach_id: uid,
      pilot_id: input.pilotId,
      title,
      intention: input.intention?.trim() || null,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Création impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateCycle(
  id: string,
  patch: { title?: string; intention?: string | null; status?: CycleStatus; isShared?: boolean }
): Promise<MutationResult> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.intention !== undefined) update.intention = patch.intention?.trim() || null;
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.closed_at = patch.status === 'closed' ? new Date().toISOString() : null;
  }
  if (patch.isShared !== undefined) update.is_shared = patch.isShared;

  // Garde-fou app : ne pas partager un programme prescriptif (le trigger DB reste
  // le rempart, mais on évite l'aller-retour et on donne une UX claire).
  if (patch.isShared === true && patch.title !== undefined && !isDoctrineSafe(patch.title)) {
    return { ok: false, error: 'Le titre contient une formulation prescriptive.' };
  }

  const { error } = await supabase
    .from('pilot_development_cycles')
    .update(update as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

export async function deleteCycle(id: string): Promise<MutationResult> {
  const { error } = await supabase.from('pilot_development_cycles').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

export async function listSteps(cycleId: string): Promise<CycleStep[]> {
  const { data, error } = await supabase
    .from('cycle_steps')
    .select(STEP_COLS)
    .eq('cycle_id', cycleId)
    .order('position', { ascending: true });
  if (error) {
    console.warn('[OXV][cycles] listSteps :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapStep(r as Record<string, unknown>));
}

export async function addStep(
  cycleId: string,
  input: { focus: string; note?: string; cornerIndexes?: number[]; position?: number }
): Promise<MutationResult> {
  const focus = input.focus.trim();
  if (!focus) return { ok: false, error: 'Focus requis.' };
  const { data, error } = await supabase
    .from('cycle_steps')
    .insert({
      cycle_id: cycleId,
      focus,
      note: input.note?.trim() || null,
      corner_indexes: input.cornerIndexes ?? [],
      position: input.position ?? 0,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Ajout impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateStep(
  id: string,
  patch: { focus?: string; note?: string | null; status?: StepStatus; position?: number }
): Promise<MutationResult> {
  const update: Record<string, unknown> = {};
  if (patch.focus !== undefined) update.focus = patch.focus.trim();
  if (patch.note !== undefined) update.note = patch.note?.trim() || null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.position !== undefined) update.position = patch.position;
  const { error } = await supabase
    .from('cycle_steps')
    .update(update as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

export async function deleteStep(id: string): Promise<MutationResult> {
  const { error } = await supabase.from('cycle_steps').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

// ---------------------------------------------------------------------------
// Côté PILOTE (lecture seule). RLS : pilot_id = auth.uid() ET is_shared.
// ---------------------------------------------------------------------------

export interface SharedCycle extends DevelopmentCycle {
  steps: CycleStep[];
}

/** Les programmes PARTAGÉS me concernant, avec leurs axes (lecture seule). */
export async function listSharedCyclesForMe(): Promise<SharedCycle[]> {
  const { data, error } = await supabase
    .from('pilot_development_cycles')
    .select(CYCLE_COLS)
    .eq('is_shared', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][cycles] listSharedCyclesForMe :', error.message);
    return [];
  }
  const cycles = (data ?? []).map((r) => mapCycle(r as Record<string, unknown>));
  const out: SharedCycle[] = [];
  for (const c of cycles) {
    out.push({ ...c, steps: await listSteps(c.id) });
  }
  return out;
}
