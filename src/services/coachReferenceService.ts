/**
 * Service repères de référence coach (§10.3c-A) — accès Supabase.
 *
 * MULTI-CIRCUIT (migration 20260716180000, appliquée en prod) : un repère
 * appartient à UN circuit — coach_corner_reference porte circuit_id NOT NULL,
 * UNIQUE (coach_id, circuit_id, corner_index). Le virage 3 de Haute Saintonge
 * n'est pas le virage 3 de Ricardo Tormo.
 *
 * - Coach : crée / met à jour ses repères par circuit et par virage.
 * - Pilote : lit les repères de ses coachs consentis pour un virage (RLS).
 *
 * La logique pure (validation, comparaison, compteur) vit dans
 * `coachReferenceLogic.ts`. Les virages d'un circuit viennent de
 * `src/circuit/circuitCorners.ts` (topologie nommée ou tracé réel).
 */

import { supabase } from '@/lib/supabase';

import { type CoachCornerReference, type CornerReferenceInput } from './coachReferenceLogic';
import { getDefaultCircuit } from './circuitsService';

interface ReferenceRow {
  id: string;
  coach_id: string;
  circuit_id: string;
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
    circuitId: row.circuit_id,
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

/** Tous les repères du coach courant sur UN circuit (pour la liste et l'éditeur). */
export async function listMyCornerReferences(circuitId: string): Promise<CoachCornerReference[]> {
  const { data, error } = await supabase
    .from('coach_corner_reference' as never)
    .select('*' as never)
    .eq('circuit_id', circuitId)
    .order('corner_index', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[coachRef] listMyCornerReferences error:', error.message);
    return [];
  }
  return (data as unknown as ReferenceRow[]).map(mapRow);
}

/**
 * Crée ou met à jour le repère du coach courant sur un virage d'UN circuit.
 * coach_id forcé à l'utilisateur courant (la RLS l'exige) ; l'unicité est
 * (coach, circuit, virage).
 */
export async function upsertCornerReference(
  circuitId: string,
  cornerIndex: number,
  input: CornerReferenceInput
): Promise<CoachCornerReference | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const payload = {
    coach_id: coachId,
    circuit_id: circuitId,
    corner_index: cornerIndex,
    braking_point_m: input.brakingPointM ?? null,
    target_speed_kmh: input.targetSpeedKmh ?? null,
    trajectory_note: clean(input.trajectoryNote),
  };

  const { data, error } = await supabase
    .from('coach_corner_reference' as never)
    .upsert(payload as never, { onConflict: 'coach_id,circuit_id,corner_index' } as never)
    .select('*' as never)
    .single();

  if (error || !data) {
    if (error) console.warn('[coachRef] upsertCornerReference error:', error.message);
    return null;
  }
  return mapRow(data as unknown as ReferenceRow);
}

/**
 * Repères des coachs du pilote courant pour un virage d'UN circuit (via RLS :
 * seuls les repères de ses coachs actifs+consentis remontent).
 *
 * `circuitId` optionnel : sans lui, on résout le circuit officiel par défaut
 * (Haute Saintonge — les écrans pilote V1 raisonnent sur sa topologie). Si
 * aucun circuit n'est résoluble, on ne retourne RIEN plutôt que de mélanger
 * les repères d'un autre tracé (le virage 3 d'un circuit n'est pas celui d'un
 * autre).
 */
export async function listCoachReferencesForCorner(
  cornerIndex: number,
  circuitId?: string
): Promise<CoachCornerReference[]> {
  const resolvedCircuitId = circuitId ?? (await getDefaultCircuit())?.id ?? null;
  if (!resolvedCircuitId) return [];

  const { data, error } = await supabase
    .from('coach_corner_reference' as never)
    .select('*' as never)
    .eq('circuit_id', resolvedCircuitId)
    .eq('corner_index', cornerIndex);

  if (error || !data) {
    if (error) console.warn('[coachRef] listCoachReferencesForCorner error:', error.message);
    return [];
  }
  return (data as unknown as ReferenceRow[]).map(mapRow);
}
