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
  /** Tours que le runner de détection déclare avoir enregistrés. */
  recordedLaps: any[];
  /** Numéro de tour EN COURS côté runner (0 = outlap). Piloté par le test. */
  currentLapNumber: number;
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
      recordedLaps: [],
      currentLapNumber: 0,
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
    /**
     * Le STATUT BLE, ajouté le 13/08/2026. La capture ne s'abonnait qu'à la
     * PHASE de reconnexion, et une coupure sans cible de reconnexion connue
     * n'émet jamais de phase : le lien tombait, le voyant REC restait rouge, et
     * plus une trame n'arrivait.
     */
    onStatusChange: (cb: (s: string) => void) => {
      const g = globalThis as any;
      g.__OXV_CS__.onStatus = cb;
      return () => {
        g.__OXV_CS__.onStatus = null;
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
  getRecordedLaps: jest.fn(() => (globalThis as any).__OXV_CS__.recordedLaps),
  // Le runner est la SOURCE des frontières de tour ; le test le joue en pilotant
  // ce numéro entre deux trames, exactement comme un franchissement de ligne.
  getCurrentLapNumber: jest.fn(() => (globalThis as any).__OXV_CS__.currentLapNumber),
  // Distance totale de séance — alimente `telemetry_sessions.distance_km`, qui
  // n'avait jamais reçu de valeur avant le 13/08/2026.
  getDistanceTotaleM: jest.fn(() => (globalThis as any).__OXV_CS__.distanceTotaleM ?? null),
  // Pause du pilote — SUSPEND sans détruire l'état (arrêt aux stands). Sans
  // cette distinction, une pause effacerait le chronométrage de la séance.
  pauseLapDetection: jest.fn(),
  resumeLapDetection: jest.fn(),
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
      // Relevé FACTUEL du trou de liaison, posé au lot 21e. Il est appelé par
      // `logLinkGap` — donc par toute reprise, y compris celle d'une pause.
      addLinkGap: jest.fn(),
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
  isCapturePaused,
  isCaptureSessionActive,
  pauseCaptureSession,
  resumeCaptureSession,
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

function raceBoxFrame(o: { speed?: number; gx?: number; gy?: number } = {}): RaceBoxData {
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
    motion: { speed: o.speed ?? 144, heading: 90, headingValid: true },
    imu: {
      gForceX: o.gx ?? 0.3,
      gForceY: o.gy ?? -1.1,
      gForceZ: 1,
      rotRateX: 1,
      rotRateY: 2,
      rotRateZ: 3,
    },
    battery: { isCharging: false, level: 80 },
  };
}

/** Tour tel que le runner de détection l'enregistre (durée en ms). */
function recordedLap(lapNumber: number, durationMs = 100_000): any {
  return {
    lapNumber,
    startedAtMs: 1_700_000_000_000,
    endedAtMs: 1_700_000_000_000 + durationMs,
    durationMs,
    startLat: 45.6,
    startLon: -0.141,
    endLat: 45.6,
    endLon: -0.141,
  };
}

/** Les lignes `laps` réellement enfilées à la clôture. */
/**
 * Les lignes du lot de tours qui FAIT AUTORITÉ.
 *
 * Depuis le 13/08/2026, chaque tour est aussi enfilé DÈS QU'IL SE CLÔT — le
 * filet contre une application tuée en piste. Il y a donc plusieurs ops `laps`
 * par séance, et `find` attrapait la première, c'est-à-dire un tour isolé.
 *
 * Le lot construit à l'arrêt porte `final: true` : c'est lui qui contient tous
 * les tours, `is_best_lap` et les maxima définitifs.
 */
function enqueuedLapRows(): any[] {
  const op = ctrl().enqueued.find((o: any) => o.type === 'laps' && o.final === true);
  return op ? op.rows : [];
}

/** Les lots enfilés À CHAUD, un par tour clos pendant la séance. */
function enqueuedLapsAChaud(): any[] {
  return ctrl().enqueued.filter((o: any) => o.type === 'laps' && o.final !== true);
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
  c.recordedLaps = [];
  c.currentLapNumber = 0;
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
// MAXIMA PAR TOUR — la donnée que `laps.max_*` n'a jamais reçue.
//
// `buildLapRows` n'écrivait aucune des colonnes statistiques, et aucun trigger ne
// les calculait : elles étaient NULL sur 100 % des séances. `computeSmoothness`
// les relisait en `?? 0` → écart-type nul → fluidité 100 FABRIQUÉE, pour ~24 % de
// la marge globale. On corrige à la SOURCE : la donnée est mesurée pendant la
// capture et écrite. Ces tests verrouillent le rattachement trame↔tour et le
// refus d'inventer.
// ---------------------------------------------------------------------------
describe('maxima par tour — la donnée est ÉCRITE, ou rien ne l’est', () => {
  it('rattache chaque trame à son tour et écrit les vraies mesures', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    // Outlap : le pilote sort des stands, freine fort, appuie fort. Ces trames
    // ne sont d'AUCUN tour chronométré.
    ctrl().currentLapNumber = 0;
    emit(raceBoxFrame({ speed: 200, gx: 1.4, gy: -1.9 }));

    // Franchissement de la ligne → le runner ouvre le tour 1.
    ctrl().currentLapNumber = 1;
    emit(raceBoxFrame({ speed: 100, gx: 0.8, gy: 0.5 }));
    emit(raceBoxFrame({ speed: 160, gx: -0.6, gy: -1.1 }));

    // Franchissement suivant → tour 1 clos, tour 2 ouvert.
    ctrl().currentLapNumber = 2;
    emit(raceBoxFrame({ speed: 120, gx: 0.2, gy: 0.3 }));

    ctrl().recordedLaps = [recordedLap(1, 100_000), recordedLap(2, 101_000)];
    await stopCaptureSession();

    const rows = enqueuedLapRows();
    expect(rows).toHaveLength(2);

    // Tour 1 : maxima de SES trames seulement.
    expect(rows[0].lap_number).toBe(1);
    expect(rows[0].max_g_lateral).toBeCloseTo(1.1, 5); // |−1.1| > |0.5|
    expect(rows[0].max_g_braking).toBeCloseTo(0.8, 5); // x > 0
    expect(rows[0].max_g_accel).toBeCloseTo(0.6, 5); // −x > 0
    expect(rows[0].max_speed_kmh).toBe(160);
    expect(rows[0].avg_speed_kmh).toBeCloseTo(130, 5);

    // L'OUTLAP N'A PAS DÉTEINT sur le tour 1 : ses 1.9 g / 1.4 g / 200 km/h
    // auraient fabriqué un maximum que le tour 1 n'a jamais produit.
    expect(rows[0].max_g_lateral).not.toBeCloseTo(1.9, 5);
    expect(rows[0].max_speed_kmh).not.toBe(200);

    // Tour 2 : ses propres mesures, indépendantes du tour 1.
    expect(rows[1].lap_number).toBe(2);
    expect(rows[1].max_g_lateral).toBeCloseTo(0.3, 5);
    expect(rows[1].max_speed_kmh).toBe(120);
  });

  it('un tour SANS aucune trame rattachée reste null — jamais 0', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    ctrl().currentLapNumber = 1;
    emit(raceBoxFrame({ speed: 150, gx: 0.7, gy: -0.9 }));

    // Le runner déclare un tour 2 (ligne franchie deux fois) mais aucune trame
    // n'a pu lui être rattachée — trou de liaison BLE sur tout le tour, par ex.
    ctrl().recordedLaps = [recordedLap(1), recordedLap(2)];
    await stopCaptureSession();

    const rows = enqueuedLapRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].max_g_lateral).toBeCloseTo(0.9, 5);

    // Le verrou du finding : ce tour se rendra « — ». Un 0 ici rentrerait dans
    // l'écart-type de la fluidité comme une mesure réelle.
    expect(rows[1].max_g_lateral).toBeNull();
    expect(rows[1].max_g_braking).toBeNull();
    expect(rows[1].max_g_accel).toBeNull();
    expect(rows[1].max_speed_kmh).toBeNull();
    expect(rows[1].avg_speed_kmh).toBeNull();
    expect(rows[1].max_g_lateral).not.toBe(0);
  });

  it('le DERNIER tour est figé à l’arrêt (il ne se clôt pas par incrément)', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    ctrl().currentLapNumber = 1;
    emit(raceBoxFrame({ speed: 130, gx: 0.5, gy: -0.7 }));
    emit(raceBoxFrame({ speed: 170, gx: -0.3, gy: 1.3 }));

    // Le franchissement final atteint le runner (le tour 1 est ENREGISTRÉ) mais
    // aucun incrément ne nous parvient : plus aucune trame ne suit. Sans gel à
    // l'arrêt, ce tour partirait vide alors qu'il a bien été mesuré.
    ctrl().recordedLaps = [recordedLap(1)];
    await stopCaptureSession();

    const rows = enqueuedLapRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].max_g_lateral).toBeCloseTo(1.3, 5);
    expect(rows[0].max_speed_kmh).toBe(170);
    expect(rows[0].max_g_braking).toBeCloseTo(0.5, 5);
    expect(rows[0].max_g_accel).toBeCloseTo(0.3, 5);
  });

  it('les maxima ne fuient pas d’une séance à la suivante', async () => {
    await startCaptureSession(START);
    ctrl().currentLapNumber = 1;
    ctrl().onData!(raceBoxFrame({ speed: 250, gx: 1.5, gy: -1.8 }));
    ctrl().recordedLaps = [recordedLap(1)];
    await stopCaptureSession();

    ctrl().enqueued = [];
    await startCaptureSession(START);
    ctrl().currentLapNumber = 1;
    ctrl().onData!(raceBoxFrame({ speed: 90, gx: 0.1, gy: -0.2 }));
    ctrl().recordedLaps = [recordedLap(1)];
    await stopCaptureSession();

    // L'état vit dans la CaptureState, pas dans le module : la séance B porte
    // ses propres mesures, pas les 1.8 g de A.
    const rows = enqueuedLapRows();
    expect(rows[0].max_g_lateral).toBeCloseTo(0.2, 5);
    expect(rows[0].max_speed_kmh).toBe(90);
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

describe('les tours survivent à une application tuée en piste', () => {
  /**
   * ===========================================================================
   * LE DÉFAUT QUE CES TESTS FERMENT
   * ===========================================================================
   *
   * Les tours détectés vivaient UNIQUEMENT en mémoire et n'étaient enfilés qu'à
   * l'arrêt de la capture. Les trames, elles, partent toutes les quatre
   * secondes.
   *
   * Une application tuée en piste — iOS qui réclame de la mémoire, un plantage,
   * une batterie à plat — effaçait donc vingt minutes de chronométrage pendant
   * que les trames correspondantes étaient déjà en base.
   *
   * Le cas n'est pas théorique : la nuit du 13/08/2026, l'application s'est
   * arrêtée juste après l'envoi des tours.
   */
  it('chaque tour est enfilé DÈS QU’IL SE CLÔT, sans attendre l’arrêt', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    ctrl().currentLapNumber = 1;
    emit(raceBoxFrame({ speed: 150, gx: 0.7, gy: -0.9 }));

    // Le runner clôt le tour 1 : le changement de numéro EST le signal.
    ctrl().recordedLaps = [recordedLap(1)];
    ctrl().currentLapNumber = 2;
    emit(raceBoxFrame({ speed: 120, gx: 0.2, gy: -0.3 }));

    // AVANT tout arrêt, le tour 1 doit déjà être sur la file.
    const aChaud = enqueuedLapsAChaud();
    expect(aChaud.length).toBeGreaterThan(0);
    expect(aChaud[0].rows[0].lap_number).toBe(1);
    expect(aChaud[0].rows[0].duration_seconds).toBeGreaterThan(0);

    await stopCaptureSession();
  });

  /**
   * Le tour écrit à chaud ne PRÉTEND pas savoir s'il est le meilleur : au
   * moment où il se clôt, les suivants n'existent pas.
   */
  it('le tour écrit à chaud ne se déclare jamais meilleur tour', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;
    ctrl().currentLapNumber = 1;
    emit(raceBoxFrame({ speed: 150, gx: 0.7, gy: -0.9 }));
    ctrl().recordedLaps = [recordedLap(1)];
    ctrl().currentLapNumber = 2;
    emit(raceBoxFrame({ speed: 120, gx: 0.2, gy: -0.3 }));

    expect(enqueuedLapsAChaud()[0].rows[0].is_best_lap).toBe(false);
    await stopCaptureSession();
  });

  /**
   * Et le lot final FAIT AUTORITÉ : il écrase les lignes écrites à chaud pour
   * poser le bon meilleur tour et les maxima définitifs.
   */
  it('le lot final est marqué autoritaire', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;
    ctrl().currentLapNumber = 1;
    emit(raceBoxFrame({ speed: 150, gx: 0.7, gy: -0.9 }));
    ctrl().recordedLaps = [recordedLap(1)];
    await stopCaptureSession();

    const final = ctrl().enqueued.find((o: any) => o.type === 'laps' && o.final === true);
    expect(final).toBeDefined();
    expect(final.rows.some((r: any) => r.is_best_lap === true)).toBe(true);
  });
});

describe('la pause du pilote — le rythme réel d’une journée', () => {
  /**
   * ===========================================================================
   * LE GESTE QUI N'EXISTAIT NULLE PART
   * ===========================================================================
   *
   * Un relais, un arrêt aux stands, un relais : c'est la journée nominale. Le
   * pilote n'avait pourtant que deux gestes — « Terminer le run », qui CLÔT la
   * séance, ou laisser tourner l'enregistrement sur un véhicule à l'arrêt.
   *
   * La seconde option gonfle la durée, la distance et les moyennes avec du
   * temps qui n'est pas du roulage : la séance ment sans qu'aucune ligne de
   * code ne soit fausse.
   */
  it('la pause ÉCARTE les trames — le temps aux stands n’est pas du roulage', async () => {
    await startCaptureSession(START);
    const emit = ctrl().onData!;

    emit(raceBoxFrame({ speed: 100, gx: 0.3, gy: -0.4 }));
    pauseCaptureSession();
    expect(isCapturePaused()).toBe(true);

    // Dix trames à l'arrêt : aucune ne doit entrer.
    for (let i = 0; i < 10; i++) emit(raceBoxFrame({ speed: 0, gx: 0, gy: 0 }));

    resumeCaptureSession();
    emit(raceBoxFrame({ speed: 110, gx: 0.3, gy: -0.5 }));
    const res = await stopCaptureSession();
    // 2 trames roulées, jamais 12.
    expect(res.totalFrames).toBe(2);
  });

  it('la reprise remet la capture en enregistrement', async () => {
    await startCaptureSession(START);
    pauseCaptureSession();
    resumeCaptureSession();
    expect(isCapturePaused()).toBe(false);
    await stopCaptureSession();
  });

  /** Deux appuis de suite ne doivent pas empiler deux pauses. */
  it('les deux gestes sont idempotents', async () => {
    await startCaptureSession(START);
    pauseCaptureSession();
    pauseCaptureSession();
    expect(isCapturePaused()).toBe(true);
    resumeCaptureSession();
    resumeCaptureSession();
    expect(isCapturePaused()).toBe(false);
    await stopCaptureSession();
  });

  /** Hors capture, les deux gestes sont sans effet — jamais d’exception. */
  it('sans capture active, rien ne se passe et rien ne lève', () => {
    expect(() => pauseCaptureSession()).not.toThrow();
    expect(() => resumeCaptureSession()).not.toThrow();
    expect(isCapturePaused()).toBe(false);
  });

  /**
   * La séance reste OUVERTE : une pause n'est pas un abandon, et le pilote
   * doit pouvoir déjeuner sans que sa matinée soit clôturée.
   */
  it('une séance en pause peut encore être terminée normalement', async () => {
    await startCaptureSession(START);
    ctrl().onData!(raceBoxFrame({ speed: 100, gx: 0.3, gy: -0.4 }));
    pauseCaptureSession();
    const res = await stopCaptureSession();
    expect(res.ok).toBe(true);
    expect(res.sessionId).toBeDefined();
  });
});
