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
import type { LigneQualite } from '@/features/data/confianceSource';

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
  const fenetre = await fenetreElapsedTour(sessionId, lapNumber);
  if (fenetre === null) return [];

  // Filtre les frames sur la fenêtre du tour
  const { data, error } = await supabase
    .from('telemetry_frames')
    .select(
      'elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z, rotation_z'
    )
    .eq('session_id', sessionId)
    .gte('elapsed_ms', fenetre.debutMs)
    .lte('elapsed_ms', fenetre.finMs)
    .order('elapsed_ms', { ascending: true })
    .limit(PLAFOND_TRAMES_TOUR);

  if (error || !data) {
    if (error) console.warn('[OXV][telemetry] loadLapFrames frames :', error.message);
    return [];
  }

  return (data as FrameRow[]).map(frameRowToSessionFrame);
}

/**
 * Bornes `elapsed_ms` d'un tour — le préambule commun de `loadLapFrames` et
 * `loadTramesQualiteTour` (une seule conversion de fenêtre, pas deux copies).
 *
 * `null` quand le tour n'est pas retrouvé ou n'a pas de borne exploitable.
 */
async function fenetreElapsedTour(
  sessionId: string,
  lapNumber: number
): Promise<{ debutMs: number; finMs: number } | null> {
  // 1. Récupère les bornes du tour
  const { data: laps, error: lapsError } = await supabase
    .from('laps')
    .select('lap_number, started_at, ended_at')
    .eq('session_id', sessionId)
    .eq('lap_number', lapNumber)
    .maybeSingle();

  if (lapsError || !laps) {
    if (lapsError) console.warn('[OXV][telemetry] loadLapFrames lap :', lapsError.message);
    return null;
  }

  // 2. Récupère la session pour avoir started_at de référence
  const { data: session } = await supabase
    .from('telemetry_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return null;

  const sessionStartMs = new Date(session.started_at as string).getTime();
  const lapStartMs = new Date(laps.started_at as string).getTime() - sessionStartMs;
  const lapEndMs = new Date(laps.ended_at as string).getTime() - sessionStartMs;

  /**
   * UN TOUR SANS FIN NE FABRIQUE PLUS UNE URL ABSURDE.
   *
   * Un tour resté ouvert porte `ended_at = null` — le même oubli que celui qui
   * laissait les séances en `recording`. `new Date(null).getTime()` rend `NaN`,
   * et `.lte('elapsed_ms', NaN)` part dans l'URL PostgREST en
   * `elapsed_ms=lte.NaN` : la requête est refusée en 400, le code descend dans
   * son `if (error) return []`, et l'écran conclut « aucune trame GPS » alors
   * que les trames existent.
   *
   * Même famille que le défaut dominant du dépôt : la garde existe, elle avale
   * la panne au lieu de la dire. On refuse ici la borne invalide plutôt que de
   * la laisser voyager.
   */
  if (!Number.isFinite(lapStartMs) || !Number.isFinite(lapEndMs)) {
    console.warn(
      `[OXV][telemetry] loadLapFrames : tour ${lapNumber} sans borne exploitable (started_at/ended_at).`
    );
    return null;
  }

  return { debutMs: lapStartMs, finMs: lapEndMs };
}

/**
 * Canaux de QUALITÉ DE MESURE d'un tour (LOT confiance par zone, M03+) :
 * `gps_accuracy_m`, `pdop`, `satellites`, `fix_valid` — colonnes réelles de
 * `telemetry_frames`, jamais relues jusqu'ici. La vitesse est demandée avec,
 * parce que la position curviligne se DÉRIVE (∫ v dt, cf. `confianceSource`) :
 * les trames ne portent pas leur distance.
 *
 * Même fenêtre et même plafond que `loadLapFrames` — un tour amputé au-delà de
 * `PLAFOND_TRAMES_TOUR` rend une note partielle, que la couverture dira.
 */
export async function loadTramesQualiteTour(
  sessionId: string,
  lapNumber: number
): Promise<LigneQualite[]> {
  const fenetre = await fenetreElapsedTour(sessionId, lapNumber);
  if (fenetre === null) return [];

  const { data, error } = await supabase
    .from('telemetry_frames')
    .select('elapsed_ms, speed_kmh, gps_accuracy_m, pdop, satellites, fix_valid')
    .eq('session_id', sessionId)
    .gte('elapsed_ms', fenetre.debutMs)
    .lte('elapsed_ms', fenetre.finMs)
    .order('elapsed_ms', { ascending: true })
    .limit(PLAFOND_TRAMES_TOUR);

  if (error || !data) {
    if (error) console.warn('[OXV][telemetry] loadTramesQualiteTour :', error.message);
    return [];
  }

  return data as LigneQualite[];
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
