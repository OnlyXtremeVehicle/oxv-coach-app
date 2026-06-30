/**
 * Boîtier du pilote (V9) — lecture SCOPÉE de son équipement affecté + historique
 * santé. La RLS borne au pilote courant : il ne voit que SON boîtier (via
 * device_assignments), jamais le parc. Le snapshot courant vient de `devices`,
 * l'historique de `device_health_logs`. Best-effort, jamais bloquant.
 */

import { supabase } from '@/lib/supabase';

export interface MyDevice {
  deviceId: string;
  label: string;
  type: string | null;
  serial: string | null;
  batteryStatus: string | null;
  healthStatus: string | null;
  assignedAt: string;
}

export interface DeviceHealthEntry {
  recordedAt: string;
  batteryStatus: string | null;
  healthStatus: string | null;
  rssi: number | null;
}

/** Le boîtier actuellement affecté au pilote (le plus récent), avec son état courant. */
export async function getMyAssignedDevice(): Promise<MyDevice | null> {
  const { data: asg } = await supabase
    .from('device_assignments')
    .select('device_id, assigned_at')
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!asg) return null;
  const a = asg as { device_id: string; assigned_at: string };

  const { data: dev } = await supabase
    .from('devices')
    .select('id, label, type, serial, battery_status, health_status')
    .eq('id', a.device_id)
    .maybeSingle();
  if (!dev) return null;
  const d = dev as {
    id: string;
    label: string | null;
    type: string | null;
    serial: string | null;
    battery_status: string | null;
    health_status: string | null;
  };
  return {
    deviceId: d.id,
    label: d.label ?? 'Boîtier',
    type: d.type,
    serial: d.serial,
    batteryStatus: d.battery_status,
    healthStatus: d.health_status,
    assignedAt: a.assigned_at,
  };
}

/** Historique santé d'un boîtier (le plus récent d'abord). Vide tant qu'aucun relevé. */
export async function getDeviceHealthHistory(
  deviceId: string,
  limit = 10
): Promise<DeviceHealthEntry[]> {
  const { data, error } = await supabase
    .from('device_health_logs')
    .select('recorded_at, battery_status, health_status, rssi')
    .eq('device_id', deviceId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => {
    const row = r as {
      recorded_at: string;
      battery_status: string | null;
      health_status: string | null;
      rssi: number | null;
    };
    return {
      recordedAt: row.recorded_at,
      batteryStatus: row.battery_status,
      healthStatus: row.health_status,
      rssi: row.rssi,
    };
  });
}

/** Journalise un relevé d'état pour SON boîtier (source 'app'), au connect BLE. */
export async function logDeviceHealth(input: {
  deviceId: string;
  batteryStatus?: string | null;
  healthStatus?: string | null;
  rssi?: number | null;
}): Promise<void> {
  const { error } = await supabase.from('device_health_logs').insert({
    device_id: input.deviceId,
    battery_status: input.batteryStatus ?? null,
    health_status: input.healthStatus ?? null,
    rssi: input.rssi ?? null,
    source: 'app',
  } as never);
  if (error) console.warn('[OXV][device] logDeviceHealth :', error.message);
}
