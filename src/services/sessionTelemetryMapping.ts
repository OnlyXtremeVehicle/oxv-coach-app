/**
 * Mapping pur telemetry_frames → SessionFrame — SOURCE UNIQUE de la convention
 * d'axes G, testable sans I/O (sessionTelemetryMapping.test.ts).
 *
 * Convention RaceBox montée, fixée par le WRITE PATH (captureFrameMapping :
 * maxGLateral=|gForceY|, maxGLongitudinal=|gForceX|) et par trackviz/analysis
 * (code V1 validé prod : freinage = g_force_x > 0) :
 *   - g_force_x = LONGITUDINAL, avec x > 0 = FREINAGE ;
 *   - g_force_y = LATÉRAL.
 * Le contrat SessionFrame expose gLong POSITIF = accélération → gLong = −g_force_x.
 * Ne pas modifier un côté sans l'autre : un mapping inversé fausse le QDI entier
 * (fluidité sur le mauvais axe, appuis en virage comptés comme freinages).
 */

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

/** Ligne brute telemetry_frames (colonnes g). */
export interface FrameRow {
  elapsed_ms: number | string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  g_force_x: number | null;
  g_force_y: number | null;
  g_force_z: number | null;
}

export function frameRowToSessionFrame(row: FrameRow): SessionFrame {
  return {
    elapsedMs: Number(row.elapsed_ms),
    lat: row.latitude !== null ? Number(row.latitude) : null,
    lon: row.longitude !== null ? Number(row.longitude) : null,
    speedKmh: row.speed_kmh !== null ? Number(row.speed_kmh) : null,
    gLat: row.g_force_y !== null ? Number(row.g_force_y) : null,
    gLong: row.g_force_x !== null ? -Number(row.g_force_x) : null,
    gVert: row.g_force_z !== null ? Number(row.g_force_z) : null,
  };
}
