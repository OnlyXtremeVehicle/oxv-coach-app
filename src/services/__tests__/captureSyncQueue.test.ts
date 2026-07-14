/* eslint-disable @typescript-eslint/no-explicit-any, import/first */
/**
 * File de synchronisation de capture — SURVIE HORS-LIGNE (P0 Valence).
 *
 * On mocke expo-file-system par un système de fichiers EN MÉMOIRE (Map globale,
 * survivant à jest.resetModules pour le test « redémarrage ») et @/lib/supabase
 * par un builder chaînable piloté par un objet de contrôle global (mode réseau,
 * comptes). Le parser UBX et le mapping restent RÉELS (logique pure).
 *
 * Couverture : ordre FIFO, persistance sur disque, idempotence create (upsert
 * onConflict 'id'), arrêt au premier échec réseau + reprise, drop d'une erreur
 * permanente, hasPending/pendingSessionIds, réimport .ubx, redémarrage.
 */

// --- FS en mémoire (partagé, survit à resetModules via globalThis) ---
function fsMap(): Map<string, string> {
  const g = globalThis as any;
  if (!g.__OXV_FS__) g.__OXV_FS__ = new Map<string, string>();
  return g.__OXV_FS__;
}

interface SbCtrl {
  remainingOk: number;
  frameCount: number;
  calls: { table: string; kind: string; opts: any }[];
  errorByTable: Record<string, { message: string; code?: string }>;
  uploadError: Error | null;
}
function sbCtrl(): SbCtrl {
  const g = globalThis as any;
  if (!g.__OXV_SB__) {
    g.__OXV_SB__ = {
      remainingOk: 1e9,
      frameCount: 0,
      calls: [],
      errorByTable: {},
      uploadError: null,
    } as SbCtrl;
  }
  return g.__OXV_SB__;
}

jest.mock('expo-file-system', () => {
  const g = globalThis as any;
  if (!g.__OXV_FS__) g.__OXV_FS__ = new Map<string, string>();
  const files: Map<string, string> = g.__OXV_FS__;
  return {
    documentDirectory: '/oxv/',
    cacheDirectory: '/oxvc/',
    bundleDirectory: '/oxvb/',
    EncodingType: { UTF8: 'utf8', Base64: 'base64' },
    getInfoAsync: jest.fn(async (p: string) => {
      if (files.has(p))
        return { exists: true, isDirectory: false, uri: p, size: files.get(p)!.length };
      const isDir = [...files.keys()].some((k) => k.startsWith(p));
      return { exists: isDir, isDirectory: isDir, uri: p };
    }),
    makeDirectoryAsync: jest.fn(async () => undefined),
    readDirectoryAsync: jest.fn(async (dir: string) => {
      const out: string[] = [];
      for (const k of files.keys()) {
        if (k.startsWith(dir)) {
          const rest = k.slice(dir.length);
          if (rest && !rest.includes('/')) out.push(rest);
        }
      }
      return out;
    }),
    writeAsStringAsync: jest.fn(async (p: string, content: string) => {
      files.set(p, content);
    }),
    readAsStringAsync: jest.fn(async (p: string) => {
      if (!files.has(p)) throw new Error(`Fichier introuvable : ${p}`);
      return files.get(p)!;
    }),
    deleteAsync: jest.fn(async (p: string) => {
      files.delete(p);
    }),
  };
});

jest.mock('@/lib/supabase', () => {
  const g = globalThis as any;
  const ctrl = (): SbCtrl => g.__OXV_SB__;
  class SupaBuilder {
    table: string;
    kind = 'select';
    opts: any = undefined;
    constructor(table: string) {
      this.table = table;
    }
    upsert(_row: unknown, opts?: unknown) {
      this.kind = 'upsert';
      this.opts = opts;
      return this;
    }
    insert(_rows: unknown) {
      this.kind = 'insert';
      return this;
    }
    update(_obj: unknown) {
      this.kind = 'update';
      return this;
    }
    select(_cols?: unknown, opts?: unknown) {
      this.kind = 'select';
      this.opts = opts;
      return this;
    }
    eq() {
      return this;
    }
    then(resolve: (v: any) => any, reject?: (e: any) => any) {
      const c = ctrl();
      c.calls.push({ table: this.table, kind: this.kind, opts: this.opts });
      const forced = c.errorByTable[this.table];
      let result: any;
      if (forced) {
        result = { error: forced, count: null, data: null };
      } else if (c.remainingOk > 0) {
        c.remainingOk -= 1;
        result = { error: null, count: this.kind === 'select' ? c.frameCount : null, data: null };
      } else {
        c.remainingOk -= 1;
        result = { error: { message: 'Network request failed' }, count: null, data: null };
      }
      return Promise.resolve(result).then(resolve, reject);
    }
  }
  return {
    supabase: {
      from: (table: string) => new SupaBuilder(table),
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    },
  };
});

jest.mock('@/services/telemetryStorage', () => ({
  uploadTelemetryFile: jest.fn(async () => {
    const g = globalThis as any;
    const err = g.__OXV_SB__?.uploadError as Error | null;
    if (err) throw err;
    return { storagePath: 'p', sizeBytes: 1, durationMs: 1 };
  }),
}));

import { RACEBOX_PROTOCOL } from '@/types/telemetry';

import {
  type CaptureQueueOp,
  enqueue,
  hasPending,
  newUuid,
  pendingSessionIds,
  processQueue,
  reimportUbxToFrames,
  resumeUnsyncedCaptures,
} from '../captureSyncQueue';

beforeEach(() => {
  fsMap().clear();
  const c = sbCtrl();
  c.remainingOk = 1e9;
  c.frameCount = 0;
  c.calls = [];
  c.errorByTable = {};
  c.uploadError = null;
});

// --- Fabriques d'opérations ---
function createOp(sessionId: string, userId = 'user-1'): CaptureQueueOp {
  return {
    type: 'create_session',
    sessionId,
    row: {
      id: sessionId,
      user_id: userId,
      status: 'recording',
      started_at: '2026-07-15T10:00:00.000Z',
      circuit_id: null,
      circuit_name: 'Circuit',
      vehicle_id: null,
    },
  };
}
function framesOp(sessionId: string, n = 3): CaptureQueueOp {
  const batch = Array.from({ length: n }, (_, i) => ({
    session_id: sessionId,
    elapsed_ms: i * 40,
    latitude: 45.6,
    longitude: -0.14,
    altitude_m: 30,
    speed_kmh: 100,
    speed_ms: 27.7,
    heading: 90,
    gps_fix: 3,
    fix_valid: true,
    gps_accuracy_m: 1,
    satellites: 12,
    g_force_x: 0.1,
    g_force_y: 0.2,
    g_force_z: 1,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
    battery_level: 80,
    itow_ms: i * 40,
  }));
  return { type: 'frames', sessionId, batch };
}
function lapsOp(sessionId: string): CaptureQueueOp {
  return {
    type: 'laps',
    sessionId,
    rows: [
      {
        session_id: sessionId,
        lap_number: 1,
        duration_seconds: 90,
        started_at: '2026-07-15T10:00:00.000Z',
        ended_at: '2026-07-15T10:01:30.000Z',
      },
    ],
  };
}
function completeOp(sessionId: string, userId = 'user-1'): CaptureQueueOp {
  return {
    type: 'complete',
    sessionId,
    userId,
    updates: { status: 'completed', ended_at: '2026-07-15T10:05:00.000Z', total_frames: 3 },
  };
}

describe('newUuid', () => {
  it('produit un UUID v4 bien formé et unique', () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = newUuid();
    const b = newUuid();
    expect(a).toMatch(re);
    expect(b).toMatch(re);
    expect(a).not.toBe(b);
  });
});

describe('enqueue / persistance / FIFO', () => {
  it('persiste chaque op dans un fichier .json et draine dans l’ordre d’insertion', async () => {
    await enqueue(createOp('s1'));
    await enqueue(framesOp('s1'));
    await enqueue(lapsOp('s1'));

    // Fichiers réellement écrits sur le « disque » (3 .json sous capture-queue/).
    const names = [...fsMap().keys()].filter((k) => k.startsWith('/oxv/capture-queue/'));
    expect(names.length).toBe(3);

    const res = await processQueue();
    expect(res.processed).toBe(3);
    expect(res.remaining).toBe(0);

    // Ordre FIFO : session (upsert) → frames (insert) → laps (insert).
    const seq = sbCtrl().calls.map((c) => `${c.table}:${c.kind}`);
    expect(seq).toEqual(['telemetry_sessions:upsert', 'telemetry_frames:insert', 'laps:insert']);
    // Tout est supprimé du disque après succès.
    expect(await hasPending()).toBe(false);
  });
});

describe('idempotence create_session', () => {
  it('pose la ligne par upsert onConflict "id" (rejouable sans doublon)', async () => {
    await enqueue(createOp('s1'));
    await processQueue();
    const call = sbCtrl().calls.find((c) => c.table === 'telemetry_sessions');
    expect(call?.kind).toBe('upsert');
    expect(call?.opts).toMatchObject({ onConflict: 'id', ignoreDuplicates: false });
  });
});

describe('arrêt au premier échec réseau + reprise', () => {
  it('s’arrête au 1er échec réseau, garde le reste, puis draine à la reprise (FIFO)', async () => {
    await enqueue(createOp('s1'));
    await enqueue(framesOp('s1'));
    await enqueue(lapsOp('s1'));

    // Un seul appel réussit (create), le suivant (frames) échoue réseau → stop.
    sbCtrl().remainingOk = 1;
    const first = await processQueue();
    expect(first.processed).toBe(1);
    expect(first.remaining).toBe(2);
    expect(await hasPending()).toBe(true);

    // Réseau revenu : le reste draine, dans l’ordre (frames puis laps).
    sbCtrl().remainingOk = 1e9;
    const second = await processQueue();
    expect(second.processed).toBe(2);
    expect(await hasPending()).toBe(false);

    const drainedAfter = sbCtrl()
      .calls.map((c) => `${c.table}:${c.kind}`)
      .slice(1); // après le create initial
    expect(drainedAfter).toEqual([
      'telemetry_frames:insert', // échec réseau
      'telemetry_frames:insert', // rejeu OK
      'laps:insert',
    ]);
  });

  it('ne supprime PAS du disque une op en échec réseau', async () => {
    await enqueue(createOp('s1'));
    sbCtrl().remainingOk = 0; // tout échoue
    const res = await processQueue();
    expect(res.processed).toBe(0);
    expect(res.dropped).toBe(0);
    expect(await hasPending()).toBe(true);
  });
});

describe('erreur permanente → drop + continue', () => {
  it('abandonne (log + suppression) une op en erreur logique et poursuit la file', async () => {
    await enqueue(createOp('s1'));
    await enqueue(lapsOp('s1')); // sera forcée en erreur permanente
    await enqueue(framesOp('s1'));

    sbCtrl().errorByTable = { laps: { message: 'null value in column', code: '23502' } };
    const res = await processQueue();

    expect(res.processed).toBe(2); // create + frames
    expect(res.dropped).toBe(1); // laps
    expect(res.remaining).toBe(0);
    expect(await hasPending()).toBe(false);
  });
});

describe('complete : réconciliation total_frames', () => {
  it('recompte les trames réelles en base pour un statut completed', async () => {
    sbCtrl().frameCount = 42;
    await enqueue(completeOp('s1'));
    const res = await processQueue();
    expect(res.processed).toBe(1);
    // Un select count (telemetry_frames) précède l’update (telemetry_sessions).
    const kinds = sbCtrl().calls.map((c) => `${c.table}:${c.kind}`);
    expect(kinds).toEqual(['telemetry_frames:select', 'telemetry_sessions:update']);
  });
});

describe('hasPending / pendingSessionIds', () => {
  it('remonte les séances distinctes encore en attente', async () => {
    await enqueue(createOp('s1'));
    await enqueue(framesOp('s1'));
    await enqueue(createOp('s2', 'user-2'));
    expect(await hasPending()).toBe(true);
    const ids = (await pendingSessionIds()).sort();
    expect(ids).toEqual(['s1', 's2']);
  });
});

describe('resumeUnsyncedCaptures', () => {
  it('draine si des ops sont en attente', async () => {
    await enqueue(createOp('s1'));
    await resumeUnsyncedCaptures();
    expect(await hasPending()).toBe(false);
    expect(sbCtrl().calls.length).toBe(1);
  });

  it('ne fait rien (aucun appel) si la file est vide', async () => {
    await resumeUnsyncedCaptures();
    expect(sbCtrl().calls.length).toBe(0);
  });
});

describe('ubx_upload', () => {
  it('rejoue l’upload et le supprime au succès', async () => {
    await enqueue({
      type: 'ubx_upload',
      sessionId: 's1',
      userId: 'user-1',
      fileUri: '/oxv/s1.ubx',
    });
    const res = await processQueue();
    expect(res.processed).toBe(1);
    expect(await hasPending()).toBe(false);
  });

  it('garde l’op si l’upload échoue réseau', async () => {
    sbCtrl().uploadError = new Error('Network request failed');
    await enqueue({
      type: 'ubx_upload',
      sessionId: 's1',
      userId: 'user-1',
      fileUri: '/oxv/s1.ubx',
    });
    const res = await processQueue();
    expect(res.processed).toBe(0);
    expect(await hasPending()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Redémarrage : la file survit à un « restart » (resetModules), le disque persiste
// ---------------------------------------------------------------------------
describe('survie au redémarrage', () => {
  it('draine au boot des ops enqueuées avant un redémarrage', async () => {
    // Enqueue via l'instance courante, réseau coupé → reste sur disque.
    await enqueue(createOp('s1'));
    sbCtrl().remainingOk = 0;
    await processQueue();
    expect(await hasPending()).toBe(true);
    const before = [...fsMap().keys()].filter((k) => k.startsWith('/oxv/capture-queue/')).length;
    expect(before).toBe(1);

    // « Redémarrage » : nouveau module (seq remis à 0), MÊME disque (Map globale).
    jest.resetModules();
    const fresh = require('../captureSyncQueue') as typeof import('../captureSyncQueue');
    expect(await fresh.hasPending()).toBe(true);
    sbCtrl().remainingOk = 1e9;
    await fresh.resumeUnsyncedCaptures();
    expect(await fresh.hasPending()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Réimport .ubx → telemetry_frames (filet de dernier recours)
// ---------------------------------------------------------------------------
function buildUbxFrame(itow: number, speedKmh: number): Uint8Array {
  const payload = RACEBOX_PROTOCOL.RACEBOX_DATA_PAYLOAD_SIZE;
  const total = RACEBOX_PROTOCOL.RACEBOX_DATA_TOTAL_SIZE;
  const f = new Uint8Array(total);
  f[0] = RACEBOX_PROTOCOL.UBX_SYNC_1;
  f[1] = RACEBOX_PROTOCOL.UBX_SYNC_2;
  f[2] = RACEBOX_PROTOCOL.RACEBOX_CLASS;
  f[3] = RACEBOX_PROTOCOL.RACEBOX_DATA_ID;
  f[4] = payload & 0xff;
  f[5] = (payload >> 8) & 0xff;
  const dv = new DataView(f.buffer, 6, payload);
  dv.setUint32(0, itow >>> 0, true); // iTOW
  dv.setUint16(4, 2026, true);
  dv.setUint8(6, 7);
  dv.setUint8(7, 15);
  dv.setUint8(20, 3); // fix 3D
  dv.setUint8(21, 0x20); // heading valid
  dv.setUint8(23, 12); // sats
  dv.setInt32(24, Math.round(-0.14 * 1e7), true); // lon
  dv.setInt32(28, Math.round(45.6 * 1e7), true); // lat
  dv.setInt32(36, 30_000, true); // alt mm
  dv.setUint32(40, 1000, true); // acc mm
  dv.setUint32(48, Math.round((speedKmh / 3.6) * 1000), true); // speed mm/s
  dv.setUint32(52, 90 * 1e5, true); // heading
  dv.setInt16(68, 100, true); // gx
  dv.setInt16(70, 200, true); // gy
  dv.setInt16(72, 1000, true); // gz
  dv.setUint8(67, 80); // battery
  let ckA = 0;
  let ckB = 0;
  for (let i = 2; i < 6 + payload; i++) {
    ckA = (ckA + f[i]) & 0xff;
    ckB = (ckB + ckA) & 0xff;
  }
  f[86] = ckA;
  f[87] = ckB;
  return f;
}

describe('reimportUbxToFrames', () => {
  it('parse un .ubx local et réinsère les trames', async () => {
    const frames = [buildUbxFrame(1000, 100), buildUbxFrame(1040, 120), buildUbxFrame(1080, 140)];
    const totalLen = frames.reduce((s, f) => s + f.length, 0);
    const bytes = new Uint8Array(totalLen);
    let off = 0;
    for (const f of frames) {
      bytes.set(f, off);
      off += f.length;
    }
    const uri = '/oxv/sess.ubx';
    fsMap().set(uri, Buffer.from(bytes).toString('base64'));

    const { inserted } = await reimportUbxToFrames('sess', 'user-1', uri);
    expect(inserted).toBe(3);
    const insertCall = sbCtrl().calls.find(
      (c) => c.table === 'telemetry_frames' && c.kind === 'insert'
    );
    expect(insertCall).toBeDefined();
  });

  it('lève si le fichier .ubx est absent', async () => {
    await expect(reimportUbxToFrames('sess', 'user-1', '/oxv/nope.ubx')).rejects.toThrow(
      /introuvable/i
    );
  });
});
