/**
 * Service Admin — Parc de boîtiers + affectations (PR-25).
 *
 * Gère le parc de boîtiers OXV (RaceBox) : liste, ajout, état de santé. Et expose,
 * en lecture, le volume d'affectations par boîtier (device_assignments). Admin-only
 * (RLS is_admin). Aucune donnée pilote ici — un boîtier est un équipement.
 */

import { supabase } from '@/lib/supabase';

export type DeviceHealth = 'ok' | 'maintenance' | string;

export interface AdminDevice {
  id: string;
  label: string;
  serial: string | null;
  type: string;
  healthStatus: DeviceHealth;
  batteryStatus: string | null;
  notes: string | null;
  assignmentCount: number;
  lastAssignedAt: string | null;
}

/** Liste le parc avec le nombre d'affectations + la dernière, par boîtier. */
export async function listDevices(): Promise<AdminDevice[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('id, label, serial, type, health_status, battery_status, notes')
    .order('label', { ascending: true });
  if (error) {
    console.warn('[OXV][admin] listDevices :', error.message);
    return [];
  }

  const { data: assigns } = await supabase
    .from('device_assignments')
    .select('device_id, assigned_at');
  const countByDevice = new Map<string, number>();
  const lastByDevice = new Map<string, string>();
  for (const a0 of assigns ?? []) {
    const a = a0 as Record<string, unknown>;
    const did = a.device_id as string;
    const at = a.assigned_at as string;
    countByDevice.set(did, (countByDevice.get(did) ?? 0) + 1);
    const prev = lastByDevice.get(did);
    if (!prev || (at && at > prev)) lastByDevice.set(did, at);
  }

  return (data ?? []).map((r0) => {
    const r = r0 as Record<string, unknown>;
    const id = r.id as string;
    return {
      id,
      label: (r.label as string) ?? '',
      serial: (r.serial as string | null) ?? null,
      type: (r.type as string) ?? '',
      healthStatus: (r.health_status as string) ?? 'ok',
      batteryStatus: (r.battery_status as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      assignmentCount: countByDevice.get(id) ?? 0,
      lastAssignedAt: lastByDevice.get(id) ?? null,
    };
  });
}

export async function addDevice(input: {
  label: string;
  serial: string;
  type: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('devices').insert({
    label: input.label.trim(),
    serial: input.serial.trim() || null,
    type: input.type.trim() || 'racebox',
    health_status: 'ok',
  } as never);
  if (error) {
    console.warn('[OXV][admin] addDevice :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function setDeviceHealth(
  id: string,
  health: DeviceHealth
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('devices')
    .update({ health_status: health } as never)
    .eq('id', id);
  if (error) {
    console.warn('[OXV][admin] setDeviceHealth :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
