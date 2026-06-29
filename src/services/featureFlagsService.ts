/**
 * Service feature flags (PR-85).
 *
 * Drapeaux activables/desactivables + versions d'algos (champ `value` jsonb).
 * Lecture par tout user authentifie (l'app peut conditionner une fonctionnalite) ;
 * ecriture admin (RLS is_admin). Back-office, aucune donnee pilote.
 */

import { supabase } from '@/lib/supabase';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value: unknown;
  description: string | null;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): FeatureFlag {
  return {
    key: r.key as string,
    enabled: Boolean(r.enabled),
    value: r.value ?? null,
    description: (r.description as string | null) ?? null,
    updatedAt: r.updated_at as string,
  };
}

export async function listFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('app_feature_flags')
    .select('key, enabled, value, description, updated_at')
    .order('key', { ascending: true });
  if (error) {
    console.warn('[OXV][admin] listFlags :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** Lecture cible : un drapeau est-il activé ? (consommé par l'app). */
export async function isFlagEnabled(key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_feature_flags')
    .select('enabled')
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return false;
  return Boolean((data as Record<string, unknown>).enabled);
}

export async function upsertFlag(input: {
  key: string;
  enabled: boolean;
  description?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('app_feature_flags').upsert(
    {
      key: input.key.trim(),
      enabled: input.enabled,
      description: input.description?.trim() ? input.description.trim() : null,
      updated_by: auth?.user?.id ?? null,
    } as never,
    { onConflict: 'key' }
  );
  if (error) {
    console.warn('[OXV][admin] upsertFlag :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteFlag(key: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('app_feature_flags').delete().eq('key', key);
  if (error) {
    console.warn('[OXV][admin] deleteFlag :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
