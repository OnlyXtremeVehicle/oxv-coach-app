/**
 * Lecture des insights d'une session (table `session_insights`).
 *
 * Renvoie la dernière ligne MESURÉE pour une séance, ou null.
 *
 * Le filtre sur `engine_version` est le cœur de ce service. La production porte
 * encore une ligne `mirror-insights-demo` dont les chiffres sont fabriqués :
 * sans ce filtre, quatre lectures approfondies affichaient une invention comme
 * une mesure. Une ligne d'un moteur non reconnu est donc traitée comme absente,
 * et l'écran tombe sur son état vide — qui est vrai.
 */

import { supabase } from '@/lib/supabase';
import {
  insightsMesures,
  MOTEURS_INSIGHTS_REELS,
  type AnatomyCorner,
  type CornerRecord,
  type DataQuality,
  type IdealLap,
  type SessionInsights,
} from '@/circuit/sessionInsights';

export async function fetchSessionInsights(
  telemetrySessionId: string
): Promise<SessionInsights | null> {
  const { data, error } = await supabase
    .from('session_insights')
    .select(
      'telemetry_session_id, user_id, engine_version, computed_at, n_laps, n_frames, anatomy, dispersion, chassis_balance, load_transfer, ideal_lap, data_quality'
    )
    .eq('telemetry_session_id', telemetrySessionId)
    // Le filtre est posé côté serveur pour que « la plus récente » désigne la
    // plus récente MESURE, et non la plus récente ligne — une démo postérieure
    // masquerait sinon un vrai calcul.
    .in('engine_version', MOTEURS_INSIGHTS_REELS as unknown as string[])
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  /**
   * UNE PANNE N'EST PAS UN VIDE — corrigé le 01/09/2026.
   *
   * Les deux cas étaient confondus dans un seul `return null`, et la promesse
   * était donc TOUJOURS tenue. L'appelant, lui, distingue les deux : l'écran de
   * séance est en `Promise.allSettled` et pose `failed.constats` sur un rejet,
   * pour afficher « Lectures indisponibles pour le moment » au lieu d'un vide.
   * Cette branche d'erreur était INATTEIGNABLE — un état honnête écrit, testé,
   * et que rien ne pouvait déclencher.
   *
   * Une base qui ne répond pas et une séance non calculée se lisent
   * différemment : la première invite à réessayer, la seconde à attendre un
   * calcul. Les confondre fait passer une panne pour un état normal.
   *
   * Le contre-exemple vivait dans le même écran : `loadSeanceWeather` lève déjà
   * sur `error`.
   */
  if (error) throw new Error(error.message);
  if (!data) return null;

  // Second verrou, côté client : si le filtre serveur venait à sauter — requête
  // modifiée, vue interposée — on refuse quand même. Le fail-closed vit ici,
  // pas seulement dans la requête.
  if (!insightsMesures({ engine_version: data.engine_version ?? '' })) return null;

  // Les colonnes JSONB arrivent en `Json` ; on les rattache aux formes du contrat.
  return {
    telemetry_session_id: data.telemetry_session_id,
    user_id: data.user_id ?? 'unknown',
    engine_version: data.engine_version ?? '',
    computed_at: data.computed_at ?? null,
    n_laps: data.n_laps ?? 0,
    n_frames: data.n_frames ?? 0,
    anatomy: (data.anatomy as unknown as AnatomyCorner[] | null) ?? null,
    dispersion: (data.dispersion as unknown as CornerRecord | null) ?? null,
    chassis_balance: (data.chassis_balance as unknown as CornerRecord | null) ?? null,
    load_transfer: (data.load_transfer as unknown as CornerRecord | null) ?? null,
    ideal_lap: (data.ideal_lap as unknown as IdealLap | null) ?? null,
    data_quality: (data.data_quality as unknown as DataQuality | null) ?? null,
  };
}
