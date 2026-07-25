/**
 * liveSessionLogic — logique PURE du direct coach (P5, décision Gabin 2026-07-11).
 *
 * Le coach regarde le direct d'un ou plusieurs pilotes en piste. Transport =
 * Supabase Realtime (presence `live:roster` + broadcast `live:session:<id>`),
 * câblé dans liveSessionService. Ici : uniquement des fonctions déterministes,
 * testables, sans I/O — le modèle du live.
 *
 * Doctrine : le coach observe (il ne conduit pas) ; le pilote reste en silence
 * en piste. Les alertes sont FACTUELLES et DESCRIPTIVES (« à surveiller »),
 * jamais une consigne. Aucun classement entre pilotes.
 */

import { compareCarNo } from './boardLogic';

/** Une trame live throttlée (relayée par l'app pilote depuis le flux BLE). */
export interface LiveFrame {
  /** Numéro du tour en cours. */
  lap: number;
  /** Secteur en cours (1..n) ou null. */
  sector: number | null;
  speedKmh: number;
  gLat: number;
  gLong: number;
  /** Temps écoulé sur le tour en cours (ms) ou null. */
  chronoMs: number | null;
  /** Index du virage en cours de négociation, ou null. */
  cornerIndex: number | null;
  /** Virage signalé « à surveiller » (fait, pas une consigne). */
  cornerWatch: boolean;
  /** Horodatage de la trame (ms epoch, côté réception). */
  atMs: number;
}

/** Une inscription de présence (un pilote en piste, vu du coach). */
export interface RosterMeta {
  pilotId: string;
  firstName: string;
  sessionId: string;
  circuit: string | null;
  /** En piste (true) vs au stand (false). */
  onTrack: boolean;
  /** Depuis quand (ms epoch). */
  sinceMs: number;
  /**
   * LIVE-B — numéro de voiture, ou null/absent si aucun n'est attribué.
   *
   * C'est une donnée d'IDENTITÉ PUBLIQUE, au même titre que le numéro peint sur
   * la portière : elle se lit du bord de piste, et rien ne s'y devine du pilote.
   * Rien à voir avec `bioShared`, qui n'est qu'un booléen d'état — et surtout
   * rien à voir avec une mesure de santé, qui n'a toujours aucune place ici.
   *
   * Sert à ordonner le multi-live coach par numéro de voiture, comme le tableau
   * de marche du paddock. Absent → la colonne affiche « — », jamais un 0.
   */
  carNo?: number | null;
  /**
   * BIO-2 — le pilote partage-t-il son cardio avec CE coach ? Booléen d'ÉTAT,
   * JAMAIS une mesure : aucune FC, aucune variabilité, aucune « zone » ne
   * transite par la présence (la biométrie n'emprunte que l'événement dédié du
   * canal privé, cf. liveRelayRunner). Sert uniquement à marquer discrètement
   * les pilotes dont le direct comporte une bande cardio — pas à la résumer.
   */
  bioShared?: boolean;
}

export type RosterEntry = RosterMeta;

/**
 * Événement biométrique live (BIO-2) — émis UNIQUEMENT vers le canal coach, à
 * 0,5 Hz (moyenne glissante 2 s), et SEULEMENT sous triple verrou (cf.
 * liveHealthGate). Vocabulaire FACTUEL et fermé : la tendance R-R est un constat
 * ('stable' | 'en baisse' | 'en hausse'), le contact un état de capteur. Aucun
 * diagnostic, aucune alerte automatique — le coach juge, l'app ne diagnostique pas.
 */
export interface BiometryLiveEvent {
  /** Fréquence cardiaque moyenne sur la fenêtre récente (bpm entier). */
  hrBpm: number;
  /** Tendance FACTUELLE de la variabilité cardiaque (liste fermée à 3 constats). */
  rrTrend: 'stable' | 'en baisse' | 'en hausse';
  /** État du contact capteur (pastille factuelle, jamais une alerte). */
  contact: 'ok' | 'poor' | 'unsupported';
  /** Horodatage de l'événement (ms epoch). */
  atMs: number;
}

/** État de connexion d'un flux live (vue coach d'un pilote). */
export type LiveConn = 'connecting' | 'live' | 'stale' | 'offline';

/**
 * Faut-il émettre cette trame ? (throttle côté pilote — on ne relaie pas 25 Hz,
 * mais ~3-4 Hz). Émet si c'est la première trame ou si l'écart au dernier envoi
 * atteint `minIntervalMs`.
 */
export function shouldEmitFrame(
  lastEmitMs: number | null,
  frameAtMs: number,
  minIntervalMs = 300
): boolean {
  if (lastEmitMs === null) return true;
  return frameAtMs - lastEmitMs >= minIntervalMs;
}

/**
 * Faut-il émettre la biométrie ? Cadence 0,5 Hz : au plus un événement toutes
 * les 2 s (le coach lit une moyenne glissante, pas le 1 Hz brut). Même contrat
 * que shouldEmitFrame : premier tick toujours autorisé, puis espacement minimal.
 */
export function shouldEmitBiometry(
  lastEmitMs: number | null,
  atMs: number,
  minIntervalMs = 2000
): boolean {
  if (lastEmitMs === null) return true;
  return atMs - lastEmitMs >= minIntervalMs;
}

/**
 * Réduit l'état de présence Supabase (map clé → métas) en un roster propre :
 * un pilote unique (le plus récent si doublons), triés « en piste » d'abord puis
 * par ancienneté croissante (le plus tôt en piste en tête). Aucun classement de
 * performance — juste qui est là.
 */
export function reduceRoster(presence: Record<string, RosterMeta[]>): RosterEntry[] {
  const byPilot = new Map<string, RosterMeta>();
  for (const metas of Object.values(presence)) {
    for (const m of metas) {
      const existing = byPilot.get(m.pilotId);
      if (!existing || m.sinceMs > existing.sinceMs) byPilot.set(m.pilotId, m);
    }
  }
  return [...byPilot.values()].sort((a, b) => {
    if (a.onTrack !== b.onTrack) return a.onTrack ? -1 : 1;
    if (a.sinceMs !== b.sinceMs) return a.sinceMs - b.sinceMs;
    return a.firstName.localeCompare(b.firstName);
  });
}

/**
 * Ordonne un roster par NUMÉRO DE VOITURE (LIVE-B, livrable 4 — multi-live).
 *
 * Même règle EXACTE que le tableau de marche du paddock : `compareCarNo` n'est
 * écrit qu'une fois, dans boardLogic, et les deux vues s'y branchent. Le coach
 * qui lève les yeux de sa tablette vers l'écran TV retrouve donc le même ordre —
 * et cet ordre ne raconte rien du roulage, ce qui est précisément le but : un
 * ordre par performance affiché peut requalifier un track day en compétition.
 *
 * Ne mute pas l'entrée. Distinct de `reduceRoster`, qui groupe par état de
 * présence (en piste / au stand) : ici c'est l'ordre d'AFFICHAGE de la liste.
 */
export function sortRosterByCarNo(roster: readonly RosterEntry[]): RosterEntry[] {
  return [...roster].sort((a, b) =>
    compareCarNo(
      { carNo: a.carNo ?? null, tieBreak: a.firstName },
      { carNo: b.carNo ?? null, tieBreak: b.firstName }
    )
  );
}

/**
 * État de connexion dérivé d'un flux. `connecting` tant qu'abonné sans trame ;
 * `live` si une trame est arrivée récemment ; `stale` si le flux se tait un
 * moment (réseau circuit instable) ; `offline` si abonnement perdu ou silence
 * prolongé. Le hors-ligne est un état honnête, jamais une invention de donnée.
 */
export function deriveLiveConn(input: {
  subscribed: boolean;
  lastFrameMs: number | null;
  nowMs: number;
  staleAfterMs?: number;
  offlineAfterMs?: number;
}): LiveConn {
  const { subscribed, lastFrameMs, nowMs } = input;
  const staleAfterMs = input.staleAfterMs ?? 3000;
  const offlineAfterMs = input.offlineAfterMs ?? 10000;
  if (!subscribed) return 'offline';
  if (lastFrameMs === null) return 'connecting';
  const age = nowMs - lastFrameMs;
  if (age >= offlineAfterMs) return 'offline';
  if (age >= staleAfterMs) return 'stale';
  return 'live';
}

/**
 * Alerte live FACTUELLE pour le coach : un virage signalé « à surveiller ».
 * Descriptif, jamais une consigne (« Freinez plus tôt » est interdit). Null si
 * rien à signaler.
 */
export function liveAlert(frame: LiveFrame, cornerName: string | null): string | null {
  if (!frame.cornerWatch || frame.cornerIndex === null) return null;
  const name = cornerName ?? `Virage ${frame.cornerIndex}`;
  return `${name} · à surveiller`;
}

/** Chrono live formaté « m:ss.d » (tour en cours). Null → tiret. */
export function formatLiveChrono(chronoMs: number | null): string {
  if (chronoMs === null || !Number.isFinite(chronoMs) || chronoMs < 0) return '—';
  const totalSec = chronoMs / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const tenth = Math.floor((totalSec * 10) % 10);
  return `${min}:${String(sec).padStart(2, '0')}.${tenth}`;
}
