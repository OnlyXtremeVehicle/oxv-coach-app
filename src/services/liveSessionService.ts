/**
 * liveSessionService — câblage Supabase Realtime du direct coach (P5).
 *
 * Transport (durci privacy 2026-07-11) — canaux PRIVÉS, audience scopée binôme :
 *   - presence  `live:roster:<coachId>` → chaque coach a SON roster ; le pilote
 *       ne s'y track que s'il a consenti le live à CE coach → un coach ne voit
 *       que SES pilotes consentis (plus de roster global).
 *   - broadcast `live:session:<id>`     → flux télémétrique throttlé, PRIVÉ.
 *   - broadcast `live:board:<id>`       → tableau de marche (LIVE-B), audience
 *       ÉLARGIE (écran TV du paddock) : donc contenu plus pauvre, filtré par
 *       stripHealth, et jamais la moindre donnée de santé.
 * `{ config: { private: true } }` partout : l'autorisation serveur est portée par
 * la RLS `realtime.messages` (migration realtime — cf. docs/architecture/09 §3).
 * Le consentement gate donc l'ÉMISSION (liveRelayRunner) ET l'AUDIENCE (RLS +
 * roster par-coach). Éphémère, zéro table. La logique (reduceRoster, throttle,
 * états) vit dans liveSessionLogic (pur, testé). + un SIMULATEUR de flux pour
 * développer sans RaceBox ni réseau circuit.
 *
 * Doctrine : le coach observe, le pilote conduit en silence. Aucun classement.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { type BoardEvent, parseBoardEvent } from './boardLogic';
import {
  type BiometryLiveEvent,
  type LiveFrame,
  type RosterEntry,
  type RosterMeta,
  reduceRoster,
} from './liveSessionLogic';
import { type SafeLivePayload, stripHealth } from './v2/liveHealthGate';

const rosterTopic = (coachId: string) => `live:roster:${coachId}`;
const sessionChannel = (sessionId: string) => `live:session:${sessionId}`;
const boardTopic = (sessionId: string) => `live:board:${sessionId}`;

/** Nettoyage d'un abonnement. */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// Roster PAR COACH + canaux PRIVÉS (durcissement privacy 2026-07-11).
//
// Chaque coach a SON topic `live:roster:<coachId>` : le pilote ne se track que
// dans le roster des coachs à qui il a consenti le live (liveRelayRunner), et le
// coach ne lit QUE le sien. L'audience est ainsi scopée au binôme consenti, pas
// globale. Canaux PRIVÉS (`private: true`) : l'autorisation serveur est portée
// par la RLS `realtime.messages` (migration realtime, cf. docs/architecture/09).
//
// Un client indexe les canaux par topic → une Map refcomptée par coachId :
// lecture (coach) + track (pilote) partagent l'instance du topic (évite qu'un
// removeChannel arrache le canal de l'autre — cas du simulateur dev, 2 rôles/1
// client). La clé de présence est celle du 1er appelant (pilote → pilotId).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// LIBÉRATION DIFFÉRÉE — pourquoi on ne ferme pas tout de suite
//
// `supabase.removeChannel()` est ASYNCHRONE : l'instance passe par un état de
// fermeture avant de mourir. Or `channel(topic)` DÉDOUBLONNE par topic. Si l'on
// retirait l'entrée de la table aussitôt, un abonné arrivant pendant la
// fermeture — fermer puis rouvrir une fiche direct, ce qui arrive tout le temps —
// recevrait l'instance MOURANTE : son `.subscribe()` ne rendrait jamais son
// SUBSCRIBED, et l'écran resterait « Hors ligne » sur un flux pourtant vivant.
//
// On laisse donc le canal vivre un court instant après le départ du dernier
// abonné. Si quelqu'un revient dans cette fenêtre, on annule la fermeture et on
// réutilise le canal encore chaud. Sinon, il est fermé pour de bon.
// ---------------------------------------------------------------------------

const DELAI_FERMETURE_MS = 2000;

interface TopicLiberable {
  channel: RealtimeChannel;
  refs: number;
  /** Fermeture programmée, annulable si un abonné revient. */
  fermeture?: ReturnType<typeof setTimeout> | null;
}

/** Décrémente, et programme la fermeture quand plus personne n'écoute. */
function libererApresDelai<T extends TopicLiberable>(table: Map<string, T>, cle: string): void {
  const state = table.get(cle);
  if (!state) return;
  state.refs -= 1;
  if (state.refs > 0) return;
  if (state.fermeture) return;
  state.fermeture = setTimeout(() => {
    // Un abonné a pu revenir puis repartir : on revérifie avant de fermer.
    const courant = table.get(cle);
    if (!courant || courant !== state || courant.refs > 0) return;
    supabase.removeChannel(courant.channel);
    table.delete(cle);
  }, DELAI_FERMETURE_MS);
}

/** Annule une fermeture programmée : le canal est encore chaud, on le reprend. */
function annulerFermeture(state: TopicLiberable): void {
  if (state.fermeture) {
    clearTimeout(state.fermeture);
    state.fermeture = null;
  }
}

interface RosterTopicState {
  channel: RealtimeChannel;
  refs: number;
  /** Fermeture différée en cours, annulable si un abonné revient. */
  fermeture?: ReturnType<typeof setTimeout> | null;
  track: RosterMeta | null;
  syncCbs: Set<() => void>;
}
const rosters = new Map<string, RosterTopicState>();

function ensureRoster(coachId: string, preferredKey: string): RosterTopicState {
  const existing = rosters.get(coachId);
  if (existing) {
    // Le canal était peut-être en cours de fermeture : on la rappelle.
    annulerFermeture(existing);
    return existing;
  }
  const channel = supabase.channel(rosterTopic(coachId), {
    config: { private: true, presence: { key: preferredKey } },
  });
  const state: RosterTopicState = { channel, refs: 0, track: null, syncCbs: new Set() };
  const emit = () => state.syncCbs.forEach((cb) => cb());
  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && state.track) channel.track(state.track);
    });
  rosters.set(coachId, state);
  return state;
}

function releaseRoster(coachId: string): void {
  libererApresDelai(rosters, coachId);
}

/** COACH — s'abonne à la présence des pilotes en piste QUI LUI ONT CONSENTI (son roster). */
export function subscribeRoster(
  coachId: string,
  onRoster: (roster: RosterEntry[]) => void
): Unsubscribe {
  const state = ensureRoster(coachId, 'coach');
  state.refs += 1;
  const cb = () => {
    const presence = state.channel.presenceState() as unknown as Record<string, RosterMeta[]>;
    onRoster(reduceRoster(presence));
  };
  state.syncCbs.add(cb);
  cb(); // état courant immédiat (peut être déjà synchronisé)
  let released = false;
  return () => {
    if (released) return; // idempotent : cf. subscribePilotStream (topic refcompté)
    released = true;
    state.syncCbs.delete(cb);
    releaseRoster(coachId);
  };
}

/**
 * PILOTE — met à jour la méta DÉJÀ publiée dans le roster d'un coach, sans
 * quitter ni rejoindre (une sortie/entrée ferait clignoter la présence).
 *
 * Nécessaire parce qu'une méta n'est pas figée pour la séance : `bioShared`
 * suit le consentement biométrie, qui peut être révoqué ou accordé EN SÉANCE.
 * Sans ce ré-envoi, le coach continuerait de voir « Cardio » après une
 * révocation — un état de partage périmé affiché comme actuel.
 */
export function retrackRoster(coachId: string, meta: RosterMeta): void {
  const state = rosters.get(coachId);
  if (!state) return;
  state.track = meta;
  if (state.channel.state === 'joined') state.channel.track(meta);
}

/** PILOTE — rejoint le roster d'UN coach consenti. Le runner en appelle un par coach. */
export function joinRoster(coachId: string, meta: RosterMeta): Unsubscribe {
  const state = ensureRoster(coachId, meta.pilotId);
  state.refs += 1;
  state.track = meta;
  if (state.channel.state === 'joined') state.channel.track(meta);
  let released = false;
  return () => {
    if (released) return; // idempotent : cf. subscribePilotStream (topic refcompté)
    released = true;
    state.track = null;
    state.channel.untrack();
    releaseRoster(coachId);
  };
}

// ---------------------------------------------------------------------------
// Flux télémétrique (broadcast PRIVÉ) — topic REFCOMPTÉ.
//
// POURQUOI un refcount ici, comme pour les rosters ci-dessus : supabase-js
// DÉDOUBLONNE les canaux PAR TOPIC (RealtimeClient.channel() renvoie l'instance
// existante si le topic est déjà ouvert). Dès qu'un second consommateur ouvre
// `live:session:<id>` — c'est le cas depuis BIO-2, où le roster coach lit le
// cardio pendant que la fiche direct lit les trames — les deux partagent UNE
// instance. Sans comptage, le premier `removeChannel` arrache le canal de
// l'autre : le cardio du roster meurt en fermant la fiche direct, et le second
// abonné, branché sur un canal DÉJÀ souscrit, ne reçoit jamais son SUBSCRIBED
// (la fiche s'afficherait « hors ligne » sur un flux pourtant vivant).
//
// On mutualise donc l'instance, on diffuse les événements à tous les inscrits,
// on REJOUE le statut courant à l'arrivée d'un retardataire, et on ne libère le
// canal qu'au départ du dernier.
// ---------------------------------------------------------------------------

interface SessionTopicState {
  channel: RealtimeChannel;
  refs: number;
  /** Fermeture différée en cours, annulable si un abonné revient. */
  fermeture?: ReturnType<typeof setTimeout> | null;
  /** Statut courant, rejoué à tout abonné qui arrive après le SUBSCRIBED. */
  subscribed: boolean;
  frameCbs: Set<(frame: LiveFrame) => void>;
  bioCbs: Set<(event: BiometryLiveEvent) => void>;
  statusCbs: Set<(subscribed: boolean) => void>;
}
const sessions = new Map<string, SessionTopicState>();

function ensureSession(sessionId: string): SessionTopicState {
  const existing = sessions.get(sessionId);
  if (existing) {
    // Le canal était peut-être en cours de fermeture : on la rappelle.
    annulerFermeture(existing);
    return existing;
  }

  const channel: RealtimeChannel = supabase.channel(sessionChannel(sessionId), {
    config: { private: true },
  });
  const state: SessionTopicState = {
    channel,
    refs: 0,
    subscribed: false,
    frameCbs: new Set(),
    bioCbs: new Set(),
    statusCbs: new Set(),
  };
  channel
    .on('broadcast', { event: 'frame' }, (msg) => {
      const frame = msg.payload as LiveFrame;
      state.frameCbs.forEach((cb) => cb(frame));
    })
    .on('broadcast', { event: 'biometry' }, (msg) => {
      const event = msg.payload as BiometryLiveEvent;
      state.bioCbs.forEach((cb) => cb(event));
    })
    .subscribe((status) => {
      state.subscribed = status === 'SUBSCRIBED';
      state.statusCbs.forEach((cb) => cb(state.subscribed));
    });
  sessions.set(sessionId, state);
  return state;
}

function releaseSession(sessionId: string): void {
  libererApresDelai(sessions, sessionId);
}

/** COACH — s'abonne au flux live d'un pilote (canal privé, RLS binôme consenti). */
export function subscribePilotStream(
  sessionId: string,
  handlers: {
    onFrame: (frame: LiveFrame) => void;
    onStatus?: (subscribed: boolean) => void;
    /**
     * BIO-2 — événement biométrique (FC + tendance R-R + contact), reçu sur le
     * MÊME canal privé, event `biometry`. N'arrive QUE si le pilote émet sous
     * triple verrou (cf. liveRelayRunner) ; côté coach on ne fait qu'afficher.
     */
    onBiometry?: (event: BiometryLiveEvent) => void;
  }
): Unsubscribe {
  const state = ensureSession(sessionId);
  state.refs += 1;

  const onFrame = handlers.onFrame;
  const onBio = handlers.onBiometry;
  const onStatus = handlers.onStatus;
  state.frameCbs.add(onFrame);
  if (onBio) state.bioCbs.add(onBio);
  if (onStatus) {
    state.statusCbs.add(onStatus);
    // Retardataire : le canal a pu être souscrit AVANT cet abonnement (topic
    // partagé). On rejoue l'état courant pour qu'il ne reste pas « hors ligne ».
    if (state.subscribed) onStatus(true);
  }

  // Idempotent : sur un topic REFCOMPTÉ, un second appel décrémenterait une
  // seconde fois et arracherait le canal aux autres consommateurs. Le contrat
  // « appeler deux fois ne fait rien de plus » est ici une garde, pas un confort.
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.frameCbs.delete(onFrame);
    if (onBio) state.bioCbs.delete(onBio);
    if (onStatus) state.statusCbs.delete(onStatus);
    releaseSession(sessionId);
  };
}

/**
 * PILOTE — ouvre un émetteur de flux (canal PRIVÉ). Renvoie `send(frame)` (le
 * throttle est géré en amont par le relais via shouldEmitFrame) + le retrait.
 * Passe par le MÊME topic refcompté : émettre et lire peuvent coexister sur un
 * seul client (cas du simulateur dev) sans que l'un ferme le canal de l'autre.
 */
export function openPilotBroadcast(sessionId: string): {
  send: (frame: LiveFrame) => void;
  sendBiometry: (event: BiometryLiveEvent) => void;
  close: Unsubscribe;
} {
  const state = ensureSession(sessionId);
  state.refs += 1;
  let closed = false;
  return {
    send: (frame: LiveFrame) => {
      if (closed || !state.subscribed) return;
      state.channel.send({ type: 'broadcast', event: 'frame', payload: frame });
    },
    // BIO-2 — même canal PRIVÉ (audience = binôme consenti), event distinct
    // `biometry`. La décision d'émettre (triple verrou) est prise en amont par
    // le relais ; ici on ne fait que transporter vers le coach.
    sendBiometry: (event: BiometryLiveEvent) => {
      if (closed || !state.subscribed) return;
      state.channel.send({ type: 'broadcast', event: 'biometry', payload: event });
    },
    close: () => {
      if (closed) return; // idempotent : ne libère jamais deux fois la même réf
      closed = true;
      releaseSession(sessionId);
    },
  };
}

// ---------------------------------------------------------------------------
// Tableau de marche (LIVE-B) — topic `live:board:<sessionId>`, REFCOMPTÉ.
//
// AUDIENCE DIFFÉRENTE des canaux coach : le board alimente l'écran TV du
// paddock, que tout le monde regarde, là où `live:session:` ne parle qu'au coach
// du binôme consenti. D'où un topic distinct, ses propres policies
// (`board_recv` / `board_send`, migration 20260725190000) — et surtout une règle
// de contenu plus stricte : AUCUNE donnée de santé, jamais, même consentie.
// Cette règle-là ne peut pas s'écrire en SQL (le serveur ne lit pas le corps du
// message) : elle est APPLICATIVE, et tenue par stripHealth aux deux bouts.
//
// Le refcount suit le patron de `ensureSession` — supabase-js dédoublonne les
// canaux par topic, donc sans comptage le premier `removeChannel` arracherait le
// canal aux autres consommateurs (émission pilote et lecture coach peuvent
// coexister sur un même client, cas du simulateur dev).
// ---------------------------------------------------------------------------

interface BoardTopicState {
  channel: RealtimeChannel;
  refs: number;
  /** Fermeture différée en cours, annulable si un abonné revient. */
  fermeture?: ReturnType<typeof setTimeout> | null;
  /** Statut courant, rejoué à tout abonné qui arrive après le SUBSCRIBED. */
  subscribed: boolean;
  boardCbs: Set<(event: BoardEvent) => void>;
  statusCbs: Set<(subscribed: boolean) => void>;
}
const boards = new Map<string, BoardTopicState>();

function ensureBoard(sessionId: string): BoardTopicState {
  const existing = boards.get(sessionId);
  if (existing) {
    // Le canal était peut-être en cours de fermeture : on la rappelle.
    annulerFermeture(existing);
    return existing;
  }

  const channel: RealtimeChannel = supabase.channel(boardTopic(sessionId), {
    config: { private: true },
  });
  const state: BoardTopicState = {
    channel,
    refs: 0,
    subscribed: false,
    boardCbs: new Set(),
    statusCbs: new Set(),
  };
  channel
    .on('broadcast', { event: 'board' }, (msg) => {
      // Ce qui arrive vient d'un AUTRE appareil : on le relit champ par champ
      // plutôt que de le caster. Une ligne illisible est écartée en silence — un
      // écran vide est honnête, une ligne inventée ne le serait pas.
      const event = parseBoardEvent(msg.payload);
      if (!event) return;
      state.boardCbs.forEach((cb) => cb(event));
    })
    .subscribe((status) => {
      state.subscribed = status === 'SUBSCRIBED';
      state.statusCbs.forEach((cb) => cb(state.subscribed));
    });
  boards.set(sessionId, state);
  return state;
}

function releaseBoard(sessionId: string): void {
  libererApresDelai(boards, sessionId);
}

/**
 * PILOTE — ouvre l'émetteur du tableau de marche d'une séance.
 *
 * `send` attend la SORTIE de `stripHealth()`, pas un objet quelconque : c'est le
 * contrat du lot, et l'appelant (liveRelayRunner) l'applique de façon visible au
 * point d'émission. Le service la RÉAPPLIQUE ici — l'opération est idempotente,
 * donc gratuite sur une charge déjà filtrée, et elle garantit que la barrière
 * tient même si un futur appelant oublie de la traverser. Sur un canal public,
 * une barrière qui dépend de la discipline de l'appelant n'en est pas une.
 */
export function openBoardBroadcast(sessionId: string): {
  send: (payload: SafeLivePayload) => void;
  close: Unsubscribe;
} {
  const state = ensureBoard(sessionId);
  state.refs += 1;
  let closed = false;
  return {
    send: (payload: SafeLivePayload) => {
      if (closed || !state.subscribed) return;
      state.channel.send({ type: 'broadcast', event: 'board', payload: stripHealth(payload) });
    },
    close: () => {
      if (closed) return; // idempotent : ne libère jamais deux fois la même réf
      closed = true;
      releaseBoard(sessionId);
    },
  };
}

/**
 * LECTEUR — s'abonne au tableau de marche d'une séance (écran TV du paddock,
 * multi-live coach). Aucune notion d'ordre ici : le canal transporte des lignes,
 * l'ordre d'affichage est décidé au rendu par `sortBoard` (numéro de voiture).
 */
export function subscribeBoard(
  sessionId: string,
  handlers: {
    onBoard: (event: BoardEvent) => void;
    onStatus?: (subscribed: boolean) => void;
  }
): Unsubscribe {
  const state = ensureBoard(sessionId);
  state.refs += 1;

  const onBoard = handlers.onBoard;
  const onStatus = handlers.onStatus;
  state.boardCbs.add(onBoard);
  if (onStatus) {
    state.statusCbs.add(onStatus);
    // Retardataire : le canal a pu être souscrit AVANT cet abonnement (topic
    // partagé). On rejoue l'état courant pour ne pas le laisser « hors ligne ».
    if (state.subscribed) onStatus(true);
  }

  // Idempotent : cf. subscribePilotStream — sur un topic REFCOMPTÉ, un second
  // appel décrémenterait une seconde fois et arracherait le canal aux autres.
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.boardCbs.delete(onBoard);
    if (onStatus) state.statusCbs.delete(onStatus);
    releaseBoard(sessionId);
  };
}

// ---------------------------------------------------------------------------
// SIMULATEUR (dev) — un flux plausible sans RaceBox ni réseau circuit
// ---------------------------------------------------------------------------

/**
 * Émet un flux live simulé sur `live:session:<id>` (~3 Hz) : chrono qui monte,
 * secteurs, vitesse/G plausibles, un virage « à surveiller » de temps en temps.
 * Pour développer l'UI coach sans matériel. Retourne l'arrêt.
 */
export function startSimulatedStream(sessionId: string, intervalMs = 320): Unsubscribe {
  const emitter = openPilotBroadcast(sessionId);
  let lap = 1;
  let lapStart = Date.now();
  let tick = 0;
  const id = setInterval(() => {
    tick += 1;
    const now = Date.now();
    let chronoMs = now - lapStart;
    // Boucle de tour ~90 s.
    if (chronoMs > 90000) {
      lap += 1;
      lapStart = now;
      chronoMs = 0;
    }
    const phase = (tick % 40) / 40; // position sur le tour
    const sector = phase < 0.33 ? 1 : phase < 0.66 ? 2 : 3;
    const cornerIndex = Math.floor(phase * 7) + 1;
    const inCorner = tick % 5 < 2;
    emitter.send({
      lap,
      sector,
      speedKmh: inCorner ? 70 + (tick % 9) * 3 : 140 + (tick % 11) * 5,
      gLat: inCorner ? 0.9 + (tick % 4) * 0.1 : 0.2,
      gLong: inCorner ? -0.7 : 0.3,
      chronoMs,
      cornerIndex: inCorner ? cornerIndex : null,
      cornerWatch: inCorner && cornerIndex === 3, // le virage 3 « à surveiller »
      atMs: now,
    });
  }, intervalMs);
  return () => {
    clearInterval(id);
    emitter.close();
  };
}
