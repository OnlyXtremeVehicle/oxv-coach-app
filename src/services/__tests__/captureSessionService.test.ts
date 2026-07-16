/* eslint-disable @typescript-eslint/no-explicit-any, import/first */
/**
 * Service de capture — CONCURRENCE & CYCLE DE VIE (Valencia §6, §12, §14).
 *
 * On mocke tout l'environnement natif/réseau (BLE, .ubx, tours, relais live,
 * keep-awake, Supabase, file de synchro) et on garde RÉEL le mapping pur
 * (captureFrameMapping). Les objets de contrôle exposent les callbacks capturés
 * (`onData`, `onReconnectChange`) pour piloter la capture depuis le test, et des
 * barrières pour ouvrir de vraies fenêtres de concurrence.
 *
 * Couverture : garde de génération de `finalizeOnLostLink` (une capture ne doit
 * jamais désarmer les protections d'une AUTRE), bornage du lot de `flush` +
 * flush final exhaustif, ordre d'enqueue du rattachement d'intention.
 */

import { GpsFix, type RaceBoxData } from '@/types/telemetry';

// --- Contrôle global (survit aux resetModules éventuels) ---
interface Ctrl {
  /** Callbacks capturés à l'armement de la capture. */
  onData: ((f: RaceBoxData) => void) | null;
  onReconnect: ((rc: any) => void) | null;
  /** Lots réellement passés à `telemetry_frames.insert`. */
  inserts: any[][];
  /** Barrière optionnelle sur l'insert des trames. */
  insertGate: Promise<void> | null;
  /** Barrière optionnelle sur `stopCapture()` (fermeture du .ubx). */
  stopCaptureGate: Promise<void> | null;
  /** Ops enfilées dans la file de synchro. */
  enqueued: any[];
  /** Id d'intention gelé localement (null = aucune intention en attente). */
  pendingIntentionId: string | null;
  forgotIntention: number;
}
function ctrl(): Ctrl {
  const g = globalThis as any;
  if (!g.__OXV_CS__) {
    g.__OXV_CS__ = {
      onData: null,
      onReconnect: null,
      inserts: [],
      insertGate: null,
      stopCaptureGate: null,
      enqueued: [],
      pendingIntentionId: null,
      forgotIntention: 0,
    } as Ctrl;
  }
  return g.__OXV_CS__;
}

const setUnlimitedReconnect = jest.fn();
const activateKeepAwakeAsync = jest.fn(async () => undefined);
const deactivateKeepAwake = jest.fn();

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (...a: unknown[]) => activateKeepAwakeAsync(...(a as [])),
  deactivateKeepAwake: (...a: unknown[]) => deactivateKeepAwake(...(a as [])),
}));

jest.mock('@/ble/bluetoothService', () => ({
  bluetoothService: {
    onData: (cb: (f: RaceBoxData) => void) => {
      const g = globalThis as any;
      g.__OXV_CS__.onData = cb;
      return () => {
        g.__OXV_CS__.onData = null;
      };
    },
    onReconnectChange: (cb: (rc: any) => void) => {
      const g = globalThis as any;
      g.__OXV_CS__.onReconnect = cb;
      return () => {
        g.__OXV_CS__.onReconnect = null;
      };
    },
    setUnlimitedReconnect: (v: boolean) => setUnlimitedReconnect(v),
  },
}));

jest.mock('@/ble/captureMode', () => ({
  startCapture: jest.fn(),
  stopCapture: jest.fn(async () => {
    const g = globalThis as any;
    const gate: Promise<void> | null = g.__OXV_CS__.stopCaptureGate;
    if (gate) await gate;
    return '/oxv/fixtures/racebox-capture-2026-07-16T10-00-00.ubx';
  }),
}));

jest.mock('@/ble/lapDetectionRunner', () => ({
  startLapDetection: jest.fn(),
  stopLapDetection: jest.fn(),
  getRecordedLaps: jest.fn(() => []),
}));

jest.mock('@/services/liveRelayRunner', () => ({
  startPilotLiveRelay: jest.fn(async () => undefined),
  stopPilotLiveRelay: jest.fn(),
}));

jest.mock('@/services/intentionsService', () => ({
  peekPendingIntentionId: jest.fn(() => (globalThis as any).__OXV_CS__.pendingIntentionId),
  forgetPendingIntention: jest.fn(() => {
    (globalThis as any).__OXV_CS__.forgotIntention += 1;
  }),
}));

jest.mock('@/store/useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      startSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      endSession: jest.fn(),
      abortSession: jest.fn(),
      lapCount: 0,
      bestLapMs: null,
    }),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (rows: any[]) => {
        const g = globalThis as any;
        g.__OXV_CS__.inserts.push(rows);
        const gate: Promise<void> | null = g.__OXV_CS__.insertGate;
        const result = { error: null };
        return gate ? gate.then(() => result) : Promise.resolve(result);
      },
    }),
  },
}));

jest.mock('../captureSyncQueue', () => ({
  enqueue: jest.fn(async (op: unknown) => {
    (globalThis as any).__OXV_CS__.enqueued.push(op);
  }),
  processQueue: jest.fn(async () => ({ processed: 0, dropped: 0, remaining: 0 })),
  newUuid: jest.fn(() => `uuid-${(globalThis as any).__OXV_CS__.enqueued.length}-${Math.random()}`),
}));

import {
  getCaptureLinkStatus,
  isCaptureSessionActive,
  startCaptureSession,
  stopCaptureSession,
} from '../captureSessionService';

// --- Outils ---

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

/** Laisse retomber les chaînes async en vol (fire-and-forget compris). */
async function settle(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i += 1) await new Promise((r) => setTimeout(r, 0));
}

function raceBoxFrame(): RaceBoxData {
  return {
    timestamp: {
      year: 2026,
      month: 7,
      day: 16,
      hour: 10,
      minute: 0,
      second: 0,
      nanoseconds: 0,
      iTOW: 1000,
    },
    gps: {
      fix: GpsFix.Fix3D,
      satellites: 12,
      latitude: 45.6,
      longitude: -0.14,
      altitude: 30,
      accuracy: 1.2,
    },
    motion: { speed: 144, heading: 90, headingValid: true },
    imu: { gForceX: 0.3, gForceY: -1.1, gForceZ: 1, rotRateX: 1, rotRateY: 2, rotRateZ: 3 },
    battery: { isCharging: false, level: 80 },
  };
}

const START = { userId: 'user-1', finishLine: { lat: 45.6, lon: -0.141, radiusM: 40 } };

beforeEach(async () => {
  // Une capture d'un test précédent ne doit pas fuiter (module non réinitialisé).
  if (isCaptureSessionActive()) await stopCaptureSession();
  const c = ctrl();
  c.onData = null;
  c.onReconnect = null;
  c.inserts = [];
  c.insertGate = null;
  c.stopCaptureGate = null;
  c.enqueued = [];
  c.pendingIntentionId = null;
  c.forgotIntention = 0;
  setUnlimitedReconnect.mockClear();
  activateKeepAwakeAsync.mockClear();
  deactivateKeepAwake.mockClear();
});

afterEach(async () => {
  if (isCaptureSessionActive()) await stopCaptureSession();
});

// ---------------------------------------------------------------------------
// [6] finalizeOnLostLink : garde de GÉNÉRATION.
//
// `stopCaptureSession` remet `current` à null dès son ENTRÉE, bien avant son
// premier await : une capture SUIVANTE peut donc démarrer pendant le drain. Les
// effets de bord post-await de la finalisation (reconnexion illimitée,
// keep-awake, statut de lien) sont GLOBAUX — les appliquer sans re-vérifier
// désarmerait les protections d'une séance qui, elle, enregistre.
// ---------------------------------------------------------------------------
describe('finalizeOnLostLink — ne touche pas une capture qui n’est plus la sienne', () => {
  it('une capture B démarrée pendant la finalisation de A garde SES protections', async () => {
    // 1) Capture A armée.
    const a = await startCaptureSession(START);
    expect(a.ok).toBe(true);

    // 2) Liaison définitivement perdue → finalisation de A. On la fait PENDRE sur
    //    la fermeture du .ubx (en vrai : drain Supabase sur réseau de circuit).
    const gate = barrier();
    ctrl().stopCaptureGate = gate.promise;
    ctrl().onReconnect!({ phase: 'lost', attempt: 5, nextDelayMs: 0 });

    // 3) `current` est déjà null : le pilote peut relancer une séance.
    await waitFor(() => !isCaptureSessionActive(), 'A détachée');
    const b = await startCaptureSession(START);
    expect(b.ok).toBe(true);
    expect(b.sessionId).not.toBe(a.sessionId);

    // B est ARMÉE : reconnexion illimitée + keep-awake + statut 'recording'.
    expect(setUnlimitedReconnect).toHaveBeenLastCalledWith(true);
    expect(getCaptureLinkStatus()).toBe('recording');
    setUnlimitedReconnect.mockClear();
    deactivateKeepAwake.mockClear();

    // 4) La finalisation de A se débloque, APRÈS le démarrage de B.
    gate.open();
    await settle();

    // Sans la garde, A désarmait ici les trois protections de B :
    //  - reconnexion ramenée en mode BORNÉ (une coupure BLE clôturerait B au
    //    lieu de reprendre sous le même identifiant) ;
    //  - verrou d'écran relâché (auto-verrouillage → radio coupée → trames
    //    perdues sur un relais de 20 min) ;
    //  - « liaison perdue » affiché sur une séance qui enregistre.
    expect(setUnlimitedReconnect).not.toHaveBeenCalledWith(false);
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
    expect(getCaptureLinkStatus()).toBe('recording');
    expect(isCaptureSessionActive()).toBe(true);
  });

  it('sans capture successeur, le chemin terminal désarme bien tout et pose "lost"', async () => {
    // Non-régression du chemin nominal : la garde ne doit pas neutraliser la
    // finalisation quand c'est bien la dernière capture qui se ferme.
    await startCaptureSession(START);
    setUnlimitedReconnect.mockClear();
    deactivateKeepAwake.mockClear();

    ctrl().onReconnect!({ phase: 'lost', attempt: 5, nextDelayMs: 0 });
    await settle();

    expect(isCaptureSessionActive()).toBe(false);
    expect(setUnlimitedReconnect).toHaveBeenCalledWith(false);
    expect(deactivateKeepAwake).toHaveBeenCalled();
    expect(getCaptureLinkStatus()).toBe('lost');
  });
});

// ---------------------------------------------------------------------------
// [14] flush : le lot est BORNÉ, le « vide tout » est réservé au flush FINAL.
// ---------------------------------------------------------------------------
describe('flush — bornage du lot', () => {
  it('ne draine QUE le backlog présent à l’entrée, par lots de FLUSH_EVERY_FRAMES', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    // L'insert du 1er lot PEND : c'est pendant cette fenêtre que le producteur
    // 25 Hz continue de livrer des trames (callback ble-plx sur le thread JS).
    const gate = barrier();
    ctrl().insertGate = gate.promise;

    // 120 trames d'affilée : le seuil de 50 déclenche le flush, les 70 suivantes
    // arrivent PENDANT l'écriture du 1er lot.
    for (let i = 0; i < 120; i += 1) emit(raceBoxFrame());

    gate.open();
    await settle();

    // Un SEUL lot, borné à 50. Avant correctif : [50, 70] — la boucle drainait
    // aussi les trames arrivées pendant l'écriture, courait après le producteur,
    // et la taille de lot s'effondrait vers rate × RTT (≈ 4 en 4G, ≈ 1 en Wi-Fi).
    expect(ctrl().inserts.map((b) => b.length)).toEqual([50]);
  });

  it('le flush FINAL vide TOUT ce qui reste (aucune queue de séance derrière lui)', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    const gate = barrier();
    ctrl().insertGate = gate.promise;
    for (let i = 0; i < 120; i += 1) emit(raceBoxFrame());
    gate.open();
    await settle();
    expect(ctrl().inserts.map((b) => b.length)).toEqual([50]); // 70 en attente

    // L'arrêt draine le reste : `drain()` n'est appelé qu'APRÈS `unsubData()`,
    // plus aucune trame n'arrive, la passe finale termine.
    ctrl().insertGate = null;
    const res = await stopCaptureSession();

    expect(res.ok).toBe(true);
    expect(ctrl().inserts.map((b) => b.length)).toEqual([50, 50, 20]);
    // Les 120 trames émises sont toutes parties : aucune perte au bornage.
    expect(ctrl().inserts.reduce((s, b) => s + b.length, 0)).toBe(120);
    expect(res.totalFrames).toBe(120);
  });

  it('le timer écoule un buffer PARTIEL (un lot incomplet part quand même)', async () => {
    // Le bornage se fait sur un compteur, pas sur un `break` au lot incomplet :
    // sinon 30 trames en attente ne partiraient jamais.
    await startCaptureSession(START);
    const emit = ctrl().onData!;
    for (let i = 0; i < 30; i += 1) emit(raceBoxFrame());
    expect(ctrl().inserts).toEqual([]); // seuil de 50 non atteint

    await stopCaptureSession(); // le flush final écoule le partiel
    expect(ctrl().inserts.map((b) => b.length)).toEqual([30]);
  });
});

// ---------------------------------------------------------------------------
// [12] Rattachement de l'intention : par la FILE, DERRIÈRE le create_session.
// ---------------------------------------------------------------------------
describe('rattachement de l’intention', () => {
  it('enfile attach_intention APRÈS create_session (l’ordre est la garantie porteuse)', async () => {
    ctrl().pendingIntentionId = 'i1';
    const res = await startCaptureSession(START);

    const ops = ctrl().enqueued;
    expect(ops.map((o) => o.type)).toEqual(['create_session', 'attach_intention']);
    // Le FIFO garantit alors que la séance EXISTE quand l'UPDATE part : FK
    // `session_id` et RLS `with check` satisfaites.
    expect(ops[1]).toMatchObject({ intentionId: 'i1', sessionId: res.sessionId });
  });

  it('PURGE le marqueur local dès l’enfilement (la séance suivante n’hérite pas)', async () => {
    ctrl().pendingIntentionId = 'i1';
    await startCaptureSession(START);
    // C'est ce point — et non la mise en file — qui tue la réattribution : sans
    // purge, la séance suivante retrouvait le marqueur et s'appropriait
    // l'intention de la précédente (Bilan faux).
    expect(ctrl().forgotIntention).toBe(1);
  });

  it('sans intention en attente, aucune op de rattachement', async () => {
    ctrl().pendingIntentionId = null;
    await startCaptureSession(START);
    expect(ctrl().enqueued.map((o) => o.type)).toEqual(['create_session']);
    expect(ctrl().forgotIntention).toBe(0);
  });
});
