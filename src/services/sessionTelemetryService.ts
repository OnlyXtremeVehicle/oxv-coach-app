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

export interface SessionFrame {
  elapsedMs: number;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  /** g latéral. Convention : positif = droite, négatif = gauche. */
  gLat: number | null;
  /** g longitudinal. Convention : positif = accélération, négatif = freinage. */
  gLong: number | null;
  /** g vertical (bumps). */
  gVert: number | null;
}

/**
 * Charge les frames brutes d'une session pour les visualisations pro.
 *
 * Par défaut limité à 5000 frames (~5 minutes à 20 Hz, suffisant pour
 * une session piste typique de 20 min car les frames sont stockées
 * à fréquence variable). Pour des sessions plus longues, paginer en
 * augmentant `limit` ou en ajoutant un downsample côté serveur.
 */
export async function loadSessionFrames(sessionId: string, limit = 5000): Promise<SessionFrame[]> {
  const { data, error } = await supabase
    .from('telemetry_frames')
    .select('elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z')
    .eq('session_id', sessionId)
    .order('elapsed_ms', { ascending: true })
    .limit(limit);

  if (error || !data) {
    if (error) console.warn('[OXV][telemetry] loadSessionFrames :', error.message);
    return [];
  }

  return data.map((row) => ({
    elapsedMs: Number(row.elapsed_ms),
    lat: row.latitude !== null ? Number(row.latitude) : null,
    lon: row.longitude !== null ? Number(row.longitude) : null,
    speedKmh: row.speed_kmh !== null ? Number(row.speed_kmh) : null,
    // RaceBox convention après montage standard (X = lateral droite,
    // Y = longitudinal forward). On expose tel quel — le client de
    // visualisation interprète les signes.
    gLat: row.g_force_x !== null ? Number(row.g_force_x) : null,
    gLong: row.g_force_y !== null ? Number(row.g_force_y) : null,
    gVert: row.g_force_z !== null ? Number(row.g_force_z) : null,
  }));
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
 * Charge les frames d'un tour spécifique en filtrant par la fenêtre
 * temporelle de ce tour (laps.started_at -> laps.ended_at convertis
 * en elapsed_ms relativement à session.started_at côté requête).
 *
 * V1 simple : on charge toutes les frames de la session et on filtre
 * côté client par lap_number. À terme on stockera lap_number sur
 * `telemetry_frames` pour requêter direct.
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
    .select('elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z')
    .eq('session_id', sessionId)
    .gte('elapsed_ms', lapStartMs)
    .lte('elapsed_ms', lapEndMs)
    .order('elapsed_ms', { ascending: true })
    .limit(2000);

  if (error || !data) {
    if (error) console.warn('[OXV][telemetry] loadLapFrames frames :', error.message);
    return [];
  }

  return data.map((row) => ({
    elapsedMs: Number(row.elapsed_ms),
    lat: row.latitude !== null ? Number(row.latitude) : null,
    lon: row.longitude !== null ? Number(row.longitude) : null,
    speedKmh: row.speed_kmh !== null ? Number(row.speed_kmh) : null,
    gLat: row.g_force_x !== null ? Number(row.g_force_x) : null,
    gLong: row.g_force_y !== null ? Number(row.g_force_y) : null,
    gVert: row.g_force_z !== null ? Number(row.g_force_z) : null,
  }));
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
