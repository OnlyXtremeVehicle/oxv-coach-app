/* eslint-disable import/first */
/**
 * Test d'intégration : génère une fixture .ubx en mémoire à partir des
 * demo samples trackviz, puis vérifie que `parseUbxFile` la relit fidèlement.
 *
 * On contourne expo-file-system (qui n'existe pas en Node) en mockant
 * `getInfoAsync` + `readAsStringAsync` pour servir le contenu base64
 * d'un buffer Uint8Array généré en mémoire.
 *
 * Sem 13 J4 — preuve que le pipeline UBX→trackviz fonctionne de bout en
 * bout sans device, avec checksum Fletcher-8 et reconstruction par chunks.
 */

const fixtureCache: { bytes: Uint8Array | null } = { bytes: null };

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: fixtureCache.bytes?.length ?? 0 })),
  readAsStringAsync: jest.fn(async () => {
    if (!fixtureCache.bytes) throw new Error('Fixture non initialisée');
    return Buffer.from(fixtureCache.bytes).toString('base64');
  }),
  EncodingType: { Base64: 'base64' },
  documentDirectory: '/tmp/',
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

import { parseUbxFile } from '../analyzeSessionService';
import { buildDemoTrackVizSamples } from '@/trackviz/analysis';
import { RACEBOX_PROTOCOL } from '@/types/telemetry';

/** Construit une trame UBX RaceBox Data valide depuis un sample trackviz. */
function buildFrame(sample: ReturnType<typeof buildDemoTrackVizSamples>[number]): Uint8Array {
  const payloadSize = RACEBOX_PROTOCOL.RACEBOX_DATA_PAYLOAD_SIZE;
  const totalSize = RACEBOX_PROTOCOL.RACEBOX_DATA_TOTAL_SIZE;
  const frame = new Uint8Array(totalSize);

  frame[0] = RACEBOX_PROTOCOL.UBX_SYNC_1;
  frame[1] = RACEBOX_PROTOCOL.UBX_SYNC_2;
  frame[2] = RACEBOX_PROTOCOL.RACEBOX_CLASS;
  frame[3] = RACEBOX_PROTOCOL.RACEBOX_DATA_ID;
  frame[4] = payloadSize & 0xff;
  frame[5] = (payloadSize >> 8) & 0xff;

  const dv = new DataView(frame.buffer, 6, payloadSize);

  // iTOW (offset 0)
  dv.setUint32(0, sample.elapsed_ms >>> 0, true);
  dv.setUint16(4, 2026, true);
  dv.setUint8(6, 5);
  dv.setUint8(7, 25);

  // GPS — voir parser.ts pour les offsets exacts
  dv.setUint8(20, sample.gps_fix);
  dv.setUint8(21, sample.heading_deg !== null ? 0x20 : 0);
  dv.setUint8(23, sample.satellites ?? 0);
  dv.setInt32(24, Math.round(sample.longitude * 1e7), true);
  dv.setInt32(28, Math.round(sample.latitude * 1e7), true);
  dv.setInt32(36, Math.round((sample.altitude_m ?? 0) * 1000), true);
  dv.setUint32(40, Math.round((sample.gps_accuracy_m ?? 1) * 1000), true);
  dv.setUint32(48, Math.round((sample.speed_kmh / 3.6) * 1000), true);
  dv.setUint32(52, Math.round((sample.heading_deg ?? 0) * 1e5), true);

  // IMU
  dv.setInt16(68, Math.round(sample.g_force_x * 1000), true);
  dv.setInt16(70, Math.round(sample.g_force_y * 1000), true);
  dv.setInt16(72, Math.round(sample.g_force_z * 1000), true);

  // Battery
  dv.setUint8(67, (sample.battery_level ?? 80) & 0x7f);

  // Checksum Fletcher-8
  let ckA = 0;
  let ckB = 0;
  for (let i = 2; i < 6 + payloadSize; i++) {
    ckA = (ckA + frame[i]) & 0xff;
    ckB = (ckB + ckA) & 0xff;
  }
  frame[86] = ckA;
  frame[87] = ckB;

  return frame;
}

function buildFixtureBytes(): Uint8Array {
  const samples = buildDemoTrackVizSamples();
  const frames = samples.map(buildFrame);
  const total = frames.reduce((sum, f) => sum + f.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const f of frames) {
    out.set(f, offset);
    offset += f.length;
  }
  return out;
}

describe('parseUbxFile (intégration sur fixture synthétique)', () => {
  beforeAll(() => {
    fixtureCache.bytes = buildFixtureBytes();
  });

  it('reconstruit le bon nombre de samples depuis la fixture', async () => {
    const samples = await parseUbxFile('/tmp/demo.ubx');
    const expected = buildDemoTrackVizSamples();
    expect(samples.length).toBe(expected.length);
  });

  it('préserve la séquence temporelle (elapsed_ms croissant à partir de 0)', async () => {
    const samples = await parseUbxFile('/tmp/demo.ubx');
    expect(samples[0].elapsed_ms).toBe(0);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].elapsed_ms).toBeGreaterThanOrEqual(samples[i - 1].elapsed_ms);
    }
  });

  it('préserve les coordonnées GPS à la précision parser (1e-7)', async () => {
    const samples = await parseUbxFile('/tmp/demo.ubx');
    const expected = buildDemoTrackVizSamples();
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i].latitude).toBeCloseTo(expected[i].latitude, 6);
      expect(samples[i].longitude).toBeCloseTo(expected[i].longitude, 6);
    }
  });

  it('préserve la vitesse à la précision raisonnable (±0.5 km/h)', async () => {
    const samples = await parseUbxFile('/tmp/demo.ubx');
    const expected = buildDemoTrackVizSamples();
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i].speed_kmh).toBeCloseTo(expected[i].speed_kmh, 0);
    }
  });

  it("marque source 'ble' (et pas 'demo') puisque les samples viennent du parser", async () => {
    const samples = await parseUbxFile('/tmp/demo.ubx');
    expect(samples.every((s) => s.source === 'ble')).toBe(true);
  });
});
