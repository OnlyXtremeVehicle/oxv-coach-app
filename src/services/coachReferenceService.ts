/**
 * Service repères de référence coach (§10.3c-A) — accès Supabase.
 *
 * - Coach : crée / met à jour ses repères par virage (un jeu par coach).
 * - Pilote : lit les repères de ses coachs consentis pour un virage (RLS).
 *
 * La logique pure (validation, comparaison) vit dans `coachReferenceLogic.ts`.
 * Voir migration 20260526230000_0038_coach_corner_references.sql.
 */

import { supabase } from '@/lib/supabase';

import { type CoachCornerReference, type CornerReferenceInput } from './coachReferenceLogic';

interface ReferenceRow {
  id: string;
  coach_id: string;
  corner_index: number;
  braking_point_m: number | null;
  target_speed_kmh: number | null;
  trajectory_note: string | null;
  updated_at: string;
}

function num(v: number | null): number | null {
  return v == null ? null : Number(v);
}

function mapRow(row: ReferenceRow): CoachCornerReference {
  return {
    id: row.id,
    coachId: row.coach_id,
    cornerIndex: row.corner_index,
    brakingPointM: num(row.braking_point_m),
    targetSpeedKmh: num(row.target_speed_kmh),
    trajectoryNote: row.trajectory_note,
    updatedAt: row.updated_at,
  };
}

function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Tous les repères du coach courant (pour l'éditeur). */
export async function listMyCornerReferences(): Promise<CoachCornerReference[]> {
  const { data, error } = await supabase
    .from('coach_corner_reference' as never)
    .select('*' as never)
    .order('corner_index', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[coachRef] listMyCornerReferences error:', error.message);
    return [];
  }
  return (data as unknown as ReferenceRow[]).map(mapRow);
}

/**
 * Crée ou met à jour le repère du coach courant sur un virage.
 * coach_id forcé à l'utilisateur courant (la RLS l'exige).
 */
export async function upsertCornerReference(
  cornerIndex: number,
  input: CornerReferenceInput
): Promise<CoachCornerReference | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const payload = {
    coach_id: coachId,
    corner_index: cornerIndex,
    braking_point_m: input.brakingPointM ?? null,
    target_speed_kmh: input.targetSpeedKmh ?? null,
    trajectory_note: clean(input.trajectoryNote),
  };

  const { data, error } = await supabase
    .from('coach_corner_reference' as never)
    .upsert(payload as never, { onConflict: 'coach_id,corner_index' } as never)
    .select('*' as never)
    .single();

  if (error || !data) {
    if (error) console.warn('[coachRef] upsertCornerReference error:', error.message);
    return null;
  }
  return mapRow(data as unknown as ReferenceRow);
}

/**
 * Repères des coachs du pilote courant pour un virage donné (via RLS :
 * seuls les repères de ses coachs actifs+consentis remontent).
 */
export async function listCoachReferencesForCorner(
  cornerIndex: number
): Promise<CoachCornerReference[]> {
  const { data, error } = await supabase
    .from('coach_corner_reference' as never)
    .select('*' as never)
    .eq('corner_index', cornerIndex);

  if (error || !data) {
    if (error) console.warn('[coachRef] listCoachReferencesForCorner error:', error.message);
    return [];
  }
  return (data as unknown as ReferenceRow[]).map(mapRow);
}
