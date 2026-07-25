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
import { rrTrendLabel, type BioSample } from '@/services/v2/biometryBufferLogic';

import type { BiometryLiveEvent, LiveFrame } from './liveSessionLogic';

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

/** Réglages de la construction de l'événement biométrique live. */
export interface BiometryEventOpts {
  /** Fenêtre « récente » pour la moyenne glissante FC (défaut 2 s). */
  windowMs?: number;
  /** Fenêtre de référence pour la tendance R-R (défaut 60 s). */
  baselineMs?: number;
}

/**
 * Construit l'événement biométrique live (BIO-2) — PUR, déterministe, sans I/O.
 *
 * À partir d'un tampon d'échantillons cardio horodatés, produit un événement
 * FACTUEL destiné AU SEUL canal coach :
 *   - `hrBpm`   : FC MOYENNE sur la fenêtre récente (défaut 2 s), arrondie au bpm.
 *   - `rrTrend` : constat de variabilité (fermé à 3 libellés) comparant la
 *     dispersion R-R récente à une fenêtre de référence ANTÉRIEURE (défaut 60 s,
 *     hors fenêtre récente). Données insuffisantes → 'stable' (jamais inventé).
 *   - `contact` : état du capteur au dernier échantillon récent (fait courant).
 *   - `atMs`    : horodatage de l'événement (= nowMs).
 *
 * Retourne `null` — honnêtement, jamais une valeur fabriquée — si le tampon est
 * vide, s'il n'y a AUCUN échantillon dans la fenêtre récente, ou si aucune FC
 * exploitable n'y figure. La moyenne évite au coach de réagir à un pic isolé ;
 * elle ne juge rien, elle décrit.
 */
export function buildBiometryEvent(
  samples: BioSample[],
  nowMs: number,
  opts?: BiometryEventOpts
): BiometryLiveEvent | null {
  if (!Array.isArray(samples) || samples.length === 0) return null;

  const windowMs = opts?.windowMs != null && opts.windowMs > 0 ? opts.windowMs : 2000;
  const baselineMs = opts?.baselineMs != null && opts.baselineMs > 0 ? opts.baselineMs : 60000;

  const recentFrom = nowMs - windowMs;
  const recent = samples.filter(
    (s) => Number.isFinite(s.ts) && s.ts >= recentFrom && s.ts <= nowMs
  );
  if (recent.length === 0) return null; // rien de récent → pas d'événement

  // FC moyenne sur la fenêtre récente (bpm entier). On ignore les valeurs non
  // exploitables (0 ou non finies) plutôt que de les moyenner à tort.
  let sumHr = 0;
  let nHr = 0;
  for (const s of recent) {
    if (Number.isFinite(s.hrBpm) && s.hrBpm > 0) {
      sumHr += s.hrBpm;
      nHr += 1;
    }
  }
  if (nHr === 0) return null; // aucune FC exploitable dans la fenêtre
  const hrBpm = Math.round(sumHr / nHr);

  // Contact : état du plus récent échantillon de la fenêtre (fait courant).
  let latest = recent[0];
  for (const s of recent) {
    if (s.ts >= latest.ts) latest = s;
  }
  const contact = latest.contact;

  // Tendance R-R : dispersion récente (fenêtre) vs référence ANTÉRIEURE
  // [baselineFrom, recentFrom) — « récent vs plus tôt », déterministe.
  const baselineFrom = nowMs - baselineMs;
  const recentRr: number[] = [];
  for (const s of recent) recentRr.push(...s.rrMs);
  const baselineRr: number[] = [];
  for (const s of samples) {
    if (Number.isFinite(s.ts) && s.ts >= baselineFrom && s.ts < recentFrom) {
      baselineRr.push(...s.rrMs);
    }
  }
  const rrTrend = rrTrendLabel(recentRr, baselineRr);

  return { hrBpm, rrTrend, contact, atMs: nowMs };
}
