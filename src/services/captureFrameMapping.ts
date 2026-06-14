/**
 * Mapping pur trame RaceBox → ligne `telemetry_frames` (P0, write path Valence).
 *
 * Sépare la transformation (testable, sans React Native ni Supabase) de
 * l'orchestration réseau (captureSessionService). Les colonnes produites sont
 * exactement celles relues par l'analyse (analyzeSessionService.fetchSamplesFromFrames :
 * elapsed_ms, latitude, longitude, altitude_m, gps_accuracy_m, gps_fix, satellites,
 * speed_kmh, heading, g_force_x/y/z, battery_level) + le contexte inertiel complet.
 */

import { GpsFix, type RaceBoxData } from '@/types/telemetry';

/** Une ligne à insérer dans public.telemetry_frames. */
export interface TelemetryFrameInsert {
  session_id: string;
  elapsed_ms: number;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  speed_kmh: number | null;
  speed_ms: number | null;
  heading: number | null;
  gps_fix: number | null;
  fix_valid: boolean | null;
  gps_accuracy_m: number | null;
  satellites: number | null;
  g_force_x: number | null;
  g_force_y: number | null;
  g_force_z: number | null;
  rotation_x: number | null;
  rotation_y: number | null;
  rotation_z: number | null;
  battery_level: number | null;
  itow_ms: number | null;
}

/**
 * Convertit une trame parsée en ligne telemetry_frames pour la session donnée.
 * `elapsedMs` = ms depuis le début de la capture (clé d'ordonnancement).
 */
export function raceBoxToFrameInsert(
  frame: RaceBoxData,
  sessionId: string,
  elapsedMs: number
): TelemetryFrameInsert {
  return {
    session_id: sessionId,
    elapsed_ms: Math.max(0, Math.round(elapsedMs)),
    latitude: frame.gps.latitude,
    longitude: frame.gps.longitude,
    altitude_m: frame.gps.altitude,
    speed_kmh: frame.motion.speed,
    // RaceBox renvoie la vitesse en km/h ; on dérive m/s pour la colonne dédiée.
    speed_ms: frame.motion.speed / 3.6,
    heading: frame.motion.headingValid ? frame.motion.heading : null,
    gps_fix: frame.gps.fix,
    fix_valid: frame.gps.fix >= GpsFix.Fix3D,
    gps_accuracy_m: frame.gps.accuracy,
    satellites: frame.gps.satellites,
    g_force_x: frame.imu.gForceX,
    g_force_y: frame.imu.gForceY,
    g_force_z: frame.imu.gForceZ,
    rotation_x: frame.imu.rotRateX,
    rotation_y: frame.imu.rotRateY,
    rotation_z: frame.imu.rotRateZ,
    battery_level: frame.battery.level,
    itow_ms: frame.timestamp.iTOW,
  };
}

/** Maxima courants d'une session, pour les agrégats telemetry_sessions. */
export interface SessionMaxima {
  maxSpeedKmh: number;
  maxGLateral: number;
  maxGLongitudinal: number;
}

export const EMPTY_MAXIMA: SessionMaxima = {
  maxSpeedKmh: 0,
  maxGLateral: 0,
  maxGLongitudinal: 0,
};

/**
 * Met à jour les maxima avec une trame. Convention RaceBox montée : X =
 * longitudinal (accel/frein), Y = latéral (virage), Z = vertical.
 */
export function updateMaxima(m: SessionMaxima, frame: RaceBoxData): SessionMaxima {
  return {
    maxSpeedKmh: Math.max(m.maxSpeedKmh, frame.motion.speed),
    maxGLateral: Math.max(m.maxGLateral, Math.abs(frame.imu.gForceY)),
    maxGLongitudinal: Math.max(m.maxGLongitudinal, Math.abs(frame.imu.gForceX)),
  };
}
