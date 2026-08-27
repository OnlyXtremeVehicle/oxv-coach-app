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
  /**
   * Véhicule principal du pilote. La colonne existe en base depuis la migration
   * `20260729034110`, avec un index unique PARTIEL : au plus un `true` par
   * pilote, et aucun n'est obligatoire.
   *
   * Le service l'ignorait complètement jusqu'au 12/08/2026 — d'où le repli
   * « le premier enregistré » qui vivait dans `garageLogic`.
   */
  isPrimary: boolean;
  /**
   * Masse en ordre de marche, en kilogrammes. `numeric(6,1)`, posée par la
   * migration `20260729034110`, avec la contrainte `> 100 et < 5000`.
   *
   * LA COLONNE EXISTAIT DEPUIS LE 29/07/2026 ET PERSONNE NE LA LISAIT — comme
   * `is_primary`, sa voisine de migration. Zéro ligne renseignée sur six,
   * aucun formulaire ne l'écrit, ni l'app ni le site.
   *
   * Elle est lue depuis le 26/08/2026 pour la fiche technique du Garage : elle
   * y est la SEULE des cinq valeurs techniques qui existe en base. Tant qu'elle
   * est nulle, la fiche affiche « — » — et c'est l'état normal aujourd'hui.
   */
  massKg: number | null;
  /**
   * Génération telle que désignée au référentiel lors d'une réservation
   * (« 991.2 », « F82 »…). Le site l'écrit sur `public.vehicles` à la
   * confirmation ; elle est la CLÉ de rapprochement avec le référentiel
   * publié — marque et modèle ne suffisent pas à désigner une puissance.
   *
   * Nulle sur les six véhicules du parc au 27/08/2026 : la colonne existe,
   * le code qui la remplit n'est pas encore en production.
   */
  generation: string | null;
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
    isPrimary: r.is_primary === true,
    massKg: r.mass_kg != null ? Number(r.mass_kg) : null,
    generation: (r.generation as string | null) ?? null,
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
    .select('id, brand, model, year, color, notes, is_primary, mass_kg, generation')
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[OXV][garage] listMyVehicles :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapVehicle(r as unknown as Record<string, unknown>));
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, color, notes, is_primary, mass_kg, generation')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapVehicle(data as unknown as Record<string, unknown>);
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

/**
 * Désigne le véhicule principal du pilote.
 *
 * ===========================================================================
 * DEUX ÉCRITURES, ET L'ORDRE COMPTE
 * ===========================================================================
 *
 * L'index en base est UNIQUE PARTIEL : au plus une ligne `is_primary = true`
 * par pilote. Poser le nouveau avant d'avoir retiré l'ancien violerait donc la
 * contrainte, et l'opération échouerait — sans rien casser, mais sans rien
 * faire non plus.
 *
 * On retire d'abord, on pose ensuite. Entre les deux, le pilote n'a
 * momentanément aucun principal : c'est un état que la base accepte, et que
 * l'interface sait afficher, puisque `isPrimary` est faux partout.
 *
 * L'inverse — poser puis retirer — laisserait deux principaux si la seconde
 * écriture échouait. La base le refuserait, mais on aurait construit une
 * opération dont l'échec dépend d'une contrainte plutôt que d'une intention.
 */
export async function setPrimaryVehicle(vehicleId: string): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };

  // 1. Retirer le principal actuel, quel qu'il soit. Aucune ligne concernée
  //    n'est une erreur : un garage sans principal est un cas normal.
  const { error: retrait } = await supabase
    .from('vehicles')
    .update({ is_primary: false } as never)
    .eq('user_id', uid)
    .eq('is_primary', true);
  if (retrait) return { ok: false, error: retrait.message };

  // 2. Poser le nouveau. La RLS borne déjà au pilote ; le filtre `user_id`
  //    reste explicite, comme partout dans ce service.
  const { error: pose } = await supabase
    .from('vehicles')
    .update({ is_primary: true } as never)
    .eq('id', vehicleId)
    .eq('user_id', uid);
  if (pose) return { ok: false, error: pose.message };

  return { ok: true };
}
