/**
 * Types télémétrie OXV — v0.3
 *
 * Ajouts v0.3 :
 * - Circuit (calibration ligne d'arrivée)
 * - Lap (détail tour par tour)
 */

// ============================================================
// PROTOCOLE RACEBOX
// ============================================================

export const RACEBOX_PROTOCOL = {
  UART_SERVICE_UUID: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  RX_CHARACTERISTIC_UUID: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E',
  TX_CHARACTERISTIC_UUID: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E',
  UBX_SYNC_1: 0xb5,
  UBX_SYNC_2: 0x62,
  RACEBOX_CLASS: 0xff,
  RACEBOX_DATA_ID: 0x01,
  RACEBOX_DATA_PAYLOAD_SIZE: 80,
  RACEBOX_DATA_TOTAL_SIZE: 88,
  DEVICE_NAME_PREFIX: 'RaceBox',
} as const;

export enum GpsFix {
  NoFix = 0,
  Fix2D = 2,
  Fix3D = 3,
}

export interface RaceBoxData {
  timestamp: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    nanoseconds: number;
    iTOW: number;
  };
  gps: {
    fix: GpsFix;
    satellites: number;
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
  };
  motion: {
    speed: number;
    heading: number;
    headingValid: boolean;
  };
  imu: {
    gForceX: number;
    gForceY: number;
    gForceZ: number;
    rotRateX: number;
    rotRateY: number;
    rotRateZ: number;
  };
  battery: {
    isCharging: boolean;
    level: number;
  };
}

export type BleStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RaceBoxDevice {
  id: string;
  name: string;
  rssi: number | null;
}

// ============================================================
// SESSION + TOURS
// ============================================================

export type SessionStatus = 'idle' | 'recording' | 'paused' | 'completed' | 'aborted';

export interface TelemetrySession {
  id: string;
  user_id: string;
  name: string | null;
  circuit_id: string | null;
  circuit_name: string;
  vehicle_id: string | null;
  weather: string | null;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_frames: number;
  max_speed_kmh: number | null;
  max_g_lateral: number | null;
  max_g_longitudinal: number | null;
  distance_km: number | null;
  lap_count: number;
  best_lap_seconds: number | null;
  best_lap_number: number | null;
  avg_lap_seconds: number | null;
  status: 'recording' | 'completed' | 'aborted' | 'processing';
  raw_data_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Circuit avec ligne d'arrivée calibrée par l'utilisateur
 */
export interface Circuit {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;

  finish_line_lat: number;
  finish_line_lon: number;
  finish_line_radius_m: number;
  finish_line_heading: number | null;

  total_sessions: number;
  best_lap_seconds: number | null;

  created_at: string;
  updated_at: string;
}

/**
 * Tour individuel
 */
export interface Lap {
  id: string;
  session_id: string;

  lap_number: number;
  is_best_lap: boolean;
  is_outlap: boolean;
  is_inlap: boolean;

  started_at: string;
  ended_at: string;
  duration_seconds: number;

  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  max_g_lateral: number | null;
  max_g_braking: number | null;
  max_g_accel: number | null;
  distance_meters: number | null;

  start_lat: number | null;
  start_lon: number | null;
  end_lat: number | null;
  end_lon: number | null;

  created_at: string;
}

/**
 * Tour en cours (live, pas encore sauvegardé)
 */
export interface LiveLap {
  number: number;
  startedAt: number; // timestamp ms
  startLat: number;
  startLon: number;

  // Stats live
  maxSpeed: number;
  speedSum: number;
  speedSamples: number;
  maxGLat: number;
  maxGBraking: number;
  maxGAccel: number;
  distance: number;

  // Pour calcul Haversine intra-tour
  lastLat: number;
  lastLon: number;
}
