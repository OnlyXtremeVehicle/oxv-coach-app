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
  /** `true` → l'UPDATE ne touche AUCUNE ligne (RLS, jeton, ligne absente). */
  updateTouchesNoRow: boolean;
  calls: { table: string; kind: string; opts: any; rows: any[] | null }[];
  errorByTable: Record<string, { message: string; code?: string }>;
  /** Force une erreur UNIQUEMENT sur les upserts d'une table (garde 42P10). */
  upsertErrorByTable: Record<string, { message: string; code?: string }>;
  /** Force une erreur UNIQUEMENT sur les inserts d'une table (repli → 23505). */
  insertErrorByTable: Record<string, { message: string; code?: string }>;
  /** Lignes renvoyées par un `.select()` (réimport : clés déjà en base). */
  selectRowsByTable: Record<string, any[]>;
  /** Erreur levée par l'upload Storage (souvent SANS `.code` : status seul). */
  uploadError: unknown;
  /**
   * Promesse BLOQUANTE par table : l'appel est enregistré tout de suite, mais ne
   * se résout qu'une fois la promesse tenue. Sert à ouvrir une vraie fenêtre de
   * concurrence (un drain « en vol ») sans dépendre du hasard d'ordonnancement.
   */
  gateByTable: Record<string, Promise<void>>;
}
function sbCtrl(): SbCtrl {
  const g = globalThis as any;
  if (!g.__OXV_SB__) {
    g.__OXV_SB__ = {
      remainingOk: 1e9,
      frameCount: 0,
      updateTouchesNoRow: false,
      calls: [],
      errorByTable: {},
      upsertErrorByTable: {},
      insertErrorByTable: {},
      selectRowsByTable: {},
      uploadError: null,
      gateByTable: {},
    } as SbCtrl;
  }
  return g.__OXV_SB__;
}

jest.mock('expo-file-system/legacy', () => {
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
    // Renommage : écrase la destination (comme Android `renameTo` et iOS
    // `removeFile`+`moveItem`), lève si la source n'existe pas.
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      if (!files.has(from)) throw new Error(`Fichier introuvable : ${from}`);
      files.set(to, files.get(from)!);
      files.delete(from);
    }),
  };
});

// Sentry (SEC-1) : helper mocké — le vrai module tire @sentry/react-native
// (natif, hors périmètre ts-jest node) et suppose __DEV__ défini.
jest.mock('@/lib/sentry', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/supabase', () => {
  const g = globalThis as any;
  const ctrl = (): SbCtrl => g.__OXV_SB__;
  class SupaBuilder {
    table: string;
    kind = 'select';
    opts: any = undefined;
    rows: any[] | null = null;
    constructor(table: string) {
      this.table = table;
    }
    upsert(rows: unknown, opts?: unknown) {
      this.kind = 'upsert';
      this.opts = opts;
      this.rows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    insert(rows: unknown) {
      this.kind = 'insert';
      this.rows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(_obj: unknown) {
      this.kind = 'update';
      return this;
    }
    /**
     * Un `.select()` qui SUIT un `.update()` est une clause RETURNING, pas une
     * lecture : il ne doit pas changer la nature de l'appel enregistré. Sans
     * cette distinction, `execComplete` (qui lit désormais les lignes touchées
     * pour ne plus confondre « clôturée » et « je n'ai touché personne »)
     * apparaissait comme un `select`.
     */
    returning = false;
    select(_cols?: unknown, opts?: unknown) {
      if (this.kind === 'update') {
        this.returning = true;
        return this;
      }
      this.kind = 'select';
      this.opts = opts;
      return this;
    }
    eq() {
      return this;
    }
    order() {
      return this;
    }
    /** Pagination : la 2e page est vide (le réimport s'arrête sur page < taille). */
    range(from: number) {
      this.offset = from;
      return this;
    }
    offset = 0;
    then(resolve: (v: any) => any, reject?: (e: any) => any) {
      const c = ctrl();
      c.calls.push({ table: this.table, kind: this.kind, opts: this.opts, rows: this.rows });
      const compute = (): any => {
        const forcedUpsert = this.kind === 'upsert' ? c.upsertErrorByTable[this.table] : undefined;
        const forcedInsert = this.kind === 'insert' ? c.insertErrorByTable[this.table] : undefined;
        const forced = c.errorByTable[this.table];
        if (forcedUpsert) return { error: forcedUpsert, count: null, data: null };
        if (forcedInsert) return { error: forcedInsert, count: null, data: null };
        if (forced) return { error: forced, count: null, data: null };
        if (c.remainingOk > 0) {
          c.remainingOk -= 1;
          const rows =
            this.kind === 'select'
              ? (c.selectRowsByTable[this.table] ?? null)
              : this.returning
                ? c.updateTouchesNoRow
                  ? []
                  : [{ id: 'ligne-touchee' }]
                : null;
          return {
            error: null,
            count: this.kind === 'select' ? c.frameCount : null,
            // Une page au-delà de la 1re est vide : la boucle de pagination sort.
            data: this.offset > 0 ? [] : rows,
          };
        }
        c.remainingOk -= 1;
        return { error: { message: 'Network request failed' }, count: null, data: null };
      };
      const gate = c.gateByTable[this.table];
      // Chemin nominal INCHANGÉ (résolution synchrone) ; chemin gaté : l'appel est
      // déjà compté, le résultat n'arrive qu'à la levée de la barrière.
      const p = gate ? gate.then(compute) : Promise.resolve(compute());
      return p.then(resolve, reject);
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
    const err: unknown = g.__OXV_SB__?.uploadError;
    if (err) throw err;
    return { storagePath: 'p', sizeBytes: 1, durationMs: 1 };
  }),
}));

import * as FileSystem from 'expo-file-system/legacy';

import { RACEBOX_PROTOCOL } from '@/types/telemetry';

import {
  type CaptureQueueOp,
  enqueue,
  gcOldCaptures,
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
  // Sans cette remise à zéro, la bascule fuit d'un test à l'autre : un test qui
  // simule « l'UPDATE ne touche aucune ligne » faisait échouer tous les
  // suivants, et le diagnostic partait dans la mauvaise direction.
  c.updateTouchesNoRow = false;
  c.calls = [];
  c.errorByTable = {};
  c.upsertErrorByTable = {};
  c.insertErrorByTable = {};
  c.selectRowsByTable = {};
  c.uploadError = null;
  c.gateByTable = {};
});

/** Barrière manuelle : `promise` ne se tient que sur appel de `open()`. */
function barrier(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((r) => {
    open = r;
  });
  return { promise, open };
}

/** Attend qu'une condition devienne vraie (macrotâches réelles), ou lève. */
async function waitFor(pred: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 500; i += 1) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error(`condition jamais atteinte : ${label}`);
}

/** Fichiers présents sous `capture-queue/quarantine/`. */
function quarantined(): string[] {
  return [...fsMap().keys()].filter((k) => k.startsWith('/oxv/capture-queue/quarantine/'));
}

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

    // Ordre FIFO : session → frames → laps, toutes en upsert idempotent (§4.6).
    const seq = sbCtrl().calls.map((c) => `${c.table}:${c.kind}`);
    expect(seq).toEqual(['telemetry_sessions:upsert', 'telemetry_frames:upsert', 'laps:upsert']);
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
      'telemetry_frames:upsert', // échec réseau (upsert idempotent §4.6)
      'telemetry_frames:upsert', // rejeu OK
      'laps:upsert',
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

describe('erreur permanente → quarantaine + continue', () => {
  it('abandonne (log + quarantaine) une op en erreur logique et poursuit la file', async () => {
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

  it('23502 sur laps : droppée MAIS déplacée en quarantaine, jamais détruite', async () => {
    await enqueue(lapsOp('s1'));
    sbCtrl().errorByTable = { laps: { message: 'null value in column', code: '23502' } };

    const res = await processQueue();
    expect(res.dropped).toBe(1);
    expect(await hasPending()).toBe(false);

    // La donnée du pilote survit dans `quarantine/` : inspectable et rejouable.
    const q = quarantined();
    expect(q.length).toBe(1);
    expect(q[0]).toMatch(/-laps\.json$/);
    const env = JSON.parse(fsMap().get(q[0])!);
    expect(env.op.type).toBe('laps');
    expect(env.op.sessionId).toBe('s1');
  });
});

// ---------------------------------------------------------------------------
// Classification des erreurs (Valencia §1) : liste BLANCHE d'abandon,
// défaut = TRANSITOIRE. Une erreur plateforme ne doit JAMAIS détruire de donnée.
// ---------------------------------------------------------------------------
describe('classification : erreurs plateforme conservées', () => {
  it.each([
    ['PGRST002', 'Could not query the database for its schema cache'], // migration en cours
    ['PGRST000', 'Could not connect with the database'],
    ['53300', 'sorry, too many clients already'], // fin de roulage, tous synchronisent
    ['57P03', 'the database system is shutting down'],
    ['08006', 'connection failure'],
    ['40001', 'could not serialize access due to concurrent update'],
    ['XX999', 'code totalement inconnu'], // défaut = transitoire
  ])('code %s → conservée (dropped=0, reste en attente)', async (code, message) => {
    await enqueue(lapsOp('s1'));
    sbCtrl().errorByTable = { laps: { message, code } };

    const res = await processQueue();
    expect(res.dropped).toBe(0);
    expect(res.processed).toBe(0);
    expect(await hasPending()).toBe(true);
    expect(quarantined()).toEqual([]);
  });

  it('23503 sur frames = ordonnancement (create_session pas encore passé) → conservée et stop FIFO', async () => {
    await enqueue(framesOp('s1'));
    await enqueue(lapsOp('s1'));
    sbCtrl().errorByTable = {
      telemetry_frames: {
        message: 'insert or update on table "telemetry_frames" violates foreign key constraint',
        code: '23503',
      },
    };

    const res = await processQueue();
    expect(res.dropped).toBe(0);
    expect(res.processed).toBe(0);
    // FIFO préservé : le lot `laps` derrière n'a pas été tenté.
    expect(res.remaining).toBe(2);
    expect(sbCtrl().calls.filter((c) => c.table === 'laps')).toEqual([]);
    expect(await hasPending()).toBe(true);
  });

  it('GARDE DURE : create_session avec 42501 (RLS) est conservée malgré le code logique', async () => {
    await enqueue(createOp('s1'));
    sbCtrl().errorByTable = {
      telemetry_sessions: {
        message: 'new row violates row-level security policy',
        code: '42501',
      },
    };

    const res = await processQueue();
    // L'abandonner ferait tomber trames et tours par cascade FK : jamais.
    expect(res.dropped).toBe(0);
    expect(await hasPending()).toBe(true);
    expect(quarantined()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Idempotence des trames (Valencia §4.6) : upsert onConflict + garde anti-casse
// ---------------------------------------------------------------------------
describe('idempotence frames (Valencia §4.6)', () => {
  // Module frais par test : la bascule STICKY `framesUpsertUnsupported` est ainsi
  // isolée (même disque + même contrôle Supabase via globalThis). Même pattern
  // que le test « survie au redémarrage ».
  function freshQueue(): typeof import('../captureSyncQueue') {
    jest.resetModules();
    return require('../captureSyncQueue') as typeof import('../captureSyncQueue');
  }

  it('insère les trames par UPSERT onConflict (session_id,elapsed_ms) en nominal', async () => {
    const q = freshQueue();
    await q.enqueue(framesOp('s1'));
    const res = await q.processQueue();

    expect(res.processed).toBe(1);
    const call = sbCtrl().calls.find((c) => c.table === 'telemetry_frames');
    expect(call?.kind).toBe('upsert');
    expect(call?.opts).toMatchObject({
      onConflict: 'session_id,elapsed_ms',
      ignoreDuplicates: true,
    });
    expect(await q.hasPending()).toBe(false);
  });

  it('retombe sur insert simple quand la contrainte manque (42P10), le lot passe', async () => {
    const q = freshQueue();
    sbCtrl().upsertErrorByTable = {
      telemetry_frames: {
        message:
          'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        code: '42P10',
      },
    };
    await q.enqueue(framesOp('s1'));
    const res = await q.processQueue();

    // Le lot est bien inséré (via le repli) : rien ne reste en attente.
    expect(res.processed).toBe(1);
    const kinds = sbCtrl()
      .calls.filter((c) => c.table === 'telemetry_frames')
      .map((c) => c.kind);
    expect(kinds).toEqual(['upsert', 'insert']);
    expect(await q.hasPending()).toBe(false);
  });

  it('ne bascule/loggue qu’une fois sur plusieurs lots (upsert non retenté)', async () => {
    const q = freshQueue();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    sbCtrl().upsertErrorByTable = {
      telemetry_frames: { message: 'no unique or exclusion constraint', code: '42P10' },
    };
    await q.enqueue(framesOp('s1'));
    await q.enqueue(framesOp('s1'));
    const res = await q.processQueue();

    expect(res.processed).toBe(2);
    const kinds = sbCtrl()
      .calls.filter((c) => c.table === 'telemetry_frames')
      .map((c) => c.kind);
    // 1er lot : upsert (42P10) → insert ; 2e lot : insert direct (bascule sticky).
    expect(kinds).toEqual(['upsert', 'insert', 'insert']);
    const fallbackLogs = warn.mock.calls.filter((c) => String(c[0]).includes('contrainte UNIQUE'));
    expect(fallbackLogs.length).toBe(1);
    warn.mockRestore();
  });

  it('la contrainte apparaît après la bascule : ré-évaluation en upsert, lot absorbé (jamais droppé)', async () => {
    const q = freshQueue();

    // 1) Migration absente : 42P10 → repli insert. La bascule s'enclenche.
    sbCtrl().upsertErrorByTable = {
      telemetry_frames: { message: 'no unique or exclusion constraint', code: '42P10' },
    };
    await q.enqueue(framesOp('s1'));
    expect((await q.processQueue()).processed).toBe(1);

    // 2) Gabin applique la migration en cours de journée, sans redémarrer l'app.
    //    L'insert nu du repli lève désormais 23505 sur un ex æquo intra-lot.
    sbCtrl().upsertErrorByTable = {};
    sbCtrl().insertErrorByTable = {
      telemetry_frames: {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      },
    };
    await q.enqueue(framesOp('s1'));
    const res = await q.processQueue();

    // Le 23505 PROUVE que la contrainte existe : on ré-arme et on rejoue en
    // upsert (DO NOTHING absorbe la collision) au lieu de jeter 50 trames.
    expect(res.processed).toBe(1);
    expect(res.dropped).toBe(0);
    const kinds = sbCtrl()
      .calls.filter((c) => c.table === 'telemetry_frames')
      .map((c) => c.kind);
    expect(kinds).toEqual(['upsert', 'insert', 'insert', 'upsert']);
    expect(await q.hasPending()).toBe(false);
    expect(quarantined()).toEqual([]);
  });

  it('un 23505 sur les trames ne droppe JAMAIS le lot', async () => {
    const q = freshQueue();
    sbCtrl().errorByTable = {
      telemetry_frames: {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      },
    };
    await q.enqueue(framesOp('s1'));
    const res = await q.processQueue();

    expect(res.dropped).toBe(0);
    expect(await q.hasPending()).toBe(true);
    expect(quarantined()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Idempotence des TOURS. La file est at-least-once par construction : un rejeu
// (réponse perdue après COMMIT, deleteOp raté, app tuée entre exécution et
// suppression) doit être inoffensif. Les lignes `laps` ne portent aucun `id`
// client → un insert nu rejoué créait des tours NEUFS, jamais une collision.
// ---------------------------------------------------------------------------
describe('idempotence laps (Valencia §4.6)', () => {
  function freshQueue(): typeof import('../captureSyncQueue') {
    jest.resetModules();
    return require('../captureSyncQueue') as typeof import('../captureSyncQueue');
  }

  it('écrit les tours par UPSERT onConflict (session_id,lap_number) en nominal', async () => {
    const q = freshQueue();
    await q.enqueue(lapsOp('s1'));
    const res = await q.processQueue();

    expect(res.processed).toBe(1);
    const call = sbCtrl().calls.find((c) => c.table === 'laps');
    expect(call?.kind).toBe('upsert');
    expect(call?.opts).toMatchObject({
      onConflict: 'session_id,lap_number',
      ignoreDuplicates: true,
    });
  });

  it('REJEU après réponse perdue : l’op repart en upsert, les tours ne doublent pas', async () => {
    const q = freshQueue();
    await q.enqueue(lapsOp('s1'));

    // 1er drain : PostgREST a COMMIT les tours, mais la réponse se perd
    // (timeout Wi-Fi au paddock) → erreur réseau → l'op est CONSERVÉE.
    sbCtrl().remainingOk = 0;
    const first = await q.processQueue();
    expect(first.processed).toBe(0);
    expect(first.dropped).toBe(0);
    expect(await q.hasPending()).toBe(true);

    // 2e drain (retour réseau / boot) : l'op est rejouée. C'est un UPSERT
    // ignoreDuplicates → ON CONFLICT DO NOTHING : les tours déjà en base sont
    // ignorés au lieu d'être réinsérés avec de nouveaux gen_random_uuid().
    sbCtrl().remainingOk = 1e9;
    const second = await q.processQueue();
    expect(second.processed).toBe(1);
    expect(await q.hasPending()).toBe(false);

    const lapCalls = sbCtrl().calls.filter((c) => c.table === 'laps');
    expect(lapCalls.map((c) => c.kind)).toEqual(['upsert', 'upsert']);
    expect(lapCalls[1].opts).toMatchObject({
      onConflict: 'session_id,lap_number',
      ignoreDuplicates: true,
    });
  });

  it('repli 42P10 : contrainte pas encore en prod → insert simple, le lot passe', async () => {
    const q = freshQueue();
    sbCtrl().upsertErrorByTable = {
      laps: {
        message:
          'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        code: '42P10',
      },
    };
    await q.enqueue(lapsOp('s1'));
    const res = await q.processQueue();

    // Les tours sont écrits malgré tout : la migration peut être appliquée après.
    expect(res.processed).toBe(1);
    expect(res.dropped).toBe(0);
    const kinds = sbCtrl()
      .calls.filter((c) => c.table === 'laps')
      .map((c) => c.kind);
    expect(kinds).toEqual(['upsert', 'insert']);
    expect(await q.hasPending()).toBe(false);
  });

  it('la contrainte laps apparaît après la bascule : lot absorbé en upsert, jamais droppé', async () => {
    const q = freshQueue();

    // 1) Migration absente → 42P10 → repli insert, bascule sticky enclenchée.
    sbCtrl().upsertErrorByTable = {
      laps: { message: 'no unique or exclusion constraint', code: '42P10' },
    };
    await q.enqueue(lapsOp('s1'));
    expect((await q.processQueue()).processed).toBe(1);

    // 2) Gabin applique la migration en cours de journée, sans redémarrer l'app :
    //    l'insert nu du repli lève désormais 23505 (tours déjà en base).
    sbCtrl().upsertErrorByTable = {};
    sbCtrl().insertErrorByTable = {
      laps: { message: 'duplicate key value violates unique constraint', code: '23505' },
    };
    await q.enqueue(lapsOp('s1'));
    const res = await q.processQueue();

    // Le 23505 PROUVE que la contrainte existe : ré-armement + rejeu en upsert.
    expect(res.processed).toBe(1);
    expect(res.dropped).toBe(0);
    const kinds = sbCtrl()
      .calls.filter((c) => c.table === 'laps')
      .map((c) => c.kind);
    expect(kinds).toEqual(['upsert', 'insert', 'insert', 'upsert']);
    expect(await q.hasPending()).toBe(false);
    expect(quarantined()).toEqual([]);
  });
});

describe('complete : réconciliation total_frames', () => {
  it('recompte les trames réelles en base pour un statut completed', async () => {
    sbCtrl().frameCount = 42;
    await enqueue(completeOp('s1'));
    const res = await processQueue();
    expect(res.processed).toBe(1);
    // Un select count (telemetry_frames) précède l’update (telemetry_sessions).
    // L'update porte un RETURNING (`.select('id')`) — il reste un update.
    const kinds = sbCtrl().calls.map((c) => `${c.table}:${c.kind}`);
    expect(kinds).toEqual(['telemetry_frames:select', 'telemetry_sessions:update']);
  });
});

describe('complete : une clôture qui ne touche AUCUNE ligne n’a pas réussi', () => {
  /**
   * LE DÉFAUT DU 13/08/2026, ET LA RAISON DE CE FICHIER.
   *
   * PostgREST rend 204 SANS erreur quand le WHERE ne rencontre aucune ligne :
   * RLS qui filtre parce que le jeton n'est pas encore restauré, `user_id` qui
   * ne correspond pas, ligne pas encore présente côté serveur.
   *
   * L'ancien code ne regardait que `error`, comptait l'opération comme
   * traitée, et SUPPRIMAIT DU DISQUE le fichier qui portait la clôture. La
   * séance restait `recording` à vie et plus rien ne la rejouait — c'est
   * exactement l'état dans lequel la séance du premier essai terrain a été
   * retrouvée.
   *
   * Ces deux tests éprouvent les deux moitiés du contrat : elle échoue, ET
   * elle reste en file.
   */
  it('zéro ligne touchée → l’opération échoue', async () => {
    sbCtrl().updateTouchesNoRow = true;
    await enqueue(completeOp('s1'));
    const res = await processQueue();
    expect(res.processed).toBe(0);
  });

  it('zéro ligne touchée → l’opération est CONSERVÉE, jamais mise en quarantaine', async () => {
    sbCtrl().updateTouchesNoRow = true;
    await enqueue(completeOp('s1'));
    await processQueue();
    expect(await hasPending()).toBe(true);
    expect(quarantined()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Concurrence du drain (Valencia §7 + §13) : le déclencheur d'un appel concurrent
// est COALESCÉ, jamais avalé — mais JAMAIS rejoué après un arrêt réseau.
// ---------------------------------------------------------------------------
describe('drain relançable : rejeu coalescé', () => {
  it('une op enqueuée PENDANT un drain est drainée par une 2e passe, sans appel externe', async () => {
    await enqueue(createOp('s1'));
    const gate = barrier();
    sbCtrl().gateByTable = { telemetry_sessions: gate.promise };

    // Drain #1 : part et PEND sur le create_session (upload .ubx en vol, en vrai).
    const inFlight = processQueue();
    await waitFor(() => sbCtrl().calls.length >= 1, 'drain #1 en vol');

    // La séance SUIVANTE arrive pendant ce drain : son op est écrite APRÈS le
    // listing figé de la passe #1 — invisible pour elle.
    await enqueue(lapsOp('s1'));
    const concurrent = await processQueue();
    expect(concurrent.processed).toBe(0); // non réentrant : rend la main…

    gate.open();
    const res = await inFlight;

    // … mais le déclencheur n'est PAS perdu : la passe #1 re-liste avant de
    // rendre la main. Avant correctif : processed=1 et l'op `laps` dormait sur
    // disque jusqu'au prochain démarrage à froid, réseau pourtant présent.
    expect(res.processed).toBe(2);
    expect(res.remaining).toBe(0);
    expect(await hasPending()).toBe(false);
  });

  it('arrêt RÉSEAU : aucun rejeu (on ne martèle pas un réseau tombé)', async () => {
    await enqueue(createOp('s1'));
    const gate = barrier();
    sbCtrl().gateByTable = { telemetry_sessions: gate.promise };
    sbCtrl().remainingOk = 0; // l'op en vol échouera réseau

    const inFlight = processQueue();
    await waitFor(() => sbCtrl().calls.length >= 1, 'drain #1 en vol');

    await enqueue(lapsOp('s1'));
    const concurrent = await processQueue();
    expect(concurrent.processed).toBe(0);

    gate.open();
    const res = await inFlight;

    // Le réseau est tombé : on sort POUR DE BON, MALGRÉ le rejeu armé.
    //
    // L'assertion PORTEUSE est le nombre de tentatives. Un rejeu naïf (qui
    // rejouerait aussi après un arrêt réseau) passerait tous les autres contrôles
    // ci-dessous : il re-liste et RETENTE aussitôt l'op sur un réseau toujours
    // absent — le marteau que la doctrine du module interdit. Une seule
    // tentative = on attend le prochain déclencheur RÉEL.
    expect(sbCtrl().calls.filter((c) => c.table === 'telemetry_sessions').length).toBe(1);
    expect(res.processed).toBe(0);
    expect(res.dropped).toBe(0);
    expect(sbCtrl().calls.filter((c) => c.table === 'laps')).toEqual([]);
    // Rien n'est perdu : tout attend le prochain déclencheur RÉEL.
    expect(await hasPending()).toBe(true);
    expect(quarantined()).toEqual([]);
  });

  it('un déclencheur concurrent ne fait pas boucler le drain indéfiniment', async () => {
    await enqueue(createOp('s1'));
    const gate = barrier();
    sbCtrl().gateByTable = { telemetry_sessions: gate.promise };

    const inFlight = processQueue();
    await waitFor(() => sbCtrl().calls.length >= 1, 'drain #1 en vol');
    // Plusieurs déclencheurs concurrents → UN seul rejeu coalescé.
    await processQueue();
    await processQueue();
    await processQueue();

    gate.open();
    const res = await inFlight;
    expect(res.processed).toBe(1);
    // La 2e passe a listé une file vide et s'est arrêtée : pas de 3e.
    expect(sbCtrl().calls.filter((c) => c.table === 'telemetry_sessions').length).toBe(1);
    expect(await hasPending()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rattachement de l'intention (Valencia §12) : par la FILE, derrière create_session.
// ---------------------------------------------------------------------------
describe('attach_intention', () => {
  it('CYCLE HORS-LIGNE → RETOUR RÉSEAU : le rattachement est rejoué, jamais perdu', async () => {
    // 10:00, mode avion : la capture enfile create_session PUIS le rattachement.
    await enqueue(createOp('s1'));
    await enqueue({ type: 'attach_intention', sessionId: 's1', intentionId: 'i1' });
    sbCtrl().remainingOk = 0;

    const offline = await processQueue();
    expect(offline.processed).toBe(0);
    expect(offline.dropped).toBe(0);
    // Avant correctif : l'UPDATE partait hors file et se perdait ici, DÉFINITIVEMENT.
    expect(await hasPending()).toBe(true);

    // 11:00, réseau revenu : la file draine intégralement, DANS L'ORDRE.
    sbCtrl().remainingOk = 1e9;
    const online = await processQueue();
    expect(online.processed).toBe(2);
    expect(await hasPending()).toBe(false);

    // Le FIFO garantit que la séance existe quand l'UPDATE part (FK + RLS).
    expect(sbCtrl().calls.map((c) => `${c.table}:${c.kind}`)).toEqual([
      'telemetry_sessions:upsert', // échec réseau
      'telemetry_sessions:upsert', // rejeu OK
      'session_intentions:update', // rattachement rejoué
    ]);
  });

  it('remonte la séance dans pendingSessionIds tant qu’il n’est pas drainé', async () => {
    await enqueue({ type: 'attach_intention', sessionId: 's1', intentionId: 'i1' });
    expect(await pendingSessionIds()).toEqual(['s1']);
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

  // Les erreurs Supabase Storage n'ont PAS de `.code` (seulement `status`) :
  // la classification SQLSTATE y est aveugle. Cf. Valencia §15.
  it('erreur Storage 403 (sans .code) : conservée, jamais droppée à tort', async () => {
    sbCtrl().uploadError = {
      name: 'StorageApiError',
      message: 'new row violates row-level security policy',
      status: 403,
      statusCode: '403',
    };
    await enqueue({
      type: 'ubx_upload',
      sessionId: 's1',
      userId: 'user-1',
      fileUri: '/oxv/s1.ubx',
    });

    const res = await processQueue();
    // JWT expiré / mauvais pilote connecté = RÉCUPÉRABLE : on ne perd pas le brut.
    expect(res.dropped).toBe(0);
    expect(await hasPending()).toBe(true);
    expect(quarantined()).toEqual([]);
  });

  it('erreur Storage 413 (au-dessus de la limite du bucket) : abandon en quarantaine', async () => {
    sbCtrl().uploadError = {
      name: 'StorageApiError',
      message: 'The object exceeded the maximum allowed size',
      status: 413,
      statusCode: '413',
    };
    await enqueue({
      type: 'ubx_upload',
      sessionId: 's1',
      userId: 'user-1',
      fileUri: '/oxv/s1.ubx',
    });

    const res = await processQueue();
    expect(res.dropped).toBe(1);
    expect(quarantined().length).toBe(1);
    expect(await hasPending()).toBe(false);
  });

  it('un upload durablement en échec ne bloque PAS la file : les ops suivantes passent', async () => {
    sbCtrl().uploadError = {
      name: 'StorageApiError',
      message: 'new row violates row-level security policy',
      status: 403,
    };
    await enqueue({
      type: 'ubx_upload',
      sessionId: 's1',
      userId: 'user-1',
      fileUri: '/oxv/s1.ubx',
    });
    await enqueue(createOp('s2', 'user-2')); // séance du pilote suivant

    const res = await processQueue();
    // L'upload est une op FEUILLE : sautée, gardée, mais la séance de s2 part.
    expect(res.processed).toBe(1);
    expect(res.dropped).toBe(0);
    expect(res.remaining).toBe(1);
    expect(sbCtrl().calls.map((c) => c.table)).toEqual(['telemetry_sessions']);
    expect(await pendingSessionIds()).toEqual(['s1']);
  });

  it('compte les tentatives et met l’upload en quarantaine au bout de MAX_UPLOAD_ATTEMPTS', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    sbCtrl().uploadError = { name: 'StorageApiError', message: 'boom', status: 403 };
    await enqueue({
      type: 'ubx_upload',
      sessionId: 's1',
      userId: 'user-1',
      fileUri: '/oxv/s1.ubx',
    });

    for (let i = 0; i < 9; i += 1) {
      const r = await processQueue();
      expect(r.dropped).toBe(0);
      expect(await hasPending()).toBe(true);
    }
    // 10e tentative : dead-letter borné (l'op reste inspectable en quarantaine).
    const last = await processQueue();
    expect(last.dropped).toBe(1);
    expect(await hasPending()).toBe(false);
    expect(quarantined().length).toBe(1);
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Rétention des .ubx (Valencia §17) : GC par ÂGE, jamais un fichier utile.
// ---------------------------------------------------------------------------
describe('gcOldCaptures', () => {
  const NOW = Date.parse('2026-07-16T12:00:00Z');
  const OLD = '/oxv/fixtures/racebox-capture-2026-07-01T10-30-00.ubx'; // 15 j
  const RECENT = '/oxv/fixtures/racebox-capture-2026-07-15T10-30-00.ubx'; // 1 j

  function ubxFiles(): string[] {
    return [...fsMap().keys()].filter((k) => k.startsWith('/oxv/fixtures/'));
  }

  it('supprime un .ubx ancien quand plus rien ne peut en avoir besoin', async () => {
    fsMap().set(OLD, 'octets');
    expect(await gcOldCaptures(NOW)).toBe(1);
    expect(ubxFiles()).toEqual([]);
  });

  it('CONSERVE un .ubx récent (filet de la journée de piste en cours)', async () => {
    fsMap().set(RECENT, 'octets');
    expect(await gcOldCaptures(NOW)).toBe(0);
    expect(ubxFiles()).toEqual([RECENT]);
  });

  it('CONSERVE un .ubx ancien encore référencé par un ubx_upload en file', async () => {
    fsMap().set(OLD, 'octets');
    await enqueue({ type: 'ubx_upload', sessionId: 's1', userId: 'user-1', fileUri: OLD });

    expect(await gcOldCaptures(NOW)).toBe(0);
    expect(ubxFiles()).toEqual([OLD]);
  });

  it('CONSERVE un .ubx ancien référencé par un ubx_upload en QUARANTAINE', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fsMap().set(OLD, 'octets');
    // Upload définitivement en échec (413) → quarantaine. Le brut local devient
    // le SEUL exemplaire : la file est vide, mais le fichier reste protégé.
    sbCtrl().uploadError = { name: 'StorageApiError', message: 'too big', status: 413 };
    await enqueue({ type: 'ubx_upload', sessionId: 's1', userId: 'user-1', fileUri: OLD });
    expect((await processQueue()).dropped).toBe(1);
    expect(await hasPending()).toBe(false);

    expect(await gcOldCaptures(NOW)).toBe(0);
    expect(ubxFiles()).toEqual([OLD]);
    warn.mockRestore();
  });

  it('CONSERVE tout tant que la file n’est pas vide (séance non confirmée en base)', async () => {
    fsMap().set(OLD, 'octets');
    // Le nom du .ubx ne porte aucun sessionId : impossible de savoir s'il est
    // celui de cette séance encore en attente. En cas de doute, on conserve.
    await enqueue(createOp('s-autre'));

    expect(await gcOldCaptures(NOW)).toBe(0);
    expect(ubxFiles()).toEqual([OLD]);
  });

  it('CONSERVE un fichier dont le nom n’est pas datable', async () => {
    const odd = '/oxv/fixtures/racebox-capture-bizarre.ubx';
    fsMap().set(odd, 'octets');
    expect(await gcOldCaptures(NOW)).toBe(0);
    expect(ubxFiles()).toEqual([odd]);
  });

  it('resumeUnsyncedCaptures fait le ménage APRÈS le drain, sans toucher au récent', async () => {
    // Horloge figée : le GC de la reprise appelle Date.now() par défaut, le test
    // ne doit pas dépendre du jour où il tourne.
    const now = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      fsMap().set(OLD, 'octets');
      fsMap().set(RECENT, 'octets');
      await enqueue(createOp('s1'));

      await resumeUnsyncedCaptures(); // draine s1 → file vide → GC autorisé

      expect(await hasPending()).toBe(false);
      expect(ubxFiles()).toEqual([RECENT]);
    } finally {
      now.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Écriture atomique + quarantaine des fichiers illisibles (Valencia §16)
// ---------------------------------------------------------------------------
describe('durabilité sur disque', () => {
  it('écrit l’op via un fichier temporaire puis renommage (jamais de .json partiel)', async () => {
    const write = FileSystem.writeAsStringAsync as unknown as jest.Mock;
    const move = FileSystem.moveAsync as unknown as jest.Mock;
    write.mockClear();
    move.mockClear();

    await enqueue(framesOp('s1'));

    // L'écriture vise un `.tmp` (invisible du drain), le renommage la publie.
    const written = write.mock.calls[0][0] as string;
    expect(written).toMatch(/\.json\.tmp$/);
    const moved = move.mock.calls[0][0] as { from: string; to: string };
    expect(moved.from).toBe(written);
    expect(moved.to).toMatch(/-frames\.json$/);
    // Aucun `.tmp` résiduel, l'op est drainable.
    expect([...fsMap().keys()].filter((k) => k.endsWith('.tmp'))).toEqual([]);
    expect(await hasPending()).toBe(true);
  });

  it('un .json tronqué est mis en quarantaine, pas détruit', async () => {
    await enqueue(framesOp('s1'));
    const name = [...fsMap().keys()].find((k) => k.endsWith('-frames.json'))!;
    // Écriture torpillée par un crash : JSON coupé en deux.
    const truncated = fsMap().get(name)!.slice(0, 40);
    fsMap().set(name, truncated);

    const res = await processQueue();
    expect(res.dropped).toBe(1);
    expect(await hasPending()).toBe(false);

    const q = quarantined();
    expect(q.length).toBe(1);
    expect(fsMap().get(q[0])).toBe(truncated); // les octets survivent, intacts
  });

  it('resumeUnsyncedCaptures évacue les .tmp TRONQUÉS en quarantaine', async () => {
    fsMap().set('/oxv/capture-queue/000000000000001-000000-frames.json.tmp', '{"op":{"typ');
    await resumeUnsyncedCaptures();

    expect([...fsMap().keys()].filter((k) => k.startsWith('/oxv/capture-queue/'))).toEqual([
      '/oxv/capture-queue/quarantine/000000000000001-000000-frames.json.tmp',
    ]);
  });

  /**
   * ===========================================================================
   * UN `.tmp` COMPLET EST UNE OPÉRATION ENTIÈRE — ON LA TERMINE, ON NE L'ALARME PAS
   * ===========================================================================
   *
   * TOUS les `.tmp` orphelins partaient en quarantaine, y compris ceux qui se
   * relisaient parfaitement. Or c'est l'artefact exact du plantage-pendant-
   * écriture que ce module existe pour encaisser, et l'écriture atomique
   * garantit que le contenu est complet ou ne l'est pas : un `.tmp` qui parse a
   * simplement raté son renommage.
   *
   * Le coût de l'erreur était disproportionné. UNE opération en quarantaine fait
   * afficher « SYNCHRONISATION BLOQUÉE » à la fin de CHAQUE séance, sans bouton,
   * définitivement — le message annonce lui-même « une intervention » qui
   * n'existe nulle part dans l'application. Un crash bénin condamnait donc le
   * pilote à une alerte permanente, sur une donnée qui était récupérable.
   */
  it('un .tmp COMPLET est repris, pas mis en quarantaine', async () => {
    const env = JSON.stringify({
      op: createOp('s-recup'),
      attempts: 0,
      enqueuedAt: '2026-08-13T00:20:00.000Z',
    });
    fsMap().set('/oxv/capture-queue/000000000000001-000000-create_session.json.tmp', env);

    await resumeUnsyncedCaptures();

    // Rien en quarantaine, et plus aucun `.tmp` résiduel.
    expect(quarantined()).toEqual([]);
    expect([...fsMap().keys()].filter((k) => k.endsWith('.tmp'))).toEqual([]);
  });

  it('et l’opération reprise part réellement', async () => {
    const env = JSON.stringify({
      op: createOp('s-recup-2'),
      attempts: 0,
      enqueuedAt: '2026-08-13T00:20:00.000Z',
    });
    fsMap().set('/oxv/capture-queue/000000000000002-000000-create_session.json.tmp', env);

    await resumeUnsyncedCaptures();
    // `resumeUnsyncedCaptures` draine : la séance a été créée, la file est vide.
    expect(await hasPending()).toBe(false);
    expect(quarantined()).toEqual([]);
  });

  it('relit une op « nue » écrite par une version antérieure de l’app', async () => {
    // Ancien format : l'op sérialisée directement, sans enveloppe.
    fsMap().set(
      '/oxv/capture-queue/000000000000001-000000-create_session.json',
      JSON.stringify(createOp('s-legacy'))
    );
    expect(await pendingSessionIds()).toEqual(['s-legacy']);
    const res = await processQueue();
    expect(res.processed).toBe(1);
    expect(await hasPending()).toBe(false);
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

/** Écrit un .ubx en mémoire à partir d'une liste d'iTOW. */
function writeUbx(uri: string, itows: number[]): void {
  const frames = itows.map((t, i) => buildUbxFrame(t, 100 + i));
  const bytes = new Uint8Array(frames.reduce((s, f) => s + f.length, 0));
  let off = 0;
  for (const f of frames) {
    bytes.set(f, off);
    off += f.length;
  }
  fsMap().set(uri, Buffer.from(bytes).toString('base64'));
}

/** Lignes réellement passées à l'upsert telemetry_frames (tous lots confondus). */
function upsertedFrames(): any[] {
  return sbCtrl()
    .calls.filter((c) => c.table === 'telemetry_frames' && c.kind === 'upsert')
    .flatMap((c) => c.rows ?? []);
}

describe('reimportUbxToFrames', () => {
  it('parse un .ubx local et réinsère les trames (séance à zéro trame)', async () => {
    const uri = '/oxv/sess.ubx';
    writeUbx(uri, [1000, 1040, 1080]);

    const { inserted, skipped } = await reimportUbxToFrames('sess', 'user-1', uri);
    expect(inserted).toBe(3);
    expect(skipped).toBe(0);
    // Réimport idempotent (§4.6) : upsert onConflict (session_id,elapsed_ms).
    const upsertCall = sbCtrl().calls.find(
      (c) => c.table === 'telemetry_frames' && c.kind === 'upsert'
    );
    expect(upsertCall).toBeDefined();
    // Sans ancre live, l'origine reste le 1er iTOW du fichier.
    expect(upsertedFrames().map((r) => r.elapsed_ms)).toEqual([0, 40, 80]);
  });

  it('lève si le fichier .ubx est absent', async () => {
    await expect(reimportUbxToFrames('sess', 'user-1', '/oxv/nope.ubx')).rejects.toThrow(
      /introuvable/i
    );
  });

  // ── Le cœur des findings [5]/[11] : le filet doit COMBLER, pas dupliquer ──
  it('séance PARTIELLEMENT synchronisée : ne réinsère QUE les trames manquantes', async () => {
    const uri = '/oxv/sess.ubx';
    // Le .ubx porte les 5 trames physiques ; la base n'en a que 3 (2 lots perdus).
    writeUbx(uri, [1000, 1040, 1080, 1120, 1160]);
    // Trames live déjà en base : elapsed_ms MURAL (origine ≠ celle du fichier) —
    // c'est précisément ce décalage qui faisait tout dupliquer.
    sbCtrl().selectRowsByTable = {
      telemetry_frames: [
        { itow_ms: 1000, elapsed_ms: 350 },
        { itow_ms: 1040, elapsed_ms: 391 },
        { itow_ms: 1160, elapsed_ms: 512 },
      ],
    };

    const { inserted, skipped } = await reimportUbxToFrames('sess', 'user-1', uri);

    // 3 trames déjà présentes (appariées par iTOW) → sautées ; 2 comblées.
    // Avant correctif : 5 insérées → 8 lignes pour 5 trames physiques.
    expect(inserted).toBe(2);
    expect(skipped).toBe(3);

    const rows = upsertedFrames();
    expect(rows.map((r) => r.itow_ms)).toEqual([1080, 1120]);
    // Recalage sur l'ancre live (iTOW 1000 → elapsed 350) : les trames comblées
    // tombent sur la MÊME échelle de temps que les trames live, pas sur 80/120.
    expect(rows.map((r) => r.elapsed_ms)).toEqual([430, 470]);
  });

  it('un réimport RÉPÉTÉ sur une séance déjà complète n’insère rien', async () => {
    const uri = '/oxv/sess.ubx';
    writeUbx(uri, [1000, 1040, 1080]);
    sbCtrl().selectRowsByTable = {
      telemetry_frames: [
        { itow_ms: 1000, elapsed_ms: 350 },
        { itow_ms: 1040, elapsed_ms: 390 },
        { itow_ms: 1080, elapsed_ms: 430 },
      ],
    };

    const { inserted, skipped } = await reimportUbxToFrames('sess', 'user-1', uri);
    expect(inserted).toBe(0);
    expect(skipped).toBe(3);
    expect(upsertedFrames()).toEqual([]);
  });

  it('n’attribue JAMAIS un elapsed_ms déjà occupé par une trame live', async () => {
    const uri = '/oxv/sess.ubx';
    writeUbx(uri, [1000, 1040]);
    // L'ancre (iTOW 1000 → elapsed 100) ferait tomber la trame comblée (iTOW
    // 1040) sur elapsed 140 — déjà pris par une AUTRE trame live. Sous
    // ON CONFLICT DO NOTHING, elle serait jetée : la trame manquante qu'on
    // voulait justement restaurer. L'allocation doit la décaler.
    sbCtrl().selectRowsByTable = {
      telemetry_frames: [
        { itow_ms: 1000, elapsed_ms: 100 },
        { itow_ms: 9999, elapsed_ms: 140 },
      ],
    };

    const { inserted } = await reimportUbxToFrames('sess', 'user-1', uri);
    expect(inserted).toBe(1);
    const rows = upsertedFrames();
    expect(rows.map((r) => r.itow_ms)).toEqual([1040]);
    expect(rows[0].elapsed_ms).toBe(141); // décalée, pas perdue
  });

  it('iTOW RÉPÉTÉ (avant fix GPS) : la trame en trop est restituée, jamais confondue', async () => {
    const uri = '/oxv/sess.ubx';
    // Trois trames physiques distinctes partagent l'iTOW 0 (répétition avant fix).
    writeUbx(uri, [0, 0, 0, 40]);
    // La base n'en a qu'UNE. L'anti-join est un MULTI-ENSEMBLE : il doit rendre
    // les deux autres, pas les écarter comme « déjà présentes ».
    sbCtrl().selectRowsByTable = {
      telemetry_frames: [{ itow_ms: 0, elapsed_ms: 10 }],
    };

    const { inserted, skipped } = await reimportUbxToFrames('sess', 'user-1', uri);
    expect(inserted).toBe(3); // 2 trames à iTOW 0 + la trame à iTOW 40
    expect(skipped).toBe(1);
    const rows = upsertedFrames();
    expect(rows.map((r) => r.itow_ms)).toEqual([0, 0, 40]);
    // Clés d'unicité toutes distinctes : aucune ne sera jetée par DO NOTHING.
    const elapsed = rows.map((r) => r.elapsed_ms);
    expect(new Set([...elapsed, 10]).size).toBe(4);
  });

  it('REFUSE une séance portant des trames sans itow_ms plutôt que de la corrompre', async () => {
    const uri = '/oxv/sess.ubx';
    writeUbx(uri, [1000, 1040]);
    // Lignes héritées, écrites avant l'ajout de la colonne : inappariables.
    sbCtrl().selectRowsByTable = {
      telemetry_frames: [
        { itow_ms: null, elapsed_ms: 350 },
        { itow_ms: 1040, elapsed_ms: 390 },
      ],
    };

    await expect(reimportUbxToFrames('sess', 'user-1', uri)).rejects.toThrow(/sans itow_ms/i);
    // Rien n'a été écrit : le .ubx reste le filet, l'opérateur arbitre.
    expect(upsertedFrames()).toEqual([]);
  });
});

describe('la colonne générée qui empêchait TOUTE clôture', () => {
  /**
   * ===========================================================================
   * LE DÉFAUT LE PLUS COÛTEUX DU DÉPÔT, TROUVÉ LE 13/08/2026
   * ===========================================================================
   *
   * `telemetry_sessions.duration_seconds` est
   * `GENERATED ALWAYS AS (EXTRACT(epoch FROM (ended_at - started_at)))`.
   * Postgres refuse toute écriture avec le code **428C9**.
   *
   * La clôture l'envoyait à chaque fois. L'UPDATE échouait ; 428C9 appartient à
   * la classe 42, classée abandonnable ; l'opération partait en QUARANTAINE
   * DÉFINITIVE. La séance restait `recording` à vie, et `fetchAllSessions`
   * filtrant sur `completed`, elle n'apparaissait dans AUCUNE liste.
   *
   * Constaté sur la première séance réelle : 26 999 trames et 3 tours
   * parfaitement écrits, et une séance invisible. Vérifié ensuite sur
   * l'historique — aucune séance captée par l'application ne s'était jamais
   * close.
   *
   * Deux verrous, et il faut les deux : l'émetteur ne l'envoie plus, ET la file
   * la retire des opérations DÉJÀ ÉCRITES SUR DISQUE par une version
   * antérieure. Sans le second, les séances qui dorment sur les téléphones
   * échoueraient éternellement — c'est-à-dire précisément celles qu'on cherche
   * à récupérer.
   */
  it('une op ANCIENNE portant duration_seconds est nettoyée, pas perdue', async () => {
    const op = completeOp('s1') as any;
    op.updates = { ...op.updates, duration_seconds: 1094 };
    await enqueue(op);
    const res = await processQueue();
    expect(res.processed).toBe(1);
    expect(res.dropped).toBe(0);
    expect(quarantined()).toEqual([]);
  });

  it('la colonne générée n’atteint JAMAIS la base', async () => {
    const op = completeOp('s1') as any;
    op.updates = { ...op.updates, duration_seconds: 1094, status: 'completed' };
    await enqueue(op);
    await processQueue();
    const maj = sbCtrl().calls.find(
      (c: any) => c.table === 'telemetry_sessions' && c.kind === 'update'
    );
    expect(maj).toBeDefined();
    // Le mock n'enregistre pas la charge de l'update ; on vérifie au moins que
    // l'opération a abouti — un 428C9 l'aurait fait échouer et mettre en
    // quarantaine, ce que le test précédent couvre.
    expect(quarantined()).toEqual([]);
  });

  /** L'émetteur, lui, ne doit plus jamais la produire. */
  it('stopCaptureSession n’envoie plus duration_seconds', () => {
    const fs2 = require('fs') as typeof import('fs');
    const path2 = require('path') as typeof import('path');
    const src = fs2.readFileSync(path2.join(__dirname, '..', 'captureSessionService.ts'), 'utf8');
    // Le seul `duration_seconds` restant est celui des TOURS (table `laps`),
    // qui n'est pas une colonne générée.
    const dansLaCloture = /updates: \{[\s\S]*?duration_seconds:/.test(src);
    expect(dansLaCloture).toBe(false);
  });
});
