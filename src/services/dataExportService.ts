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

/** Exécute une requête de lecture et renvoie [] en cas d'erreur (tolérant). */
async function safeRows<T>(
  promise: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const { data } = await promise;
    return data ?? [];
  } catch {
    return [];
  }
}

interface ExportPayload {
  exported_at: string;
  format_version: number;
  note: string;
  profile: unknown;
  telemetry_sessions: unknown[];
  app_session_analyses: unknown[];
  app_segment_analyses: unknown[];
  session_insights: unknown[];
  laps: unknown[];
  session_media: unknown[];
  progression_shares: unknown[];
}

async function collectMyData(userId: string, exportedAtIso: string): Promise<ExportPayload> {
  const { data: profile } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

  const sessions = await safeRows(
    supabase.from('telemetry_sessions').select('*').eq('user_id', userId)
  );
  const sessionIds = sessions
    .map((s) => (s as { id?: string }).id)
    .filter((id): id is string => typeof id === 'string');

  const [analyses, insights, shares] = await Promise.all([
    safeRows(supabase.from('app_session_analyses').select('*').eq('user_id', userId)),
    safeRows(supabase.from('session_insights').select('*').eq('user_id', userId)),
    safeRows(supabase.from('app_progression_shares').select('*').eq('user_id', userId)),
  ]);

  // Tables liées à la session (filtrées par les sessions du pilote).
  const [segments, laps, media] = sessionIds.length
    ? await Promise.all([
        safeRows(
          supabase.from('app_segment_analyses').select('*').in('telemetry_session_id', sessionIds)
        ),
        safeRows(supabase.from('laps').select('*').in('session_id', sessionIds)),
        safeRows(supabase.from('session_media').select('*').in('telemetry_session_id', sessionIds)),
      ])
    : [[], [], []];

  return {
    exported_at: exportedAtIso,
    format_version: 1,
    note: 'Export de vos données OXV Mirror. Les trames brutes du boîtier (telemetry_frames) sont exclues pour des raisons de taille ; disponibles sur demande à contact@oxvehicle.fr.',
    profile: profile ?? null,
    telemetry_sessions: sessions,
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
