/**
 * Forme des insights de session (table `session_insights`, une colonne JSONB par bloc).
 * Sous-ensemble consommé par <CircuitTrace> ; voir le contrat complet :
 * `docs/specs-bundle-v4/CONTRAT_DONNEES_session_insights.json`.
 *
 * Doctrine : la donnée peut être absente (insights précoces). `dispersion` et
 * `load_transfer` peuvent valoir `{}`, `throttle_brake` peut valoir `null` —
 * l'app affiche un état vide explicite, jamais une valeur inventée (doc 09 §5).
 */

export interface AnatomyCorner {
  corner_index: number;
  apex_speed_kmh: number;
  brake_dist_m: number;
  accel_dist_m: number;
  g_lat_apex: number;
}

/** Valeur par virage, clés « corner_1 », « corner_2 »… */
export type CornerRecord = Record<string, number>;

export interface DataQuality {
  frames_used: number;
  frames_dropped: number;
  pct_valid: number;
  corners_detected: number;
  laps_detected: number;
}

export interface SessionInsights {
  telemetry_session_id: string;
  user_id: string;
  engine_version: string;
  n_laps: number;
  n_frames: number;
  anatomy: AnatomyCorner[] | null;
  dispersion: CornerRecord | null;
  chassis_balance: CornerRecord | null;
  load_transfer: CornerRecord | null;
  data_quality: DataQuality | null;
}

/**
 * Démo alignée 7 virages (Haute Saintonge), telle qu'en base
 * (`engine_version = 'mirror-insights-demo'`, session
 * b62ab3af-5d6a-4e88-b316-73a0729933ae). Sert au développement avant Valence ;
 * sera écrasée par le vrai calcul `mirror-insights-v1` (doc 09 §3).
 */
export const DEMO_SESSION_INSIGHTS: SessionInsights = {
  telemetry_session_id: 'b62ab3af-5d6a-4e88-b316-73a0729933ae',
  user_id: 'demo',
  engine_version: 'mirror-insights-demo',
  n_laps: 8,
  n_frames: 11800,
  anatomy: [
    { corner_index: 1, apex_speed_kmh: 95, brake_dist_m: 110, accel_dist_m: 80, g_lat_apex: 1.05 },
    { corner_index: 2, apex_speed_kmh: 72, brake_dist_m: 140, accel_dist_m: 60, g_lat_apex: 1.15 },
    { corner_index: 3, apex_speed_kmh: 130, brake_dist_m: 60, accel_dist_m: 95, g_lat_apex: 0.95 },
    { corner_index: 4, apex_speed_kmh: 88, brake_dist_m: 95, accel_dist_m: 70, g_lat_apex: 1.1 },
    { corner_index: 5, apex_speed_kmh: 65, brake_dist_m: 150, accel_dist_m: 55, g_lat_apex: 1.2 },
    { corner_index: 6, apex_speed_kmh: 110, brake_dist_m: 70, accel_dist_m: 90, g_lat_apex: 1.0 },
    { corner_index: 7, apex_speed_kmh: 78, brake_dist_m: 120, accel_dist_m: 65, g_lat_apex: 1.12 },
  ],
  dispersion: {
    corner_1: 0.8,
    corner_2: 1.4,
    corner_3: 0.6,
    corner_4: 1.1,
    corner_5: 1.6,
    corner_6: 0.7,
    corner_7: 1.2,
  },
  chassis_balance: {
    corner_1: 4,
    corner_2: -8,
    corner_3: 2,
    corner_4: -12,
    corner_5: 6,
    corner_6: -3,
    corner_7: 9,
  },
  load_transfer: {
    corner_1: 0.42,
    corner_2: 0.55,
    corner_3: 0.38,
    corner_4: 0.48,
    corner_5: 0.6,
    corner_6: 0.4,
    corner_7: 0.52,
  },
  data_quality: {
    frames_used: 11800,
    frames_dropped: 240,
    pct_valid: 98,
    corners_detected: 7,
    laps_detected: 8,
  },
};
