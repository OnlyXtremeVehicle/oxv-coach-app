/**
 * Service télémétrie session — charge les frames brutes pour les
 * visualisations pro (diagramme G-G, trace vitesse).
 *
 * Distinct de `analyzeSessionService` (qui orchestre l'analyse trackviz
 * pour stocker les marges en base) : ici on lit les frames pour les
 * afficher tels quels.
 *
 * RLS : le pilote voit ses propres frames. Un coach voit celles du
 * pilote suivi grâce à `telemetry_frames_coach_select` (sem 15).
 */

import { supabase } from '@/lib/supabase';
import {
  mapFramesToTrajectory,
  type TrajectoryFramePoint,
  type TrajectoryFrameRow,
} from '@/services/trajectoryLogic';
import {
  frameRowToSessionFrame,
  type FrameRow,
  type SessionFrame,
} from '@/services/sessionTelemetryMapping';

// Convention d'axes + mapper pur : src/services/sessionTelemetryMapping.ts
// (source unique, testée). Ré-exportés ici pour les consommateurs existants.
export {
  frameRowToSessionFrame,
  type FrameRow,
  type SessionFrame,
} from '@/services/sessionTelemetryMapping';

/**
 * Trajectoire GPS d'une séance (lat / lon / vitesse), pour la carte et la Vue
 * unifiée. Source UNIQUE de la requête trajectoire — supprime la copie inline
 * qui vivait dans `carte.tsx` et `data-lab-canvas.tsx` (risque de divergence).
 * Filtrage/conversion délégués à `mapFramesToTrajectory` (pur, testé).
 */
export async function loadSessionTrajectory(
  sessionId: string,
  limit = 1000
): Promise<TrajectoryFramePoint[]> {
  const { data } = await supabase
    .from('telemetry_frames')
    .select('latitude, longitude, speed_kmh')
    .eq('session_id', sessionId)
    .order('elapsed_ms', { ascending: true })
    .limit(limit);
  if (!data) return [];
  return mapFramesToTrajectory(data as TrajectoryFrameRow[]);
}

/**
 * Charge les frames d'une séance ENTIÈRE, paginées par 1000 (plafond PostgREST :
 * un .limit(5000) seul ne rend que 1000 lignes → un QDI calculé sur l'amorce de
 * séance). Borne de sécurité `maxFrames` (60 000 ≈ 40 min à 25 Hz).
 */
export async function loadSessionFrames(
  sessionId: string,
  maxFrames = 60_000
): Promise<SessionFrame[]> {
  const PAGE = 1000;
  const rows: FrameRow[] = [];
  for (let from = 0; from < maxFrames; from += PAGE) {
    const { data, error } = await supabase
      .from('telemetry_frames')
      // `rotation_z` = vitesse de lacet. Sans elle, `aLat`, `curvature` et tout
      // le découpage en virages sont nuls par construction : la colonne est
      // écrite par la capture depuis le premier jour et n'était jamais relue.
      .select(
        'elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z, rotation_z'
      )
      .eq('session_id', sessionId)
      .order('elapsed_ms', { ascending: true })
      .range(from, Math.min(from + PAGE, maxFrames) - 1);
    if (error) {
      console.warn('[OXV][telemetry] loadSessionFrames :', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as FrameRow[]));
    if (data.length < PAGE) break; // dernière page
  }
  return rows.map(frameRowToSessionFrame);
}

/**
 * Renvoie uniquement les points {gLat, gLong, speedKmh} prêts pour
 * le GGDiagram, en filtrant les frames sans données g valides.
 */
export async function loadGGPoints(
  sessionId: string
): Promise<{ gLat: number; gLong: number; speedKmh: number | null }[]> {
  const frames = await loadSessionFrames(sessionId);
  return frames
    .filter((f) => f.gLat !== null && f.gLong !== null)
    .map((f) => ({
      gLat: f.gLat as number,
      gLong: f.gLong as number,
      speedKmh: f.speedKmh,
    }));
}

/**
 * Plafond de trames rendues pour UN tour.
 *
 * Deux mille trames font quatre-vingts secondes à vingt-cinq hertz. Un tour
 * plus long — et beaucoup de circuits en produisent — revient AMPUTÉ, sans que
 * la requête ne signale quoi que ce soit.
 *
 * Le plafond est exporté parce qu'un appelant ne peut détecter la troncature
 * qu'en comparant à lui : `frames.length === PLAFOND_TRAMES_TOUR` est le seul
 * indice disponible. Le laisser en nombre magique dans la requête rendrait
 * cette détection impossible à écrire sans le dupliquer.
 */
export const PLAFOND_TRAMES_TOUR = 2000;

/**
 * Charge les frames d'un tour spécifique en filtrant par la fenêtre
 * temporelle de ce tour (laps.started_at -> laps.ended_at convertis
 * en elapsed_ms relativement à session.started_at côté requête).
 *
 * V1 simple : on charge toutes les frames de la session et on filtre
 * côté client par lap_number. À terme on stockera lap_number sur
 * `telemetry_frames` pour requêter direct.
 *
 * **Le résultat peut être TRONQUÉ** — voir `PLAFOND_TRAMES_TOUR`. Un appelant
 * qui en tire une grandeur cumulée (distance, delta) doit le dire à l'écran.
 */
export async function loadLapFrames(sessionId: string, lapNumber: number): Promise<SessionFrame[]> {
  // 1. Récupère les bornes du tour
  const { data: laps, error: lapsError } = await supabase
    .from('laps')
    .select('lap_number, started_at, ended_at')
    .eq('session_id', sessionId)
    .eq('lap_number', lapNumber)
    .maybeSingle();

  if (lapsError || !laps) {
    if (lapsError) console.warn('[OXV][telemetry] loadLapFrames lap :', lapsError.message);
    return [];
  }

  // 2. Récupère la session pour avoir started_at de référence
  const { data: session } = await supabase
    .from('telemetry_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return [];

  const sessionStartMs = new Date(session.started_at as string).getTime();
  const lapStartMs = new Date(laps.started_at as string).getTime() - sessionStartMs;
  const lapEndMs = new Date(laps.ended_at as string).getTime() - sessionStartMs;

  // 3. Filtre les frames sur la fenêtre du tour
  const { data, error } = await supabase
    .from('telemetry_frames')
    .select(
      'elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z, rotation_z'
    )
    .eq('session_id', sessionId)
    .gte('elapsed_ms', lapStartMs)
    .lte('elapsed_ms', lapEndMs)
    .order('elapsed_ms', { ascending: true })
    .limit(PLAFOND_TRAMES_TOUR);

  if (error || !data) {
    if (error) console.warn('[OXV][telemetry] loadLapFrames frames :', error.message);
    return [];
  }

  return (data as FrameRow[]).map(frameRowToSessionFrame);
}

/**
 * Renvoie une trace vitesse {progress, speedKmh} où progress est la
 * position relative dans la session (0..1).
 *
 * V1 grossier : progress = index / total. À terme, on calculera la
 * progression réelle via map-matching sur la polyline du circuit
 * pour avoir une vitesse-vs-distance plus précise (un tour rapide
 * et un tour lent auront alors des points alignés sur les mêmes
 * progress, ce qui n'est pas garanti avec elapsed_ms).
 */
export async function loadSpeedTracePoints(
  sessionId: string
): Promise<{ progress: number; speedKmh: number }[]> {
  const frames = await loadSessionFrames(sessionId);
  const validFrames = frames.filter((f) => f.speedKmh !== null);
  if (validFrames.length < 2) return [];

  const total = validFrames.length;
  return validFrames.map((f, i) => ({
    progress: i / (total - 1),
    speedKmh: f.speedKmh as number,
  }));
}

/**
 * Renvoie les points {progress, gLong} pour le ThrottleBrakeTrace.
 * gLong > 0 = throttle, gLong < 0 = brake.
 */
export async function loadThrottleBrakePoints(
  sessionId: string
): Promise<{ progress: number; gLong: number }[]> {
  const frames = await loadSessionFrames(sessionId);
  const validFrames = frames.filter((f) => f.gLong !== null);
  if (validFrames.length < 2) return [];

  const total = validFrames.length;
  return validFrames.map((f, i) => ({
    progress: i / (total - 1),
    gLong: f.gLong as number,
  }));
}
