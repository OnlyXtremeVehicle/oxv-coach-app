/**
 * Service configuration applicative globale (PR-45/46).
 *
 * Lit/écrit le singleton `app_config` : kill-switch maintenance + version native
 * minimale. La lecture est publique (l'app interroge tôt) ; l'écriture est admin
 * (RLS is_admin). `isVersionBelow` est PUR (testé) pour décider la MAJ obligatoire.
 */

import { supabase } from '@/lib/supabase';

export interface AppConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  minSupportedVersion: string | null;
}

export async function loadAppConfig(): Promise<AppConfig | null> {
  const { data, error } = await supabase
    .from('app_config')
    .select('maintenance_mode, maintenance_message, min_supported_version')
    .eq('id', true)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[OXV] loadAppConfig :', error.message);
    return null;
  }
  const r = data as Record<string, unknown>;
  return {
    maintenanceMode: Boolean(r.maintenance_mode),
    maintenanceMessage: (r.maintenance_message as string | null) ?? null,
    minSupportedVersion: (r.min_supported_version as string | null) ?? null,
  };
}

export async function updateAppConfig(patch: {
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  minSupportedVersion?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = {};
  if (patch.maintenanceMode !== undefined) row.maintenance_mode = patch.maintenanceMode;
  if (patch.maintenanceMessage !== undefined) row.maintenance_message = patch.maintenanceMessage;
  if (patch.minSupportedVersion !== undefined)
    row.min_supported_version = patch.minSupportedVersion;
  const { data: auth } = await supabase.auth.getUser();
  row.updated_by = auth?.user?.id ?? null;
  const { error } = await supabase
    .from('app_config')
    .update(row as never)
    .eq('id', true);
  if (error) {
    console.warn('[OXV] updateAppConfig :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
