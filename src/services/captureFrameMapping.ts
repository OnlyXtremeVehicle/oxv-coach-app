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
  speed_accuracy: number | null;
  heading: number | null;
  heading_accuracy: number | null;
  pdop: number | null;
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
    speed_accuracy: frame.motion.speedAccuracy ?? null,
    // Le cap reste conditionné au drapeau du constructeur : on n'invente pas une
    // validité qu'il ne déclare pas. La PRÉCISION, elle, est écrite dans tous les
    // cas — c'est elle qui dira si le cap écarté était exploitable.
    heading: frame.motion.headingValid ? frame.motion.heading : null,
    heading_accuracy: frame.motion.headingAccuracy ?? null,
    pdop: frame.motion.pdop ?? null,
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

// ---------------------------------------------------------------------------
// MAXIMA PAR TOUR — les colonnes `laps.max_*` / `laps.avg_speed_kmh`.
//
// Elles existent en base depuis 0004_laps_and_circuits.sql mais n'étaient
// JAMAIS écrites, et aucun trigger ne les calculait. `computeSmoothness` lisait
// donc `max_g_lateral ?? 0` sur tous les tours → écart-type nul → fluidité 100
// sur 100 % des séances réelles. Un quart de la marge globale ne venait d'AUCUNE
// mesure. On écrit désormais la donnée à la SOURCE, pendant la capture.
//
// Ces valeurs sont `number | null` et JAMAIS `0` par défaut : le zéro est
// réservé à une mesure qui vaut réellement zéro. Un tour sans aucune trame
// exploitable reste `null` de bout en bout — il se rendra « — », pas « 0 ».
// ---------------------------------------------------------------------------

/**
 * Maxima RÉELLEMENT mesurés sur UN tour. Chaque champ vaut `null` tant qu'aucune
 * trame exploitable ne l'a alimenté.
 */
export interface LapMaxima {
  maxSpeedKmh: number | null;
  /** Latéral = |gForceY| (convention verrouillée, cf. sessionTelemetryMapping). */
  maxGLateral: number | null;
  /** Freinage = part POSITIVE de gForceX (x > 0 = freinage). */
  maxGBraking: number | null;
  /** Accélération = part positive de −gForceX. */
  maxGAccel: number | null;
  /** Somme des vitesses exploitables, pour la moyenne du tour. */
  speedSumKmh: number;
  /** Nombre de vitesses exploitables agrégées. 0 → pas de moyenne (null). */
  speedSampleCount: number;
}

export const EMPTY_LAP_MAXIMA: LapMaxima = {
  maxSpeedKmh: null,
  maxGLateral: null,
  maxGBraking: null,
  maxGAccel: null,
  speedSumKmh: 0,
  speedSampleCount: 0,
};

/** Retient le plus grand, en ignorant un candidat non exploitable (jamais NaN). */
function maxOf(current: number | null, candidate: number): number | null {
  if (!Number.isFinite(candidate)) return current;
  return current === null ? candidate : Math.max(current, candidate);
}

/**
 * Agrège une trame dans les maxima du tour EN COURS (transformation pure).
 *
 * CONVENTION D'AXES — verrouillée par sessionTelemetryMapping.test.ts, ne pas
 * l'inverser : gForceY = LATÉRAL, gForceX = LONGITUDINAL avec x > 0 = FREINAGE.
 * D'où freinage = max(gForceX, 0) et accélération = max(−gForceX, 0) : chaque
 * sens ne retient que sa propre moitié de l'axe. Un tour mesuré sans freinage
 * porte donc un maximum de freinage de 0 — c'est une OBSERVATION (« il n'a
 * jamais freiné »), pas un trou comblé ; le trou, lui, reste `null`.
 */
export function updateLapMaxima(m: LapMaxima, frame: RaceBoxData): LapMaxima {
  const speed = frame.motion.speed;
  const speedUsable = Number.isFinite(speed);
  return {
    maxSpeedKmh: maxOf(m.maxSpeedKmh, speed),
    maxGLateral: maxOf(m.maxGLateral, Math.abs(frame.imu.gForceY)),
    maxGBraking: maxOf(m.maxGBraking, Math.max(0, frame.imu.gForceX)),
    maxGAccel: maxOf(m.maxGAccel, Math.max(0, -frame.imu.gForceX)),
    speedSumKmh: speedUsable ? m.speedSumKmh + speed : m.speedSumKmh,
    speedSampleCount: speedUsable ? m.speedSampleCount + 1 : m.speedSampleCount,
  };
}

/** Les colonnes statistiques d'une ligne `laps`. `null` = rien de mesuré. */
export interface LapStatColumns {
  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  max_g_lateral: number | null;
  max_g_braking: number | null;
  max_g_accel: number | null;
}

/**
 * Projette les maxima d'un tour sur ses colonnes `laps` (transformation pure).
 *
 * `undefined` (tour sans AUCUNE trame rattachée — jamais mesuré) et un
 * accumulateur vide donnent le même résultat : tout `null`. C'est le cœur de la
 * correction — on écrit du réel, ou rien.
 */
export function lapMaximaToColumns(m: LapMaxima | undefined): LapStatColumns {
  return {
    max_speed_kmh: m?.maxSpeedKmh ?? null,
    avg_speed_kmh: m && m.speedSampleCount > 0 ? m.speedSumKmh / m.speedSampleCount : null,
    max_g_lateral: m?.maxGLateral ?? null,
    max_g_braking: m?.maxGBraking ?? null,
    max_g_accel: m?.maxGAccel ?? null,
  };
}
