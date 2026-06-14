/**
 * Service export de données — droit à la portabilité (S2, charte 12 / RGPD art. 20).
 *
 * Export 100 % côté app : la RLS autorise déjà le pilote à lire SES propres
 * lignes (own-row). On rassemble donc ses données dans un JSON structuré, lisible
 * par machine, écrit dans un fichier et partagé via la share sheet native —
 * immédiat, sans backend ni email.
 *
 * Périmètre : profil, sessions, analyses, segments, insights, tours, médias,
 * partages. Les trames brutes (`telemetry_frames`, volumineuses, 25 Hz) sont
 * EXCLUES de l'export automatique pour des raisons de taille ; leur durée de
 * conservation est par ailleurs bornée (12 mois, cf. politique §6). Elles
 * peuvent être fournies sur demande (contact@oxvehicle.fr).
 */

// eslint-disable-next-line import/no-unresolved -- expo-file-system installé, résolu au build natif
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase';

export interface ExportResult {
  ok: boolean;
  error?: string;
  /** Nombre de sessions exportées (indicatif pour l'UI). */
  sessionCount?: number;
}

interface ExportPayload {
  exported_at: string;
  format_version: number;
  note: string;
  /** true si au moins une section a échoué (RLS/réseau) — l'export est partiel. */
  partial: boolean;
  /** Sections dont la lecture a échoué (vides dans cet export). */
  failed_sections: string[];
  profile: unknown;
  telemetry_sessions: unknown[];
  vehicles: unknown[];
  pilot_goals: unknown[];
  pilot_friendships: unknown[];
  app_session_analyses: unknown[];
  app_segment_analyses: unknown[];
  session_insights: unknown[];
  laps: unknown[];
  session_media: unknown[];
  progression_shares: unknown[];
}

async function collectMyData(userId: string, exportedAtIso: string): Promise<ExportPayload> {
  const failed: string[] = [];

  /** Lit une table en NOTANT l'échec (au lieu de le masquer) : honnêteté de l'export. */
  async function rows<T>(
    table: string,
    promise: PromiseLike<{ data: T[] | null; error: unknown }>
  ): Promise<T[]> {
    try {
      const { data, error } = await promise;
      if (error) {
        failed.push(table);
        return [];
      }
      return data ?? [];
    } catch {
      failed.push(table);
      return [];
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) failed.push('profile');

  const sessions = await rows(
    'telemetry_sessions',
    supabase.from('telemetry_sessions').select('*').eq('user_id', userId)
  );
  const sessionIds = sessions
    .map((s) => (s as { id?: string }).id)
    .filter((id): id is string => typeof id === 'string');

  // Tables filtrées directement par user_id (données fournies par le pilote).
  const [vehicles, goals, friendships, analyses, insights, shares] = await Promise.all([
    rows('vehicles', supabase.from('vehicles').select('*').eq('user_id', userId)),
    rows('pilot_goals', supabase.from('pilot_goals').select('*').eq('user_id', userId)),
    rows(
      'pilot_friendships',
      supabase.from('pilot_friendships').select('*').or(`pilot_a.eq.${userId},pilot_b.eq.${userId}`)
    ),
    rows(
      'app_session_analyses',
      supabase.from('app_session_analyses').select('*').eq('user_id', userId)
    ),
    rows('session_insights', supabase.from('session_insights').select('*').eq('user_id', userId)),
    rows(
      'app_progression_shares',
      supabase.from('app_progression_shares').select('*').eq('user_id', userId)
    ),
  ]);

  // Tables liées à la session (filtrées par les sessions du pilote).
  const [segments, laps, media] = sessionIds.length
    ? await Promise.all([
        rows(
          'app_segment_analyses',
          supabase.from('app_segment_analyses').select('*').in('telemetry_session_id', sessionIds)
        ),
        rows('laps', supabase.from('laps').select('*').in('session_id', sessionIds)),
        rows(
          'session_media',
          supabase.from('session_media').select('*').in('telemetry_session_id', sessionIds)
        ),
      ])
    : [[], [], []];

  return {
    exported_at: exportedAtIso,
    format_version: 1,
    note: 'Export de vos données OXV Mirror. Les trames brutes du boîtier (telemetry_frames) sont exclues pour des raisons de taille ; disponibles sur demande à contact@oxvehicle.fr.',
    partial: failed.length > 0,
    failed_sections: failed,
    profile: profile ?? null,
    telemetry_sessions: sessions,
    vehicles,
    pilot_goals: goals,
    pilot_friendships: friendships,
    app_session_analyses: analyses,
    app_segment_analyses: segments,
    session_insights: insights,
    laps,
    session_media: media,
    progression_shares: shares,
  };
}

/**
 * Rassemble les données du pilote, écrit un JSON et ouvre la share sheet.
 */
export async function exportAndShareMyData(userId: string): Promise<ExportResult> {
  try {
    const exportedAt = new Date().toISOString();
    const payload = await collectMyData(userId, exportedAt);
    const json = JSON.stringify(payload, null, 2);

    const uri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ''}oxv-mes-donnees.json`;
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Mes données OXV',
        UTI: 'public.json',
      });
    }

    return { ok: true, sessionCount: payload.telemetry_sessions.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[OXV][export] :', message);
    return { ok: false, error: message };
  }
}
