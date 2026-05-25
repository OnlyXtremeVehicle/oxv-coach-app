/* eslint-disable import/first */
/**
 * Tests du service d'orchestration analyzeSessionService (sem 13 J1).
 *
 * On teste les helpers purs (conversion RaceBoxData → TrackVizRecordingSample
 * et downsample uniforme). L'orchestration `analyzeAndPersistSession` n'est
 * pas testée ici — elle dépend de Supabase, expo-file-system et de la chaîne
 * complète, validée à la main sur device en sem 13 J4.
 *
 * Les modules `expo-file-system` et `@/lib/supabase` sont mockés au top
 * pour que le module sous test puisse être chargé en environnement Node.
 */

// Mocks chargés AVANT l'import du module sous test
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
  documentDirectory: '/tmp/',
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import { __testing, raceBoxToTrackVizSample } from '../analyzeSessionService';
import { GpsFix, type RaceBoxData } from '@/types/telemetry';

function buildRaceBoxData(overrides: Partial<RaceBoxData> = {}): RaceBoxData {
  return {
    timestamp: {
      year: 2026,
      month: 5,
      day: 25,
      hour: 14,
      minute: 30,
      second: 12,
      nanoseconds: 0,
      iTOW: 521_000,
    },
    gps: {
      fix: GpsFix.Fix3D,
      satellites: 18,
      latitude: 45.6005,
      longitude: -0.142,
      altitude: 35.5,
      accuracy: 1.2,
    },
    motion: {
      speed: 142.4,
      heading: 88.2,
      headingValid: true,
    },
    imu: {
      gForceX: 0.05,
      gForceY: 0.78,
      gForceZ: 1.01,
      rotRateX: 0,
      rotRateY: 0,
      rotRateZ: 0,
    },
    battery: {
      isCharging: false,
      level: 92,
    },
    ...overrides,
  };
}

describe('raceBoxToTrackVizSample', () => {
  it('mappe correctement un RaceBoxData nominal vers un TrackVizRecordingSample', () => {
    const data = buildRaceBoxData();
    const sample = raceBoxToTrackVizSample(data, 1500);

    expect(sample.elapsed_ms).toBe(1500);
    expect(sample.latitude).toBeCloseTo(45.6005, 4);
    expect(sample.longitude).toBeCloseTo(-0.142, 4);
    expect(sample.altitude_m).toBeCloseTo(35.5, 1);
    expect(sample.speed_kmh).toBeCloseTo(142.4, 1);
    expect(sample.heading_deg).toBeCloseTo(88.2, 1);
    expect(sample.g_force_x).toBeCloseTo(0.05, 2);
    expect(sample.g_force_y).toBeCloseTo(0.78, 2);
    expect(sample.g_force_z).toBeCloseTo(1.01, 2);
    expect(sample.gps_accuracy_m).toBeCloseTo(1.2, 1);
    expect(sample.gps_fix).toBe(GpsFix.Fix3D);
    expect(sample.satellites).toBe(18);
    expect(sample.battery_level).toBe(92);
    expect(sample.source).toBe('ble');
  });

  it('masque heading_deg quand le flag headingValid est faux', () => {
    const data = buildRaceBoxData({
      motion: { speed: 0, heading: 0, headingValid: false },
    });
    const sample = raceBoxToTrackVizSample(data, 0);
    expect(sample.heading_deg).toBeNull();
  });

  it('clampe elapsed_ms à zéro pour éviter les valeurs négatives résiduelles', () => {
    const data = buildRaceBoxData();
    const sample = raceBoxToTrackVizSample(data, -42);
    expect(sample.elapsed_ms).toBe(0);
  });
});

describe('downsample (via __testing)', () => {
  const { downsample } = __testing;

  it("rend le tableau intact s'il est plus petit que la cible", () => {
    const input = [1, 2, 3];
    expect(downsample(input, 10)).toBe(input);
  });

  it('rend exactement target éléments quand input > target', () => {
    const input = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(input, 100);
    expect(out.length).toBe(100);
  });

  it('préserve toujours le premier et le dernier élément', () => {
    const input = Array.from({ length: 999 }, (_, i) => i);
    const out = downsample(input, 50);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(998);
  });

  it('reste monotone croissant sur une entrée monotone', () => {
    const input = Array.from({ length: 5000 }, (_, i) => i);
    const out = downsample(input, 250);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThan(out[i - 1]);
    }
  });
});
