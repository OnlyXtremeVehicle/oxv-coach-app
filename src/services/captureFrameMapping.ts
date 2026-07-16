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

/**
 * Prochain `elapsed_ms` d'une capture — suite STRICTEMENT croissante (Valencia §4.6).
 *
 * `elapsed_ms` n'est pas qu'une colonne d'ordonnancement : c'est la CLÉ
 * D'IDEMPOTENCE des trames (UNIQUE (session_id, elapsed_ms) + UPSERT
 * ON CONFLICT DO NOTHING côté file de synchro). Deux trames RÉELLES et
 * DISTINCTES qui partageraient un `elapsed_ms` seraient donc SILENCIEUSEMENT
 * JETÉES par la base. Or elles le peuvent :
 *
 *   - le RaceBox livre PLUSIEURS trames par notification BLE, émises dans le
 *     MÊME tick synchrone (UbxFrameBuffer draine toutes les trames complètes
 *     d'une notification en boucle) → même `Date.now()` ;
 *   - un blocage du thread JS (GC, sérialisation d'un lot) fait délivrer les
 *     notifications en attente dos à dos, dans la même milliseconde ;
 *   - un RECUL D'HORLOGE (resynchro NTP au retour réseau) fait reculer
 *     `now - startMs` pendant plusieurs secondes.
 *
 * D'où le `+ 1` : on ne se contente pas d'interdire le RECUL (`Math.max` avec
 * `lastElapsed`, qui produit des ex æquo), on impose une STRICTE croissance.
 * Arbitrage assumé : pendant un recul d'horloge, l'horodatage avance de 1 ms
 * par trame au lieu de se figer — le timing est temporairement compressé (faux
 * de quelques ms, et la suite se recale seule quand l'horloge murale rattrape)
 * mais AUCUNE trame n'est détruite. Garder la donnée avec un timing légèrement
 * faux vaut mieux que détruire la donnée : règle fondateur. `itow_ms` reste
 * stocké sur chaque ligne pour le temps GPS exact.
 *
 * Conséquence : `lastElapsed` démarrant à 0, la première trame porte
 * `elapsed_ms >= 1` (la valeur 0 n'est jamais émise en live — sans importance,
 * l'origine est `started_at`).
 */
export function nextElapsedMs(nowMs: number, startMs: number, lastElapsed: number): number {
  return Math.max(nowMs - startMs, lastElapsed + 1);
}

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
