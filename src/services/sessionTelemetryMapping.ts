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
 *
 * ---
 *
 * LA VITESSE DE LACET, ET LE FACTEUR 57 QU'ELLE PORTE
 *
 * `rotation_z` est stockée en DEGRÉS par seconde : le parseur divise l'entier
 * du boîtier par cent (centi-°/s → °/s), et le chemin d'écriture recopie cette
 * valeur telle quelle.
 *
 * La banque de calculs, elle, attend des RADIANS par seconde — `Sample.yawRate`
 * le dit, et `κ = ω / v` n'a la dimension d'une courbure qu'à cette condition.
 *
 * Brancher l'un sur l'autre sans convertir donnerait une courbure 57,3 fois trop
 * grande : le segmenteur lirait le tour entier comme un seul virage, et le
 * résultat resterait « cohérent avec lui-même », donc invisible.
 *
 * D'où le nom du champ, qui porte son unité. `yawRateRadS`, jamais `yawRate`.
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
  /**
   * Vitesse de lacet en RADIANS par seconde. `null` si le gyroscope n'a rien
   * rendu sur cette trame.
   *
   * L'unité est dans le nom parce que la base stocke des DEGRÉS par seconde et
   * que la confusion coûterait un facteur 57,3 sur toute courbure.
   */
  yawRateRadS: number | null;
}

/** Ligne brute telemetry_frames (colonnes g et gyroscope). */
export interface FrameRow {
  elapsed_ms: number | string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  g_force_x: number | null;
  g_force_y: number | null;
  g_force_z: number | null;
  /** Lacet en degrés par seconde, tel que la base le stocke. */
  rotation_z?: number | null;
}

/** Degrés par seconde → radians par seconde. */
export const DEG_VERS_RAD = Math.PI / 180;

export function frameRowToSessionFrame(row: FrameRow): SessionFrame {
  const rotZ = row.rotation_z;
  return {
    elapsedMs: Number(row.elapsed_ms),
    lat: row.latitude !== null ? Number(row.latitude) : null,
    lon: row.longitude !== null ? Number(row.longitude) : null,
    speedKmh: row.speed_kmh !== null ? Number(row.speed_kmh) : null,
    gLat: row.g_force_y !== null ? Number(row.g_force_y) : null,
    gLong: row.g_force_x !== null ? -Number(row.g_force_x) : null,
    gVert: row.g_force_z !== null ? Number(row.g_force_z) : null,
    // `undefined` (colonne non demandée) et `null` (mesure absente) mènent tous
    // deux à `null` : dans les deux cas, on ne sait pas.
    yawRateRadS: rotZ !== null && rotZ !== undefined ? Number(rotZ) * DEG_VERS_RAD : null,
  };
}
