/**
 * Service « lecture du coach » (§10.3c-D) — accès Supabase.
 *
 * - Coach : crée / met à jour ses pondérations (une ligne par coach).
 * - Pilote : lit les pondérations de ses coachs consentis (RLS).
 *
 * Logique pure (calcul, validation) dans `coachReadingLogic.ts`.
 * Voir migration 20260526250000_0040_coach_reading_weights.sql.
 */

import { supabase } from '@/lib/supabase';

import { type CoachReadingWeights, type ReadingWeightsInput } from './coachReadingLogic';

interface WeightsRow {
  coach_id: string;
  w_vehicle: number;
  w_pilot: number;
  w_regularity: number;
  w_smoothness: number;
  note: string | null;
  updated_at: string;
}

function mapRow(row: WeightsRow): CoachReadingWeights {
  return {
    coachId: row.coach_id,
    wVehicle: Number(row.w_vehicle),
    wPilot: Number(row.w_pilot),
    wRegularity: Number(row.w_regularity),
    wSmoothness: Number(row.w_smoothness),
    note: row.note,
    updatedAt: row.updated_at,
  };
}

/** Pondérations du coach courant (ou null si non définies). */
export async function getMyReadingWeights(): Promise<CoachReadingWeights | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const { data, error } = await supabase
    .from('coach_reading_weights' as never)
    .select('*' as never)
    .eq('coach_id', coachId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[coachReading] getMyReadingWeights error:', error.message);
    return null;
  }
  return mapRow(data as unknown as WeightsRow);
}

/** Pondérations des coachs du pilote courant (via RLS is_my_coach). */
export async function listReadingWeightsForMe(): Promise<CoachReadingWeights[]> {
  const { data, error } = await supabase
    .from('coach_reading_weights' as never)
    .select('*' as never);

  if (error || !data) {
    if (error) console.warn('[coachReading] listReadingWeightsForMe error:', error.message);
    return [];
  }
  return (data as unknown as WeightsRow[]).map(mapRow);
}

/** Crée ou met à jour les pondérations du coach courant. */
export async function upsertReadingWeights(
  input: ReadingWeightsInput
): Promise<CoachReadingWeights | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const payload = {
    coach_id: coachId,
    w_vehicle: input.wVehicle,
    w_pilot: input.wPilot,
    w_regularity: input.wRegularity,
    w_smoothness: input.wSmoothness,
    note: input.note?.trim() || null,
  };

  const { data, error } = await supabase
    .from('coach_reading_weights' as never)
    .upsert(payload as never, { onConflict: 'coach_id' } as never)
    .select('*' as never)
    .single();

  if (error || !data) {
    if (error) console.warn('[coachReading] upsertReadingWeights error:', error.message);
    return null;
  }
  return mapRow(data as unknown as WeightsRow);
}
