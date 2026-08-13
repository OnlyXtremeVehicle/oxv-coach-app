/**
 * Service de capture de session (P0 — write path Valence).
 *
 * Orchestre la PREMIÈRE récupération de données réelle, de bout en bout :
 *   1. crée une ligne telemetry_sessions (status 'recording') ;
 *   2. s'abonne au flux BLE (bluetoothService.onData), bufferise les trames,
 *      et les INSÈRE par paquets dans telemetry_frames ;
 *   3. lance la détection de tours (lapDetectionRunner → useSessionStore) et la
 *      capture .ubx locale (captureMode) comme filet de sécurité ;
 *   4. à l'arrêt : flush final (attend un flush en vol puis draine), persiste
 *      les tours dans `laps`, calcule les agrégats, passe la session en
 *      'completed', upload le .ubx.
 *
 * Les maxima PAR TOUR (`laps.max_g_lateral`, `max_g_braking`, `max_g_accel`,
 * `max_speed_kmh`, `avg_speed_kmh`) sont accumulés ICI, pendant la capture : ils
 * ne sont dérivables nulle part ailleurs, et sans eux la fluidité du bilan se
 * calculait sur des zéros (cf. `accumulateLapMaxima` et captureFrameMapping).
 *
 * Le mapping trame→ligne est isolé et testé (captureFrameMapping). Ici on ne
 * fait que l'orchestration réseau/état.
 *
 * Doctrine « silence en piste » : ce service n'affiche rien. La capture tourne
 * tant que l'app est au premier plan (V1 ; BLE arrière-plan = entitlements à
 * venir).
 *
 * `elapsed_ms` dérive de l'horloge murale et est rendu STRICTEMENT CROISSANT
 * par session (`nextElapsedMs`) : ce n'est pas un confort d'ordonnancement,
 * c'est la CONDITION de la clé d'idempotence des trames — UNIQUE (session_id,
 * elapsed_ms) côté base + UPSERT ON CONFLICT DO NOTHING côté file de synchro.
 * Une suite seulement MONOTONE (ex æquo possibles) ferait jeter en silence des
 * trames réelles distinctes. Toute modification de la génération d'`elapsed_ms`
 * doit préserver la stricte croissance, sous peine de perte de données.
 * `itow_ms` est stocké sur chaque trame : c'est l'IDENTITÉ PHYSIQUE de la trame
 * (temps du boîtier), utilisée pour réconcilier un réimport .ubx avec les
 * trames déjà captées en live (cf. `reimportUbxToFrames`).
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { bluetoothService, type ReconnectState } from '@/ble/bluetoothService';
import { startCapture, stopCapture } from '@/ble/captureMode';
import { startPilotLiveRelay, stopPilotLiveRelay } from '@/services/liveRelayRunner';
import {
  startBiometryCapture,
  stopBiometryCapture,
  discardBiometryCapture,
} from '@/services/biometryCaptureRunner';
import {
  type RecordedLap,
  getCurrentLapNumber,
  getDistanceTotaleM,
  getRecordedLaps,
  startLapDetection,
  stopLapDetection,
} from '@/ble/lapDetectionRunner';
import { supabase } from '@/lib/supabase';
import { forgetPendingIntention, peekPendingIntentionId } from '@/services/intentionsService';
import { useSessionStore } from '@/store/useSessionStore';
import type { RaceBoxData } from '@/types/telemetry';

import {
  EMPTY_LAP_MAXIMA,
  EMPTY_MAXIMA,
  type LapMaxima,
  type SessionMaxima,
  type TelemetryFrameInsert,
  lapMaximaToColumns,
  nextElapsedMs,
  raceBoxToFrameInsert,
  updateLapMaxima,
  updateMaxima,
} from './captureFrameMapping';
import {
  type CaptureSessionRow,
  type LapInsert,
  enqueue,
  newUuid,
  processQueue,
} from './captureSyncQueue';

/** Ligne d'arrivée passée à la détection de tours. Sans cap → mode rayon. */
export interface CaptureFinishLineInput {
  lat: number;
  lon: number;
  /** Mode rayon : rayon du disque. Mode porte : demi-largeur de la porte. */
  radiusM?: number;
  /** Cap de la piste au franchissement (degrés). Fourni → détection par PORTE. */
  headingDeg?: number | null;
  /**
   * Distance minimale (m) entre deux tours comptés. Écarte les tours fabriqués
   * par un véhicule immobile sur la ligne (dérive GPS). Absente → aucune garde.
   */
  minLapDistanceM?: number;
}

/**
 * Repli de DERNIER recours si l'appelant ne fournit pas la ligne d'arrivée du
 * circuit. Ces coordonnées ne correspondent à aucun circuit réel : si on retombe
 * dessus, les tours ne seront PAS comptés. Le flux normal passe `input.finishLine`
 * (cf. `placement.tsx` + `captureFinishLineFor`). Sans cap → mode rayon historique.
 */
export const BELTOISE_FINISH: CaptureFinishLineInput = { lat: 45.6004, lon: -0.141, radiusM: 40 };

const FLUSH_EVERY_FRAMES = 50;
const FLUSH_INTERVAL_MS = 4_000;

/**
 * Plafond du buffer en mémoire, au-delà duquel le surplus part sur disque.
 *
 * 1 500 trames — une minute à 25 Hz. Assez large pour absorber une salve
 * d'écritures lentes sans toucher au régime nominal (le flush part à 50), assez
 * étroit pour qu'un réseau muet ne fasse pas croître le tableau indéfiniment.
 *
 * Sans ce plafond, une séance de vingt minutes sur un réseau en échec accumule
 * trente mille objets en mémoire vive, et l'application finit tuée par le
 * système — en emportant ce qui n'avait pas encore été écrit sur disque.
 */
const BUFFER_MAX_FRAMES = 1_500;

/**
 * Stratégie écran v1 (Valencia §4.4) : PREMIER PLAN ASSUMÉ. La capture BLE tourne
 * au premier plan ; pour survivre à un relais de 20 min sans que l'auto-verrouillage
 * coupe la radio, on maintient l'écran allumé pendant toute la capture (activé à
 * l'armement, libéré à l'arrêt). `app.json` est mis en cohérence : pas de mode
 * arrière-plan BLE revendiqué (le keep-awake couvre le besoin ; l'arrière-plan BLE
 * = entitlements à venir). Le tag isole notre verrou des autres usages.
 */
const KEEP_AWAKE_TAG = 'oxv-capture';

/** Maintient l'écran allumé pendant la capture (best-effort, jamais bloquant). */
function armKeepAwake(): void {
  void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e) =>
    console.warn('[OXV][capture] keep-awake KO :', e instanceof Error ? e.message : e)
  );
}

/** Libère le verrou d'écran (idempotent : une libération sans verrou est ignorée). */
function releaseKeepAwake(): void {
  try {
    deactivateKeepAwake(KEEP_AWAKE_TAG);
  } catch {
    /* pas de verrou actif — sans effet */
  }
}

/**
 * Délai d'interruption CONTINUE (lien non rétabli) au-delà duquel la séance est
 * considérée abandonnée et clôturée proprement — même chemin qu'un arrêt pilote.
 *
 * En deçà de ce seuil, la reconnexion illimitée (côté BLE) garde la session
 * OUVERTE : une coupure de piste (stands, tunnel radio, boîtier qui redémarre)
 * ne tue plus la capture. 15 min couvre largement ces décrochages sans laisser
 * une capture morte tourner indéfiniment. Seuls le pilote (stop/abort) ou ce
 * timeout long peuvent clôturer une séance.
 */
const LONG_INTERRUPT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * État de la capture vis-à-vis du lien BLE, distinct du statut Supabase de la
 * session. Permet à l'UI de capture de ne JAMAIS laisser croire qu'on enregistre
 * alors que le boîtier a décroché :
 *
 *   - `recording`   : lien stable, trames en arrivée.
 *   - `interrupted` : lien tombé, reconnexion ILLIMITÉE en cours (capture en
 *                     pause, session TOUJOURS ouverte, trou horodaté).
 *   - `lost`        : abandon prolongé (timeout long dépassé) ou repli défensif —
 *                     capture finalisée proprement.
 *   - `idle`        : aucune capture active.
 */
export type CaptureLinkStatus = 'idle' | 'recording' | 'interrupted' | 'lost' | 'muet';

/**
 * Délai au-delà duquel une capture qui n'a reçu AUCUNE trame se déclare muette.
 *
 * ── POURQUOI CET ÉTAT EXISTE (posé le 13/08/2026, après le premier essai) ────
 *
 * La garde d'armement lit `bluetoothService.getStatus()`. Or `connect()` pose
 * 'connected' juste après avoir APPELÉ `monitorCharacteristicForService`, qui
 * rend la main immédiatement : si l'abonnement aux notifications échoue,
 * l'erreur arrive plus tard dans le callback et ne fait qu'un `emitError` — le
 * statut RESTE 'connected'.
 *
 * **La garde prouvait la CONNEXION, jamais le FLUX.** Et rien, pendant la
 * capture, ne vérifiait qu'une seule trame était arrivée : `setLinkStatus`
 * était posé à 'recording' inconditionnellement, le voyant REC pulsait en
 * rouge, et une séance parfaitement muette ressemblait trait pour trait à une
 * séance qui enregistre.
 *
 * La nuit du 12 au 13/08, le fondateur a roulé une séance entière et l'a
 * découverte vide au retour : zéro trame en base. Il n'avait eu aucun moyen de
 * le savoir avant de descendre de voiture.
 *
 * Douze secondes : un RaceBox émet à 25 Hz, et même un fix GPS difficile
 * n'interrompt pas le flux de trames (le filtre `Fix3D` ne s'applique qu'à la
 * détection de tours, pas à l'écriture). Au-delà de douze secondes sans une
 * seule trame, il ne se passe rien — et il faut le dire.
 *
 * SILENCE EN PISTE : ce n'est pas un HUD. C'est le même canal sobre que
 * « lien interrompu », sur l'écran qui ne montre déjà rien d'autre. Une app qui
 * affiche REC sur du vide n'est pas silencieuse, elle est mensongère.
 */
const MUET_APRES_MS = 12_000;

type CaptureLinkListener = (status: CaptureLinkStatus) => void;

let linkStatus: CaptureLinkStatus = 'idle';
const linkListeners: CaptureLinkListener[] = [];

/**
 * S'abonne au statut de lien de la capture (recording/interrupted/lost/idle).
 * Émet l'état courant à l'abonnement. Rendu disponible pour l'écran de capture.
 */
export function onCaptureLinkStatus(listener: CaptureLinkListener): () => void {
  linkListeners.push(listener);
  listener(linkStatus);
  return () => {
    const i = linkListeners.indexOf(listener);
    if (i >= 0) linkListeners.splice(i, 1);
  };
}

export function getCaptureLinkStatus(): CaptureLinkStatus {
  return linkStatus;
}

function setLinkStatus(next: CaptureLinkStatus): void {
  if (linkStatus === next) return;
  linkStatus = next;
  for (const l of linkListeners) l(next);
}

interface CaptureState {
  sessionId: string;
  userId: string;
  circuitId: string | null;
  circuitName: string | null;
  vehicleId: string | null;
  startMs: number;
  buffer: TelemetryFrameInsert[];
  total: number;
  /**
   * Trames émises dont l'insertion DIRECTE a échoué et qui ont été REQUEUÉES sur
   * fichier (op `frames`) pour resynchronisation. Ni perdues, ni encore
   * confirmées en base : elles seront insérées au prochain drain.
   */
  requeued: number;
  lastElapsed: number;
  maxima: SessionMaxima;
  /**
   * Maxima RÉELLEMENT mesurés, par numéro de tour chronométré (clé ≥ 1). Un tour
   * ABSENT de cette map n'a reçu aucune trame : ses colonnes resteront `null`.
   * Jamais de valeur par défaut ici — c'est la donnée, ou rien.
   */
  lapMaxima: Map<number, LapMaxima>;
  /** Accumulateur du tour EN COURS, figé au changement de tour et à l'arrêt. */
  currentLapMaxima: LapMaxima;
  /**
   * Numéro de tour vu à la trame précédente (0 = outlap). Son changement est le
   * SIGNAL de clôture du tour précédent (cf. `getCurrentLapNumber`).
   */
  currentLapNumber: number;
  unsubData: () => void;
  /** Désabonnement du suivi de reconnexion BLE (interruption/lost). */
  unsubReconnect: () => void;
  /**
   * Désabonnement du suivi de STATUT BLE.
   *
   * La capture n'observait QUE la phase de reconnexion. Or
   * `handleUnexpectedDisconnection` a une sortie MUETTE : sans cible de
   * reconnexion connue, elle émet 'disconnected' et retourne sans jamais poser
   * la phase 'reconnecting'. Aucun évènement n'atteignait donc la capture, le
   * voyant REC continuait de pulser, et plus une seule trame n'arrivait —
   * jusqu'à la fin des temps, le timeout long n'étant armé que par la phase.
   */
  unsubStatus: () => void;
  /** Désabonnement du suivi d'état d'application (premier plan / arrière-plan). */
  unsubAppState: () => void;
  timer: ReturnType<typeof setInterval> | null;
  flushing: boolean;
  flushPromise: Promise<void> | null;
  /**
   * Timer d'interruption LONGUE : armé quand la capture passe `interrupted`,
   * annulé à la reprise / à l'arrêt / à l'abandon. S'il expire, la séance est
   * clôturée pour abandon prolongé (cf. LONG_INTERRUPT_TIMEOUT_MS).
   */
  interruptTimer: ReturnType<typeof setTimeout> | null;
  /**
   * Veille du SILENCE : bascule la capture en `muet` si aucune trame n'est
   * arrivée depuis `MUET_APRES_MS`. Désarmée à la première trame reçue, et
   * réarmée à chaque trame — c'est un chien de garde, pas un compte à rebours.
   */
  muetTimer: ReturnType<typeof setTimeout> | null;
  /**
   * Timestamp (ms) du début du trou de liaison courant, ou `null` si le lien
   * n'est pas interrompu. Sert à tracer la durée du trou à la reprise.
   */
  gapStartMs: number | null;
}

let current: CaptureState | null = null;

export function isCaptureSessionActive(): boolean {
  return current !== null;
}

export interface StartCaptureInput {
  userId: string;
  circuitId?: string | null;
  circuitName?: string | null;
  vehicleId?: string | null;
  finishLine?: CaptureFinishLineInput;
}

export interface StartCaptureResult {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Crée la session et démarre l'enregistrement (frames + tours + .ubx).
 *
 * LOCAL-FIRST (P0 Valence) : l'`id` de session est généré côté client et la
 * création de la ligne serveur est PERSISTÉE dans la file de synchro
 * (captureSyncQueue) plutôt qu'attendue en ligne. L'enregistrement démarre
 * IMMÉDIATEMENT ; le drain part en arrière-plan (insert immédiat si réseau,
 * sinon rejeu ultérieur). Ne retourne JAMAIS d'échec pour cause d'absence de
 * réseau — le pilote n'est jamais bloqué avant la piste.
 */
export async function startCaptureSession(input: StartCaptureInput): Promise<StartCaptureResult> {
  if (current) return { ok: false, error: 'Une capture est déjà active.' };

  const sessionId = newUuid();
  const startMs = Date.now();

  const circuitId = input.circuitId ?? null;
  const circuitName = input.circuitName ?? 'Circuit';
  const vehicleId = input.vehicleId ?? null;

  // Persiste la création de session sur la file (survivante hors-ligne). On ne
  // laisse PAS une panne disque bloquer la piste : le .ubx local reste le filet.
  const createRow: CaptureSessionRow = {
    id: sessionId,
    user_id: input.userId,
    status: 'recording',
    started_at: new Date(startMs).toISOString(),
    circuit_id: circuitId,
    circuit_name: circuitName,
    vehicle_id: vehicleId,
  };
  try {
    await enqueue({ type: 'create_session', sessionId, row: createRow });
  } catch (e) {
    console.warn(
      '[OXV][capture] persistance de la création de session KO (on démarre quand même) :',
      e instanceof Error ? e.message : e
    );
  }

  // Rattache l'intention posée en préparation (V9) à cette séance — par la FILE,
  // comme tout le write-path. L'id est lu LOCALEMENT (aucun réseau : un SELECT
  // ici échouerait précisément en mode avion, cas nominal Valence), et l'op est
  // enfilée APRÈS le create_session : le FIFO garantit que la séance existe
  // quand l'UPDATE part (FK + RLS with check satisfaites), et le rattachement
  // est rejoué au retour du réseau au lieu d'être perdu.
  //
  // L'ORDRE D'ENQUEUE EST LA GARANTIE PORTEUSE, il est verrouillé par un test.
  //
  // Best-effort : l'intention est facultative et ne doit jamais retarder la
  // capture ni la faire échouer.
  const intentionId = peekPendingIntentionId();
  if (intentionId) {
    try {
      await enqueue({ type: 'attach_intention', sessionId, intentionId });
      // Marqueur PURGÉ dès l'enfilement : c'est ce point (et non la mise en file)
      // qui empêche la séance SUIVANTE d'hériter de cette intention si le
      // rattachement dort encore dans la file, hors-ligne.
      forgetPendingIntention();
    } catch (e) {
      // Non enfilée : on GARDE le marqueur local (la prochaine capture rattachera,
      // dans la fenêtre de fraîcheur). Ne jamais bloquer la piste pour ça.
      console.warn(
        "[OXV][capture] enqueue rattachement d'intention KO :",
        e instanceof Error ? e.message : e
      );
    }
  }

  // Draine en arrière-plan : si réseau, l'insert part tout de suite ; sinon il
  // attend dans la file. Best-effort, jamais bloquant.
  void processQueue().catch(() => undefined);

  const finish = input.finishLine ?? BELTOISE_FINISH;
  if (!input.finishLine) {
    console.warn(
      "[OXV] startCaptureSession sans ligne d'arrivée du circuit — repli par défaut ; " +
        'les tours risquent de ne pas être détectés. Passer circuit.finishLine.'
    );
  }

  const state: CaptureState = {
    sessionId,
    userId: input.userId,
    circuitId,
    circuitName,
    vehicleId,
    startMs,
    buffer: [],
    total: 0,
    requeued: 0,
    lastElapsed: 0,
    maxima: { ...EMPTY_MAXIMA },
    lapMaxima: new Map(),
    currentLapMaxima: { ...EMPTY_LAP_MAXIMA },
    currentLapNumber: 0,
    unsubData: () => undefined,
    unsubReconnect: () => undefined,
    unsubStatus: () => undefined,
    unsubAppState: () => undefined,
    timer: null,
    flushing: false,
    flushPromise: null,
    interruptTimer: null,
    muetTimer: null,
    gapStartMs: null,
  };
  current = state;
  setLinkStatus('recording');
  // Le chien de garde part AVEC la capture : si la première trame n'arrive
  // jamais, c'est lui qui le dira. Sans lui, « connecté » et « qui émet » sont
  // indiscernables à l'écran — c'est ce qui a coûté la séance du 13/08.
  armerVeilleSilence(state);

  // Filet de sécurité : capture .ubx brute locale (jamais bloquant).
  try {
    startCapture();
  } catch {
    /* capture locale indisponible — les frames partent quand même en DB */
  }

  // Détection de tours (compteurs live dans le store + enregistrement détaillé).
  //
  // L'ORDRE EST PORTEUR : ce runner s'abonne au flux BLE AVANT nous (cf.
  // `state.unsubData` plus bas), donc pour une trame donnée il a déjà arbitré le
  // franchissement de ligne quand notre `onData` lit `getCurrentLapNumber()`.
  // C'est ce qui permet de rattacher chaque trame au bon tour sans redétecter.
  //
  // Le CAP commande le MODE : fourni → porte (segment perpendiculaire, seul moyen
  // d'exclure une voie des stands parallèle) ; absent → rayon historique.
  startLapDetection({
    finishLineLat: finish.lat,
    finishLineLon: finish.lon,
    finishLineRadiusM: finish.radiusM,
    finishLineHeadingDeg: finish.headingDeg,
    minLapDistanceM: finish.minLapDistanceM,
  });

  // État de session partagé (compteurs live).
  useSessionStore.getState().startSession({
    id: sessionId,
    userId: input.userId,
    startedAt: new Date(startMs),
    endedAt: null,
    circuitId: input.circuitId ?? null,
    vehicleId: input.vehicleId ?? null,
  });

  // Flux de trames → buffer → flush par paquets.
  state.unsubData = bluetoothService.onData((frame: RaceBoxData) => {
    if (current !== state) return;
    // elapsed STRICTEMENT croissant : `elapsed_ms` est la CLÉ D'IDEMPOTENCE des
    // trames (UNIQUE (session_id, elapsed_ms)). Un simple `Math.max` avec
    // `lastElapsed` (monotone NON strict) laisserait deux trames RÉELLES émises
    // dans la même ms partager une clé — l'UPSERT DO NOTHING en jetterait une
    // en silence. Cf. `nextElapsedMs` pour l'arbitrage complet.
    // Une trame est arrivée : le lien ÉMET. On réarme la veille et, si l'écran
    // affichait « aucune donnée », on le corrige — un boîtier qui repart après
    // douze secondes de silence doit reprendre la main sur le message.
    armerVeilleSilence(state);
    if (linkStatus === 'muet') setLinkStatus('recording');

    const elapsed = nextElapsedMs(Date.now(), state.startMs, state.lastElapsed);
    state.lastElapsed = elapsed;
    state.buffer.push(raceBoxToFrameInsert(frame, sessionId, elapsed));
    state.maxima = updateMaxima(state.maxima, frame);
    accumulateLapMaxima(state, frame);

    /**
     * LE BUFFER EST BORNÉ — et son débordement va sur DISQUE, jamais à la
     * poubelle.
     *
     * Le producteur émet à 25 Hz sans jamais attendre. Le consommateur est une
     * écriture réseau. Sur une 4G qui tousse, chaque `flush` échoue, requeue son
     * lot, et pendant ce temps le tableau continue de croître : une séance de
     * vingt minutes accumule trente mille objets en mémoire vive, et
     * l'application finit par être tuée par le système — en emportant tout ce
     * qui n'a pas encore été écrit sur disque.
     *
     * Au-delà du plafond, on DRAINE vers la file de synchro (fichier), qui est
     * durable et rejouable. On ne jette rien : c'est le principe même du
     * local-first de ce service.
     */
    if (state.buffer.length >= BUFFER_MAX_FRAMES) {
      const surplus = state.buffer.splice(0, state.buffer.length - FLUSH_EVERY_FRAMES);
      void enqueue({ type: 'frames', sessionId: state.sessionId, batch: surplus })
        .then(() => {
          state.requeued += surplus.length;
        })
        .catch((e) =>
          console.warn(
            '[OXV][capture] débordement de buffer non persisté (filet .ubx) :',
            e instanceof Error ? e.message : e
          )
        );
    }

    if (state.buffer.length >= FLUSH_EVERY_FRAMES) void flush(state);
  });
  state.timer = setInterval(() => void flush(state), FLUSH_INTERVAL_MS);

  // La capture est ARMÉE : reconnexion BLE ILLIMITÉE tant qu'on enregistre. Une
  // coupure ne tue plus la séance — elle est mise en pause, le trou horodaté, et
  // seul le pilote (stop/abort) ou le timeout long peut clôturer.
  bluetoothService.setUnlimitedReconnect(true);
  armKeepAwake();

  // Suit la reconnexion BLE pour ne jamais compter contre un lien mort en
  // silence : on met la capture en pause pendant les tentatives, on reprend à
  // la reconnexion (trou horodaté), et on ne finalise que sur abandon prolongé.
  state.unsubReconnect = bluetoothService.onReconnectChange((rc: ReconnectState) => {
    if (current !== state) return;
    handleReconnect(state, rc);
  });

  /**
   * LE STATUT BLE, ET PAS SEULEMENT LA PHASE DE RECONNEXION.
   *
   * Une coupure qui ne fait pas changer la PHASE était invisible pour la
   * capture : `handleUnexpectedDisconnection` sort en silence quand aucune
   * cible de reconnexion n'est connue — ce qui arrive après tout `disconnect()`
   * explicite, ou après « continuer sans équipement ». Le lien tombait, le
   * voyant REC restait rouge, et rien n'arrivait plus jamais.
   *
   * On traite donc 'disconnected' et 'error' comme une INTERRUPTION : même
   * chemin que la phase de reconnexion — pause, trou horodaté, timeout long
   * armé. Le pilote voit enfin ce qui se passe, et la séance finit par se
   * clore au lieu de rester ouverte indéfiniment.
   */
  state.unsubStatus = bluetoothService.onStatusChange((statut) => {
    if (current !== state) return;
    if (statut !== 'disconnected' && statut !== 'error') return;
    if (linkStatus === 'interrupted' || linkStatus === 'lost') return;
    setLinkStatus('interrupted');
    useSessionStore.getState().pauseSession();
    state.gapStartMs = Date.now();
    startInterruptTimeout(state);
  });

  /**
   * L'ARRIÈRE-PLAN SE VOIT, MÊME SI ON NE PEUT PAS L'EMPÊCHER.
   *
   * L'application ne revendique aucun mode BLE en arrière-plan, et le
   * keep-awake est best-effort — son échec n'est qu'un `console.warn`. Si iOS
   * suspend l'application (bouton latéral, appel entrant), le fil JS gèle :
   * plus de notification BLE, plus de timer de flush, plus rien. Au retour,
   * `current` est toujours là, la séance toujours 'recording', REC pulse à
   * nouveau — et le trou n'est ni horodaté ni dit.
   *
   * On ne prétend pas capturer en arrière-plan. On CONSTATE le trou, on
   * l'horodate comme n'importe quelle interruption, et le bilan pourra le
   * dire. Une lacune connue vaut infiniment mieux qu'une lacune invisible.
   */
  state.unsubAppState = ecouterArrierePlan(state);

  // Relais LIVE vers le coach — UNIQUEMENT si le pilote a activé le « partage en
  // direct » (garde-fou dans le runner). Best-effort, non bloquant, MUET côté
  // pilote (silence en piste : aucun HUD). N'affecte jamais la capture locale.
  void startPilotLiveRelay({
    sessionId,
    pilotId: input.userId,
    circuit: input.circuitName ?? null,
  }).catch(() => undefined);

  // Capture cardio LOCALE (BIO-2, dégel cardinal ciblé) — dormante tant que le
  // flag `biometry` ou le consentement de capture manque. Best-effort, non
  // bloquant, offline-first, n'affecte jamais la capture télémétrique.
  void startBiometryCapture({ sessionId, pilotId: input.userId }).catch(() => undefined);

  return { ok: true, sessionId };
}

/**
 * Réagit aux phases de reconnexion BLE pendant une capture active.
 *
 *   - `reconnecting` : lien tombé → capture « interrompue », compteurs live en
 *     pause (les trames ne tombent plus, on ne fige pas l'UI en « enregistre »).
 *     On HORODATE le début du trou et on arme le TIMEOUT LONG. La session reste
 *     OUVERTE : la reconnexion illimitée retente sans fin en arrière-plan.
 *   - `idle` revenant alors qu'on était interrompu → lien rétabli : on reprend,
 *     on annule le timeout long et on trace la durée du trou.
 *   - `lost` : ne devrait plus survenir en capture (mode illimité). Garde
 *     DÉFENSIVE — si ça arrive quand même (plus de device cible), on finalise
 *     proprement en dernier recours plutôt que rester figé.
 */
function handleReconnect(state: CaptureState, rc: ReconnectState): void {
  if (rc.phase === 'reconnecting') {
    if (linkStatus !== 'interrupted') {
      setLinkStatus('interrupted');
      useSessionStore.getState().pauseSession();
      // Début du trou de liaison : on l'horodate pour en tracer la durée à la
      // reprise, et on arme le timeout long (seule clôture non-pilote tolérée).
      state.gapStartMs = Date.now();
      startInterruptTimeout(state);
    }
  } else if (rc.phase === 'idle') {
    if (linkStatus === 'interrupted') {
      setLinkStatus('recording');
      useSessionStore.getState().resumeSession();
      clearInterruptTimeout(state);
      logLinkGap(state);
    }
  } else if (rc.phase === 'lost') {
    // Repli défensif : le mode illimité empêche normalement 'lost' en capture.
    setLinkStatus('lost');
    clearInterruptTimeout(state);
    void finalizeOnLostLink();
  }
}

/**
 * Arme le TIMEOUT LONG d'interruption : au-delà de LONG_INTERRUPT_TIMEOUT_MS
 * sans reprise du lien, la séance est clôturée proprement (abandon prolongé),
 * équivalent à une clôture pilote. Idempotent : ne relance pas un timer déjà armé.
 */
function startInterruptTimeout(state: CaptureState): void {
  if (state.interruptTimer) return;
  state.interruptTimer = setTimeout(() => {
    state.interruptTimer = null;
    // Une capture différente (ou aucune) est active : rien à finaliser ici.
    if (current !== state) return;
    console.warn(
      `[OXV][capture] interruption prolongée (> ${Math.round(
        LONG_INTERRUPT_TIMEOUT_MS / 60000
      )} min) — clôture de la séance pour abandon.`
    );
    // Coupe la reconnexion illimitée AVANT de finaliser : plus de device à
    // rejoindre, on arrête de solliciter la radio.
    bluetoothService.setUnlimitedReconnect(false);
    releaseKeepAwake();
    void finalizeOnLostLink();
  }, LONG_INTERRUPT_TIMEOUT_MS);
}

/**
 * Observe le passage en arrière-plan pendant une capture.
 *
 * Rend une fonction de désabonnement. Best-effort : si `AppState` n'est pas
 * disponible, on ne fait rien plutôt que d'empêcher la capture de démarrer.
 */
function ecouterArrierePlan(state: CaptureState): () => void {
  try {
    /**
     * `require` PARESSEUX, et non un `import` en tête de fichier.
     *
     * Ce service est chargé par des tests en environnement `node`, où un
     * `import` de `react-native` tire tout l'index du paquet — que Jest ne sait
     * pas transformer (`Cannot use import statement outside a module`). Le
     * résoudre à l'appel garde ce service testable sans banc React Native, et
     * c'est le motif que `biometryCaptureRunner` emploie déjà pour la même
     * raison.
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require('react-native') as typeof import('react-native');
    const sub = AppState.addEventListener('change', (etat) => {
      if (current !== state) return;
      if (etat === 'background' || etat === 'inactive') {
        if (linkStatus === 'interrupted' || linkStatus === 'lost') return;
        console.warn('[OXV][capture] application en arrière-plan — le flux BLE va se taire.');
        setLinkStatus('interrupted');
        useSessionStore.getState().pauseSession();
        state.gapStartMs = Date.now();
        startInterruptTimeout(state);
        return;
      }
      if (etat === 'active' && linkStatus === 'interrupted') {
        // Le retour au premier plan ne garantit pas que le boîtier réémet : on
        // laisse la première trame reçue rétablir 'recording' (cf. `onData`),
        // et on se contente de clore le trou et de relancer la veille.
        clearInterruptTimeout(state);
        logLinkGap(state);
        armerVeilleSilence(state);
      }
    });
    return () => sub.remove();
  } catch (e) {
    console.warn(
      '[OXV][capture] écoute de l’état d’application indisponible :',
      e instanceof Error ? e.message : e
    );
    return () => undefined;
  }
}

/**
 * (Ré)arme la veille du silence. Appelée au démarrage puis à CHAQUE trame :
 * tant que le flux vient, l'échéance recule et rien ne s'affiche.
 *
 * Ne touche PAS à `interrupted` ni à `lost` : une coupure de lien a déjà son
 * message, plus précis, et le remplacer par « aucune donnée » ferait perdre au
 * pilote l'information que la reconnexion est en cours.
 */
function armerVeilleSilence(state: CaptureState): void {
  if (state.muetTimer) clearTimeout(state.muetTimer);
  state.muetTimer = setTimeout(() => {
    state.muetTimer = null;
    if (current !== state) return;
    if (linkStatus === 'interrupted' || linkStatus === 'lost') return;
    console.warn(
      `[OXV][capture] aucune trame depuis ${MUET_APRES_MS} ms — le boîtier est connecté mais n'émet pas.`
    );
    setLinkStatus('muet');
  }, MUET_APRES_MS);
}

/** Désarme la veille du silence (arrêt, abandon, clôture). */
function desarmerVeilleSilence(state: CaptureState): void {
  if (state.muetTimer) {
    clearTimeout(state.muetTimer);
    state.muetTimer = null;
  }
}

/** Annule le timeout long d'interruption s'il est armé (reprise / arrêt / abandon). */
function clearInterruptTimeout(state: CaptureState): void {
  if (state.interruptTimer) {
    clearTimeout(state.interruptTimer);
    state.interruptTimer = null;
  }
}

/**
 * Trace FACTUELLE du trou de liaison à la reprise (durée en ms). Console
 * uniquement : pas d'écran, pas de HUD, pas de son (silence en piste). Les
 * trames ne sont pas insérées pendant le trou ; cette trace le rend exploitable.
 */
function logLinkGap(state: CaptureState): void {
  if (state.gapStartMs == null) return;
  const durationMs = Date.now() - state.gapStartMs;
  console.warn(`[OXV][capture] trou de liaison ${durationMs} ms`);
  // LOT 21e — LA SEULE LIGNE AJOUTÉE À CE SERVICE, ET ELLE NE CHANGE RIEN À LA
  // CAPTURE.
  //
  // La durée était calculée puis JETÉE dans la console. La restitution que le
  // plan attend au retour — durée du trou, part du tour de référence — n'avait
  // donc aucune source de données. On cesse de la jeter ; on ne mesure rien de
  // neuf, on ne décide rien de neuf, et la clôture pour lien perdu reste ce
  // qu'elle était : quinze minutes d'interruption continue.
  //
  // SILENCE EN PISTE : c'est un relevé, pas un signal. Rien ne s'affiche
  // pendant le roulage.
  useSessionStore.getState().addLinkGap({
    dureeMs: durationMs,
    repriseIso: new Date().toISOString(),
  });
  state.gapStartMs = null;
}

/**
 * Finalise la capture après une perte définitive de liaison : réutilise le
 * chemin d'arrêt normal (flush final, persistance tours, agrégats, status
 * 'completed', upload .ubx), puis garde le statut de lien sur `lost` pour que
 * l'UI affiche un terminal clair (et non un faux « en enregistrement »).
 */
async function finalizeOnLostLink(): Promise<void> {
  const mine = current;
  if (!mine) return;
  try {
    await stopCaptureSession();
  } catch (e) {
    console.warn(
      '[OXV][capture] finalisation après liaison perdue KO :',
      e instanceof Error ? e.message : e
    );
  }
  // GARDE DE GÉNÉRATION — même idiome que `onData`, `onReconnectChange` et le
  // timer d'interruption. `stopCaptureSession` remet `current` à null dès son
  // ENTRÉE (avant son premier await) : une capture SUIVANTE peut donc démarrer
  // pendant le drain, et elle a alors armé SON keep-awake, SA reconnexion
  // illimitée et SON statut. Les trois cibles ci-dessous sont GLOBALES — les
  // appliquer sans re-vérifier désarmerait la séance d'un autre : reconnexion
  // ramenée en mode borné (une coupure BLE la clôturerait au lieu de reprendre),
  // verrou d'écran relâché (l'auto-verrouillage coupe la radio, séance perdue),
  // et « liaison perdue » affiché sur une séance qui enregistre.
  //
  // Le chemin terminal ne concerne QUE la séance qu'on vient de clore : si une
  // autre a pris la main, on ne touche à rien. La garde couvre bien les TROIS
  // effets, `setLinkStatus('lost')` compris.
  if (current !== null) return;
  // Désarme la reconnexion illimitée : hors capture, on repasse en mode borné.
  // (stopCaptureSession le fait déjà ; explicite ici pour le chemin terminal.)
  bluetoothService.setUnlimitedReconnect(false);
  releaseKeepAwake();
  // stopCaptureSession remet le statut à 'idle' ; on rétablit 'lost' pour l'UI.
  setLinkStatus('lost');
}

/**
 * Draine le buffer dans telemetry_frames. Non réentrant : un appel concurrent
 * renvoie la promesse du flush en cours.
 *
 * DEUX RÉGIMES, et la distinction est essentielle :
 *
 *   - COURANT (`final = false`) : on ne traite que le BACKLOG PRÉSENT À L'ENTRÉE,
 *     par lots bornés à FLUSH_EVERY_FRAMES. Les trames arrivées PENDANT
 *     l'écriture attendent le prochain déclencheur (50 trames, ou le timer de
 *     4 s). Drainer aussi ces trames-là faisait courir la boucle après un
 *     producteur à 25 Hz : la taille de lot s'effondrait vers rate × RTT (≈ 4
 *     lignes en 4G, ≈ 1 en Wi-Fi paddock) au lieu de 50 — FLUSH_EVERY_FRAMES
 *     devenait un simple déclencheur inerte, et une séance de 20 min tirait des
 *     dizaines de milliers de requêtes d'une poignée de lignes (radio jamais en
 *     veille sous keep-awake, une transaction + un contrôle RLS PAR TRAME).
 *
 *   - FINAL (`final = true`, depuis `drain()` seulement) : on vide TOUT. C'est le
 *     seul cas qui l'exige — et il est sûr, car `drain()` n'est appelé qu'APRÈS
 *     `state.unsubData()` : plus aucune trame n'arrive, la boucle termine, et la
 *     propriété « un flush final attendu ne laisse aucune queue de session
 *     derrière lui » est préservée à l'identique.
 *
 * `remaining` (plutôt qu'un `break` sur un lot incomplet) laisse le timer de 4 s
 * écouler un buffer partiel — sinon 30 trames en attente ne partiraient jamais.
 */
function flush(state: CaptureState, final = false): Promise<void> {
  if (state.flushing) return state.flushPromise ?? Promise.resolve();
  state.flushing = true;
  state.flushPromise = (async () => {
    try {
      let remaining = final ? Infinity : state.buffer.length;
      while (state.buffer.length > 0 && remaining > 0) {
        const batch = state.buffer.splice(0, FLUSH_EVERY_FRAMES);
        remaining -= batch.length;
        try {
          const { error } = await supabase.from('telemetry_frames').insert(batch);
          if (error) throw error;
          state.total += batch.length;
        } catch (e) {
          // Insert direct KO (réseau, ou session pas encore créée côté serveur) :
          // on NE PERD PAS le lot. On le REQUEUE sur fichier (op `frames`) pour
          // rejeu ordonné après reprise réseau. `requeued` alimente le total émis.
          // Le drain (processQueue) le réinsèrera ; le .ubx local reste le filet.
          try {
            await enqueue({ type: 'frames', sessionId: state.sessionId, batch });
            state.requeued += batch.length;
          } catch (persistErr) {
            // Disque indisponible : dernier recours = .ubx local (déjà capturé).
            console.warn(
              '[OXV][capture] requeue lot frames KO (filet .ubx) :',
              persistErr instanceof Error ? persistErr.message : persistErr
            );
          }
        }
      }
    } finally {
      state.flushing = false;
    }
  })();
  return state.flushPromise;
}

/**
 * Attend la fin d'un flush éventuellement en vol, puis draine INTÉGRALEMENT ce
 * qui reste (flush FINAL). Appelé par `stopCaptureSession` APRÈS `unsubData()` et
 * `clearInterval` : plus aucune trame n'arrive et aucun flush courant ne peut
 * démarrer, la passe finale vide donc réellement le buffer.
 */
async function drain(state: CaptureState): Promise<void> {
  if (state.flushPromise) {
    try {
      await state.flushPromise;
    } catch {
      /* déjà loggé */
    }
  }
  await flush(state, true);
}

/**
 * Rattache une trame au tour qu'elle mesure et met à jour les maxima de ce tour.
 *
 * Les FRONTIÈRES de tour ne sont pas les nôtres : elles appartiennent au runner
 * de détection, abonné au même flux et AVANT nous — il a donc déjà traité cette
 * trame. On se contente donc de LIRE son numéro de tour en cours : un changement
 * depuis la trame précédente signifie « le tour précédent vient de se clore », et
 * rien d'autre. Aucune détection dupliquée, aucune responsabilité déplacée.
 *
 * L'accumulateur est figé AVANT d'agréger la trame courante : la trame qui porte
 * le franchissement ouvre le tour suivant, elle ne clôt pas le précédent. C'est
 * aussi ce qui écarte l'OUTLAP — ses trames s'accumulent sous le numéro 0, et le
 * premier passage de ligne les jette (`freezeCurrentLap` n'archive que les
 * numéros ≥ 1) au lieu de les attribuer au tour 1, dont elles ne sont pas.
 */
function accumulateLapMaxima(state: CaptureState, frame: RaceBoxData): void {
  const lapNumber = getCurrentLapNumber();
  if (lapNumber !== state.currentLapNumber) {
    freezeCurrentLap(state);
    state.currentLapNumber = lapNumber;
  }
  state.currentLapMaxima = updateLapMaxima(state.currentLapMaxima, frame);
}

/**
 * Archive les maxima du tour en cours et repart d'un accumulateur vierge.
 *
 * Le numéro 0 (outlap) n'est PAS archivé : ce n'est pas un tour chronométré.
 */
function freezeCurrentLap(state: CaptureState): void {
  if (state.currentLapNumber > 0) {
    state.lapMaxima.set(state.currentLapNumber, state.currentLapMaxima);
  }
  state.currentLapMaxima = { ...EMPTY_LAP_MAXIMA };
}

/**
 * Construit les lignes `laps` à partir des tours détectés (transformation pure).
 *
 * Les colonnes statistiques viennent des maxima accumulés PENDANT la capture, par
 * numéro de tour. Un tour absent de `lapMaxima` — aucune trame rattachée — garde
 * ses colonnes à `null` : la lecture les rendra « — ». On n'écrit JAMAIS 0 pour
 * une mesure qui n'a pas eu lieu ; c'est exactement le zéro fabriqué qui donnait
 * une fluidité de 100 sortie de nulle part.
 */
function buildLapRows(
  sessionId: string,
  laps: RecordedLap[],
  lapMaxima: ReadonlyMap<number, LapMaxima>
): LapInsert[] {
  if (laps.length === 0) return [];
  const bestMs = Math.min(...laps.map((l) => l.durationMs));
  return laps.map((l) => ({
    session_id: sessionId,
    lap_number: l.lapNumber,
    duration_seconds: l.durationMs / 1000,
    started_at: new Date(l.startedAtMs).toISOString(),
    ended_at: new Date(l.endedAtMs).toISOString(),
    start_lat: l.startLat,
    start_lon: l.startLon,
    end_lat: l.endLat,
    end_lon: l.endLon,
    is_best_lap: l.durationMs === bestMs,
    is_outlap: false,
    is_inlap: false,
    ...lapMaximaToColumns(lapMaxima.get(l.lapNumber)),
  }));
}

export interface StopCaptureResult {
  ok: boolean;
  sessionId?: string;
  ubxUri?: string | null;
  totalFrames?: number;
  droppedFrames?: number;
  error?: string;
}

/**
 * Arrête l'enregistrement : flush final, puis clôture REJOUABLE via la file de
 * synchro. Les tours, l'update `complete` et l'upload .ubx passent par la FILE
 * (enqueue) — jamais des appels directs perdus si hors-ligne. La session ne reste
 * donc JAMAIS en `recording` fantôme : soit `complete` part tout de suite
 * (réseau), soit il attend et sera rejoué. Retourne sessionId + ubxUri pour le bilan.
 */
export async function stopCaptureSession(): Promise<StopCaptureResult> {
  // Capture-and-null synchrone : un second appel concurrent court-circuite.
  const state = current;
  current = null;
  if (!state) return { ok: false, error: 'Aucune capture active.' };
  // Capture terminée : retour au statut de lien neutre (un arrêt sur liaison
  // perdue rétablira 'lost' après coup, cf. finalizeOnLostLink).
  setLinkStatus('idle');

  // 1. Stoppe l'arrivée de nouvelles trames + le timer + le suivi reconnexion,
  //    puis flush final complet (les lots en échec sont requeués sur fichier).
  state.unsubData();
  state.unsubReconnect();
  state.unsubStatus();
  state.unsubAppState();
  // Désarme la reconnexion illimitée + le timeout long : hors capture, on
  // repasse en mode borné (initBle / paddock) et aucun timer ne fuite.
  bluetoothService.setUnlimitedReconnect(false);
  releaseKeepAwake();
  clearInterruptTimeout(state);
  desarmerVeilleSilence(state);
  stopPilotLiveRelay(); // coupe le relais live (fin de capture / lien perdu)
  void stopBiometryCapture().catch(() => undefined); // préserve le cardio (offline-first)
  if (state.timer) clearInterval(state.timer);
  await drain(state);

  // 2. Arrête la détection de tours, relève compteurs + tours détaillés.
  //
  //    Le tour EN COURS ne se clôt pas par incrément mais par l'arrêt : on fige
  //    son accumulateur ici, sinon ses mesures resteraient en l'air. C'est sûr —
  //    `unsubData()` est déjà passé, plus aucune trame ne peut l'alimenter. Le
  //    cas réel : le franchissement final atteint le runner (encore abonné) mais
  //    plus nous ; le tour est alors ENREGISTRÉ, et sans ce gel il partirait avec
  //    des colonnes vides alors qu'il a bien été mesuré.
  freezeCurrentLap(state);
  // La distance se relève AVANT `stopLapDetection`, qui détruit l'état du
  // détecteur. Une seconde d'inattention ici et la colonne resterait `null`
  // comme elle l'a été depuis toujours.
  const distanceM = getDistanceTotaleM();
  stopLapDetection();
  const recordedLaps = getRecordedLaps();
  const store = useSessionStore.getState();
  const lapCount = store.lapCount;
  const bestLapSeconds = store.bestLapMs != null ? store.bestLapMs / 1000 : null;
  store.endSession();

  // 3. Ferme la capture .ubx locale (filet de sécurité).
  let ubxUri: string | null = null;
  try {
    ubxUri = await stopCapture();
  } catch {
    ubxUri = null;
  }

  const { sessionId, userId, total, requeued } = state;
  // Total ÉMIS = trames insérées en direct + trames requeuées (à resync). C'est
  // la cible ; `execComplete` RÉCONCILIE ensuite total_frames sur le compte RÉEL
  // en base après drain FIFO (les ops `frames` précèdent `complete`).
  const emittedFrames = total + requeued;

  // 4. Enqueue la clôture (tours → agrégats → upload) DANS L'ORDRE FIFO.
  const lapRows = buildLapRows(sessionId, recordedLaps, state.lapMaxima);
  if (lapRows.length > 0) {
    await enqueue({ type: 'laps', sessionId, rows: lapRows }).catch((e) =>
      console.warn('[OXV][capture] enqueue laps KO :', e instanceof Error ? e.message : e)
    );
  }

  // La durée ne se calcule plus ici : `duration_seconds` est une colonne
  // GÉNÉRÉE, déduite de `ended_at - started_at`. La calculer puis l'envoyer est
  // exactement ce qui empêchait toute clôture d'aboutir.
  await enqueue({
    type: 'complete',
    sessionId,
    userId,
    updates: {
      status: 'completed',
      ended_at: new Date().toISOString(),
      /**
       * `duration_seconds` N'EST PAS ÉCRITE — ET C'EST POURQUOI AUCUNE SÉANCE
       * NE S'EST JAMAIS CLOSE.
       *
       * La colonne est `GENERATED ALWAYS AS (EXTRACT(epoch FROM (ended_at -
       * started_at)))` : Postgres refuse toute écriture avec le code **428C9**,
       * « column can only be updated to DEFAULT ».
       *
       * La clôture l'envoyait pourtant à chaque fois. Conséquences en chaîne :
       * l'UPDATE échouait, `428C9` appartient à la classe 42 — classée
       * abandonnable —, et l'opération partait en QUARANTAINE DÉFINITIVE. La
       * séance restait `recording` à vie, et `fetchAllSessions` filtrant sur
       * `completed`, elle n'apparaissait dans AUCUNE liste.
       *
       * Constaté le 13/08/2026 sur la première séance réelle : 26 999 trames et
       * 3 tours parfaitement écrits, et une séance invisible. Vérifié ensuite
       * sur l'historique — **aucune séance captée par l'application ne s'était
       * jamais close.** Les dix `completed` de la base datent de mai et ne
       * viennent pas de ce chemin.
       *
       * `ended_at` suffit : la durée s'en déduit toute seule, exactement.
       */
      // duration_seconds : colonne générée, jamais écrite.
      lap_count: lapCount,
      best_lap_seconds: bestLapSeconds,
      max_speed_kmh: state.maxima.maxSpeedKmh || null,
      max_g_lateral: state.maxima.maxGLateral || null,
      max_g_longitudinal: state.maxima.maxGLongitudinal || null,
      /**
       * LA DISTANCE PARCOURUE, ENFIN ÉCRITE — posée le 13/08/2026.
       *
       * `telemetry_sessions.distance_km` n'a jamais reçu de valeur : la colonne
       * existe, le bilan et la Saison la lisent, et elle valait `null` sur
       * toutes les séances. L'écran affichait « — » là où la mesure existait
       * pourtant — l'odomètre du détecteur de tours la tient déjà, à la trame
       * près, et personne ne la relevait.
       *
       * `null` si aucune distance n'a été parcourue : on n'écrit pas un zéro
       * pour une mesure qui n'a pas eu lieu.
       */
      distance_km: distanceM !== null && distanceM > 0 ? Math.round(distanceM / 10) / 100 : null,
      total_frames: emittedFrames,
    },
  }).catch((e) =>
    console.warn('[OXV][capture] enqueue complete KO :', e instanceof Error ? e.message : e)
  );

  // 5. Upload du .ubx brut via la file (survivant hors-ligne, idempotent).
  if (ubxUri) {
    await enqueue({ type: 'ubx_upload', sessionId, userId, fileUri: ubxUri }).catch((e) =>
      console.warn('[OXV][capture] enqueue upload .ubx KO :', e instanceof Error ? e.message : e)
    );
  }

  if (requeued > 0) {
    console.warn(
      `[OXV][capture] ${requeued} trame(s) requeuée(s) pour resynchronisation (filet .ubx).`
    );
  }

  // 6. Draine en arrière-plan : si réseau, la clôture part tout de suite ; sinon
  //    elle attend et sera rejouée (reprise au lancement / retour réseau).
  void processQueue().catch(() => undefined);

  return { ok: true, sessionId, ubxUri, totalFrames: emittedFrames, droppedFrames: 0 };
}

/** Abandonne la capture en cours : marque 'aborted', sans router vers le bilan. */
export async function abortCaptureSession(): Promise<void> {
  const state = current;
  current = null;
  if (!state) return;
  setLinkStatus('idle');
  state.unsubData();
  state.unsubReconnect();
  state.unsubStatus();
  state.unsubAppState();
  // Désarme la reconnexion illimitée + le timeout long (cf. stopCaptureSession).
  bluetoothService.setUnlimitedReconnect(false);
  releaseKeepAwake();
  clearInterruptTimeout(state);
  desarmerVeilleSilence(state);
  stopPilotLiveRelay(); // coupe le relais live (fin de capture / lien perdu)
  discardBiometryCapture(); // séance abandonnée → purge le cardio local, rien préservé
  if (state.timer) clearInterval(state.timer);
  // Attend un flush éventuellement en vol pour ne pas écrire après l'abandon.
  if (state.flushPromise) {
    try {
      await state.flushPromise;
    } catch {
      /* ignore */
    }
  }
  stopLapDetection();
  try {
    await stopCapture();
  } catch {
    /* ignore */
  }
  useSessionStore.getState().abortSession();

  // Marque 'aborted' via la FILE (rejouable). Indispensable hors-ligne : la
  // création de session est peut-être encore en attente dans la file ; sans cette
  // clôture rejouée, un create_session drainé plus tard ressusciterait une séance
  // en `recording` fantôme. `execComplete` applique l'update .eq(id).eq(user_id)
  // (il ne recompte total_frames que pour un statut 'completed').
  await enqueue({
    type: 'complete',
    sessionId: state.sessionId,
    userId: state.userId,
    updates: { status: 'aborted', ended_at: new Date().toISOString() },
  }).catch((e) =>
    console.warn('[OXV][capture] enqueue abort KO :', e instanceof Error ? e.message : e)
  );
  void processQueue().catch(() => undefined);
}
