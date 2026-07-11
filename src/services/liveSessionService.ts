/**
 * liveSessionService — câblage Supabase Realtime du direct coach (P5).
 *
 * Transport (cadrage COACH §4) :
 *   - presence  `live:roster`         → qui est en piste (coach lit, pilote track)
 *   - broadcast `live:session:<id>`   → flux télémétrique throttlé (pilote émet,
 *                                        coach s'abonne)
 * Éphémère, ZÉRO schéma. La logique (reduceRoster, throttle, états) vit dans
 * liveSessionLogic (pur, testé) ; ici uniquement l'I/O Realtime + un SIMULATEUR
 * de flux pour développer sans RaceBox ni réseau circuit.
 *
 * Doctrine : le coach observe, le pilote conduit en silence. Aucun classement.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  type LiveFrame,
  type RosterEntry,
  type RosterMeta,
  reduceRoster,
} from './liveSessionLogic';

const ROSTER_CHANNEL = 'live:roster';
const sessionChannel = (sessionId: string) => `live:session:${sessionId}`;

/** Nettoyage d'un abonnement. */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// Roster — UN SEUL canal `live:roster` par client (singleton refcompté).
// Un client supabase-js indexe les canaux par topic : lecture (coach) et track
// (pilote) DOIVENT partager la même instance, sinon un removeChannel arrache le
// canal de l'autre (bug visible dès que les deux rôles tournent dans un seul
// client, ex. le simulateur dev). La clé de présence est celle du 1er appelant :
// pilote → pilotId (unique) ; coach lecteur → 'coach' (ne track pas, clé neutre).
// ---------------------------------------------------------------------------

let rosterChannel: RealtimeChannel | null = null;
let rosterRefs = 0;
let rosterTrack: RosterMeta | null = null;
const rosterSyncCbs = new Set<() => void>();

function ensureRosterChannel(preferredKey: string): RealtimeChannel {
  if (rosterChannel) return rosterChannel;
  const ch = supabase.channel(ROSTER_CHANNEL, { config: { presence: { key: preferredKey } } });
  const emit = () => rosterSyncCbs.forEach((cb) => cb());
  ch.on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && rosterTrack) ch.track(rosterTrack);
    });
  rosterChannel = ch;
  return ch;
}

function releaseRosterChannel(): void {
  rosterRefs -= 1;
  if (rosterRefs <= 0 && rosterChannel) {
    supabase.removeChannel(rosterChannel);
    rosterChannel = null;
    rosterRefs = 0;
    rosterTrack = null;
  }
}

/** COACH — s'abonne à la présence des pilotes en piste. Rappelle `onRoster` à chaque sync. */
export function subscribeRoster(onRoster: (roster: RosterEntry[]) => void): Unsubscribe {
  rosterRefs += 1;
  const ch = ensureRosterChannel('coach');
  const cb = () => {
    const state = ch.presenceState() as unknown as Record<string, RosterMeta[]>;
    onRoster(reduceRoster(state));
  };
  rosterSyncCbs.add(cb);
  cb(); // état courant immédiat (peut être déjà synchronisé)
  return () => {
    rosterSyncCbs.delete(cb);
    releaseRosterChannel();
  };
}

/** PILOTE — rejoint le roster (capture démarrée). Retourne le retrait. */
export function joinRoster(meta: RosterMeta): Unsubscribe {
  rosterRefs += 1;
  rosterTrack = meta;
  const ch = ensureRosterChannel(meta.pilotId);
  // Si le canal est déjà abonné (créé par le coach), on track maintenant ;
  // sinon le callback de subscribe s'en charge à SUBSCRIBED.
  if (ch.state === 'joined') ch.track(meta);
  return () => {
    rosterTrack = null;
    ch.untrack();
    releaseRosterChannel();
  };
}

// ---------------------------------------------------------------------------
// Flux télémétrique (broadcast)
// ---------------------------------------------------------------------------

/** COACH — s'abonne au flux live d'un pilote. `onStatus` reçoit l'état du canal. */
export function subscribePilotStream(
  sessionId: string,
  handlers: { onFrame: (frame: LiveFrame) => void; onStatus?: (subscribed: boolean) => void }
): Unsubscribe {
  const channel = supabase.channel(sessionChannel(sessionId));
  channel
    .on('broadcast', { event: 'frame' }, (msg) => {
      handlers.onFrame(msg.payload as LiveFrame);
    })
    .subscribe((status) => {
      handlers.onStatus?.(status === 'SUBSCRIBED');
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * PILOTE — ouvre un émetteur de flux. Renvoie `send(frame)` (le throttle est géré
 * en amont par le relais via shouldEmitFrame) + le retrait du canal.
 */
export function openPilotBroadcast(sessionId: string): {
  send: (frame: LiveFrame) => void;
  close: Unsubscribe;
} {
  const channel: RealtimeChannel = supabase.channel(sessionChannel(sessionId));
  let ready = false;
  channel.subscribe((status) => {
    ready = status === 'SUBSCRIBED';
  });
  return {
    send: (frame: LiveFrame) => {
      if (!ready) return;
      channel.send({ type: 'broadcast', event: 'frame', payload: frame });
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
