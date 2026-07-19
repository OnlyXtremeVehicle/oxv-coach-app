/**
 * equipementLogic — logique PURE de l'écran Équipement (V2-L2, 4/8).
 *
 * Regroupe les décisions sans état natif de l'écran de scan BLE :
 *   - la PHASE d'écran dérivée de l'état BLE (scan / trouvé / connexion /
 *     appairé / vide / erreur) — pilote la mise en scène (radar, cartes) ;
 *   - l'ORDRE d'affichage des boîtiers (le mien d'abord, puis le dernier
 *     appairé, puis les autres) — même règle que la v1, extraite pour test ;
 *   - le nom pilote (marque neutralisée) et le n° de série lus dans le nom
 *     d'usine BLE ;
 *   - le formatage du niveau de batterie ;
 *   - la GARDE du rappel Watch phase A (4 conditions, fail-closed).
 *
 * Aucune dépendance React / react-native / BLE : testable sous ts-jest/node.
 * Les services BLE (`bluetoothService`) restent INTACTS — ce module ne fait que
 * classer/formater ce qu'ils émettent.
 */

import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

// ---------------------------------------------------------------------------
// Phase d'écran
// ---------------------------------------------------------------------------

export type ScanPhase = 'scanning' | 'found' | 'connecting' | 'connected' | 'empty' | 'error';

export interface ScanPhaseInput {
  status: BleStatus;
  /** Nombre de boîtiers découverts à portée. */
  deviceCount: number;
  /** Message d'erreur courant (permissions, aucun boîtier…), ou null. */
  error: string | null;
  /** Une connexion est-elle en cours (sélection d'un boîtier) ? */
  connecting: boolean;
}

/**
 * Phase d'écran, par priorité décroissante :
 *   connected > connecting > error > (scanning : found|scanning) > found|empty.
 *
 * `connected` prime sur tout (l'appairage est acquis). Une connexion en cours
 * masque une erreur périmée. Hors scan et hors connexion, on distingue « des
 * boîtiers connus mais scan arrêté » (found) de « rien » (empty).
 */
export function deriveScanPhase({
  status,
  deviceCount,
  error,
  connecting,
}: ScanPhaseInput): ScanPhase {
  if (status === 'connected') return 'connected';
  if (connecting || status === 'connecting') return 'connecting';
  if (status === 'error' || error) return 'error';
  if (status === 'scanning') return deviceCount > 0 ? 'found' : 'scanning';
  return deviceCount > 0 ? 'found' : 'empty';
}

// ---------------------------------------------------------------------------
// Identité & ordre des boîtiers
// ---------------------------------------------------------------------------

/**
 * Le boîtier AFFECTÉ au pilote est reconnu par son serial contenu dans le nom
 * BLE d'usine (« RaceBox Mini S 1234567890 »). Insensible à la casse. Serial
 * absent → jamais « le mien ».
 */
export function isMyDevice(device: RaceBoxDevice, mySerial: string | null): boolean {
  return Boolean(mySerial && device.name.toLowerCase().includes(mySerial.toLowerCase()));
}

export interface DeviceRankInput {
  mySerial: string | null;
  lastPairedId: string | null;
}

/** Rang de tri : 0 = mon boîtier, 1 = dernier appairé, 2 = les autres. */
export function deviceRank(device: RaceBoxDevice, input: DeviceRankInput): number {
  if (isMyDevice(device, input.mySerial)) return 0;
  if (device.id === input.lastPairedId) return 1;
  return 2;
}

/** Boîtiers triés : le mien d'abord, puis le dernier appairé, puis les autres. */
export function orderDevices(
  devices: readonly RaceBoxDevice[],
  input: DeviceRankInput
): RaceBoxDevice[] {
  return [...devices].sort((a, b) => deviceRank(a, input) - deviceRank(b, input));
}

/** Badge de la carte boîtier, ou null. */
export function deviceBadge(device: RaceBoxDevice, input: DeviceRankInput): string | null {
  if (isMyDevice(device, input.mySerial)) return 'Votre boîtier';
  if (device.id === input.lastPairedId) return 'Dernier utilisé';
  return null;
}

/** Nom pilote : marque d'usine neutralisée (doctrine brand-neutral). */
export function displayDeviceName(bleName: string): string {
  return bleName.replace(/^RaceBox/i, 'OXV Mirror');
}

/**
 * N° de série lu en fin de nom d'usine (« RaceBox Mini S 1234567890 » →
 * « 1234567890 »). Renvoie null si aucune suite de chiffres exploitable.
 */
export function serialFromDeviceName(bleName: string): string | null {
  const match = /(\d{5,})\s*$/.exec(bleName.trim());
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Batterie
// ---------------------------------------------------------------------------

/** Niveau batterie borné 0..100 (entier) ; null si indisponible / non fini. */
export function clampBatteryLevel(level: number | null | undefined): number | null {
  if (level == null || !Number.isFinite(level)) return null;
  const rounded = Math.round(level);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

/** Libellé batterie pour le RollingCounter (« 87 » sans unité ; « — » si absent). */
export function formatBatteryValue(level: number | null): string {
  return level == null ? '—' : String(level);
}

// ---------------------------------------------------------------------------
// Rappel Watch phase A — garde fail-closed (4 conditions)
// ---------------------------------------------------------------------------

export interface WatchReminderInput {
  /** Drapeau `biometry` serveur activé ? (fail-closed : défaut false.) */
  biometryFlagOn: boolean;
  /** Consentement de CAPTURE cardio accordé ? */
  captureConsent: boolean;
  /**
   * Le pilote dispose-t-il d'une ceinture Polar (niveau 2, coachés) ? Si oui, la
   * FC vient de la ceinture, pas de la Watch — le rappel Watch est superflu.
   * En phase A la ceinture n'est jamais appairée (BIO-2 hors lot) : le screen
   * passe ici `isCoached` (les coachés reçoivent la ceinture au paddock).
   */
  hasPolarBelt: boolean;
  /** Plateforme iOS ? (HealthKit iOS-only en v1.) */
  isIOS: boolean;
}

/**
 * Rappel « Lancez un entraînement sur votre Watch » (phase A) : affiché
 * SEULEMENT si les quatre conditions sont réunies. Fail-closed par construction
 * (chaque booléen manquant est déjà false côté appelant). Aujourd'hui le
 * drapeau `biometry` est OFF → renvoie false → le rappel est absent.
 */
export function shouldOfferWatchReminder({
  biometryFlagOn,
  captureConsent,
  hasPolarBelt,
  isIOS,
}: WatchReminderInput): boolean {
  return biometryFlagOn && captureConsent && !hasPolarBelt && isIOS;
}
