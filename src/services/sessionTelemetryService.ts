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
