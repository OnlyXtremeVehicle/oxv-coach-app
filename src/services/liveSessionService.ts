/**
 * liveSessionService — câblage Supabase Realtime du direct coach (P5).
 *
 * Transport (durci privacy 2026-07-11) — canaux PRIVÉS, audience scopée binôme :
 *   - presence  `live:roster:<coachId>` → chaque coach a SON roster ; le pilote
 *       ne s'y track que s'il a consenti le live à CE coach → un coach ne voit
 *       que SES pilotes consentis (plus de roster global).
 *   - broadcast `live:session:<id>`     → flux télémétrique throttlé, PRIVÉ.
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
import {
  type BiometryLiveEvent,
  type LiveFrame,
  type RosterEntry,
  type RosterMeta,
  reduceRoster,
} from './liveSessionLogic';

const rosterTopic = (coachId: string) => `live:roster:${coachId}`;
const sessionChannel = (sessionId: string) => `live:session:${sessionId}`;

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

interface RosterTopicState {
  channel: RealtimeChannel;
  refs: number;
  track: RosterMeta | null;
  syncCbs: Set<() => void>;
}
const rosters = new Map<string, RosterTopicState>();

function ensureRoster(coachId: string, preferredKey: string): RosterTopicState {
  const existing = rosters.get(coachId);
  if (existing) return existing;
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
  const state = rosters.get(coachId);
  if (!state) return;
  state.refs -= 1;
  if (state.refs <= 0) {
    supabase.removeChannel(state.channel);
    rosters.delete(coachId);
  }
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
  return () => {
    state.syncCbs.delete(cb);
    releaseRoster(coachId);
  };
}

/** PILOTE — rejoint le roster d'UN coach consenti. Le runner en appelle un par coach. */
export function joinRoster(coachId: string, meta: RosterMeta): Unsubscribe {
  const state = ensureRoster(coachId, meta.pilotId);
  state.refs += 1;
  state.track = meta;
  if (state.channel.state === 'joined') state.channel.track(meta);
  return () => {
    state.track = null;
    state.channel.untrack();
    releaseRoster(coachId);
  };
}

// ---------------------------------------------------------------------------
// Flux télémétrique (broadcast PRIVÉ)
// ---------------------------------------------------------------------------

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
  const channel = supabase.channel(sessionChannel(sessionId), { config: { private: true } });
  channel
    .on('broadcast', { event: 'frame' }, (msg) => {
      handlers.onFrame(msg.payload as LiveFrame);
    })
    .on('broadcast', { event: 'biometry' }, (msg) => {
      handlers.onBiometry?.(msg.payload as BiometryLiveEvent);
    })
    .subscribe((status) => {
      handlers.onStatus?.(status === 'SUBSCRIBED');
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * PILOTE — ouvre un émetteur de flux (canal PRIVÉ). Renvoie `send(frame)` (le
 * throttle est géré en amont par le relais via shouldEmitFrame) + le retrait.
 */
export function openPilotBroadcast(sessionId: string): {
  send: (frame: LiveFrame) => void;
  sendBiometry: (event: BiometryLiveEvent) => void;
  close: Unsubscribe;
} {
  const channel: RealtimeChannel = supabase.channel(sessionChannel(sessionId), {
    config: { private: true },
  });
  let ready = false;
  channel.subscribe((status) => {
    ready = status === 'SUBSCRIBED';
  });
  return {
    send: (frame: LiveFrame) => {
      if (!ready) return;
      channel.send({ type: 'broadcast', event: 'frame', payload: frame });
    },
    // BIO-2 — même canal PRIVÉ (audience = binôme consenti), event distinct
    // `biometry`. La décision d'émettre (triple verrou) est prise en amont par
    // le relais ; ici on ne fait que transporter vers le coach.
    sendBiometry: (event: BiometryLiveEvent) => {
      if (!ready) return;
      channel.send({ type: 'broadcast', event: 'biometry', payload: event });
    },
    close: () => {
      supabase.removeChannel(channel);
    },
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
