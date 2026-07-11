/**
 * liveRelayLogic — map PURE d'une trame RaceBox → LiveFrame (relais pilote, P5).
 *
 * Côté PILOTE : pendant une capture, le flux BLE (RaceBoxData) est relayé au
 * coach en broadcast, throttlé. Ici, uniquement la conversion déterministe (pas
 * d'I/O) : vitesse déjà en km/h, gLat = gForceY, gLong = gForceX (conventions
 * confirmées par captureFrameMapping), chrono = temps écoulé sur le tour courant.
 *
 * Le lap/secteur/virage viennent du CONTEXTE de capture (détection de tour). Le
 * relais ne fabrique rien : sans contexte, ces champs restent honnêtement nuls.
 */

import type { RaceBoxData } from '@/types/telemetry';

import type { LiveFrame } from './liveSessionLogic';

export interface RelayContext {
  /** Tour courant (1-indexé). */
  lap: number;
  /** Ms epoch du début du tour courant (pour le chrono). */
  lapStartMs: number;
  /** Ms epoch de maintenant. */
  nowMs: number;
  /** Secteur courant, si connu. */
  sector?: number | null;
  /** Virage en cours, si connu. */
  cornerIndex?: number | null;
  /** Virage signalé « à surveiller » (fait), si le contexte le sait. */
  cornerWatch?: boolean;
}

/** Convertit une trame RaceBox parsée en trame live throttlable. */
export function raceBoxToLiveFrame(data: RaceBoxData, ctx: RelayContext): LiveFrame {
  const chronoMs = Math.max(0, ctx.nowMs - ctx.lapStartMs);
  return {
    lap: ctx.lap,
    sector: ctx.sector ?? null,
    speedKmh: data.motion.speed, // déjà en km/h (cf. captureFrameMapping)
    gLat: data.imu.gForceY, // latéral = axe Y
    gLong: data.imu.gForceX, // longitudinal = axe X
    chronoMs,
    cornerIndex: ctx.cornerIndex ?? null,
    cornerWatch: ctx.cornerWatch ?? false,
    atMs: ctx.nowMs,
  };
}
