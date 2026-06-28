/**
 * Service garage — véhicules du pilote (table `vehicles`, own-row) + journal de
 * réglages (`vehicle_setups`, migration 0024). Mémoire matérielle : relier la
 * donnée au matériel. Pressions en bar. Aucun jugement sur les réglages (miroir).
 */

import { supabase } from '@/lib/supabase';

export interface Vehicle {
  id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  notes: string | null;
}

export interface VehicleSetup {
  id: string;
  vehicleId: string;
  tires: string | null;
  brakes: string | null;
  pressureFrontStart: number | null;
  pressureRearStart: number | null;
  pressureFrontEnd: number | null;
  pressureRearEnd: number | null;
  notes: string | null;
  recordedAt: string;
}

function mapVehicle(r: Record<string, unknown>): Vehicle {
  return {
    id: r.id as string,
    brand: (r.brand as string | null) ?? null,
    model: (r.model as string | null) ?? null,
    year: r.year != null ? Number(r.year) : null,
    color: (r.color as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  };
}

function num(v: unknown): number | null {
  return v != null ? Number(v) : null;
}

function mapSetup(r: Record<string, unknown>): VehicleSetup {
  return {
    id: r.id as string,
    vehicleId: r.vehicle_id as string,
    tires: (r.tires as string | null) ?? null,
    brakes: (r.brakes as string | null) ?? null,
    pressureFrontStart: num(r.pressure_front_start),
    pressureRearStart: num(r.pressure_rear_start),
    pressureFrontEnd: num(r.pressure_front_end),
    pressureRearEnd: num(r.pressure_rear_end),
    notes: (r.notes as string | null) ?? null,
    recordedAt: r.recorded_at as string,
  };
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Mes véhicules (RLS own-row). */
export async function listMyVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, color, notes')
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[OXV][garage] listMyVehicles :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapVehicle(r as Record<string, unknown>));
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, color, notes')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapVehicle(data as Record<string, unknown>);
}

export interface AddVehicleInput {
  brand: string;
  model: string;
  year?: number | null;
  color?: string;
}

export async function addVehicle(input: AddVehicleInput): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };
  const brand = input.brand.trim();
  const model = input.model.trim();
  if (!brand || !model) return { ok: false, error: 'Marque et modèle requis.' };

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      user_id: uid,
      brand,
      model,
      year: input.year ?? null,
      color: input.color?.trim() || null,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Création impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

/** Journal de réglages d'un véhicule, du plus récent au plus ancien. */
export async function listSetups(vehicleId: string): Promise<VehicleSetup[]> {
  const { data, error } = await supabase
    .from('vehicle_setups')
    .select(
      'id, vehicle_id, tires, brakes, pressure_front_start, pressure_rear_start, pressure_front_end, pressure_rear_end, notes, recorded_at'
    )
    .eq('vehicle_id', vehicleId)
    .order('recorded_at', { ascending: false });
  if (error) {
    console.warn('[OXV][garage] listSetups :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapSetup(r as Record<string, unknown>));
}

export interface AddSetupInput {
  tires?: string;
  brakes?: string;
  pressureFrontStart?: number | null;
  pressureRearStart?: number | null;
  pressureFrontEnd?: number | null;
  pressureRearEnd?: number | null;
  notes?: string;
}

export async function addSetup(vehicleId: string, input: AddSetupInput): Promise<MutationResult> {
  const { error } = await supabase.from('vehicle_setups').insert({
    vehicle_id: vehicleId,
    tires: input.tires?.trim() || null,
    brakes: input.brakes?.trim() || null,
    pressure_front_start: input.pressureFrontStart ?? null,
    pressure_rear_start: input.pressureRearStart ?? null,
    pressure_front_end: input.pressureFrontEnd ?? null,
    pressure_rear_end: input.pressureRearEnd ?? null,
    notes: input.notes?.trim() || null,
  } as never);
  return error ? { ok: false, error: error.message } : { ok: true };
}
