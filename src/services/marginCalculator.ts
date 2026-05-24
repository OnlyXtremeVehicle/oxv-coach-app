/**
 * Calcul de la marge composite — V1 simplifié.
 *
 * Doctrine OXV : "L'app est un miroir, pas un coach." Le chiffre doit
 * être honnête, ni optimiste ni pessimiste. La marge représente le
 * potentiel non utilisé du couple véhicule/pilote, sans jugement de
 * valeur sur le pilotage observé.
 *
 * V1 simplifié — pas de Kalman, pas de Pacejka complet :
 *   - Marge véhicule : (1 - G_lat_observé / G_lat_max) × 100
 *   - Marge pilote   : combinaison régularité (stddev temps au tour)
 *                      + smoothness (stddev des G_lat par tour)
 *   - Marge globale  : 40% véhicule + 60% pilote
 *
 * Le pilote pèse plus que le véhicule dans la formule V1 — c'est le
 * pilote qu'on évalue, pas la voiture. Les améliorations V2 ajouteront
 * le transfert de charge dynamique (sec. 7 des algos), la stabilité
 * dynamique (sec. 8), et la marge par virage (sec. 5).
 *
 * Voir docs/architecture/02_PARTIE_2_algorithmes.md, sections 7-8.
 */

import { marginZoneOf, type MarginPercent, type MarginZone } from '@/types/domain';
import type { Lap, TelemetrySession } from '@/types/telemetry';

export interface VehicleParameters {
  /** Limite latérale typique du véhicule, en g. */
  maxGLateral: number;
}

/** Profil "route sportive" par défaut — calibration GT3 à venir en V2. */
export const DEFAULT_VEHICLE: VehicleParameters = {
  maxGLateral: 1.0,
};

export interface MarginBreakdown {
  vehicle: number;
  pilot: number;
  regularity: number;
  smoothness: number;
}

export interface ComputeMarginInput {
  session: Pick<TelemetrySession, 'max_g_lateral'>;
  laps: Lap[];
  vehicle?: VehicleParameters;
}

export interface ComputeMarginOutput {
  marginGlobal: MarginPercent;
  marginZone: MarginZone;
  marginVehicle: number;
  marginPilot: number;
  breakdown: MarginBreakdown;
  /** Nombre de tours valides utilisés pour le calcul (hors outlap/inlap). */
  validLapCount: number;
}

const VEHICLE_WEIGHT = 0.4;
const PILOT_WEIGHT = 0.6;

const REGULARITY_WEIGHT = 0.6;
const SMOOTHNESS_WEIGHT = 0.4;

export function computeMargin(input: ComputeMarginInput): ComputeMarginOutput {
  const vehicle = input.vehicle ?? DEFAULT_VEHICLE;

  const marginVehicle = computeVehicleMargin(input.session, vehicle);
  const pilot = computePilotMargin(input.laps);

  const marginGlobal = clampMargin(
    VEHICLE_WEIGHT * marginVehicle + PILOT_WEIGHT * pilot.marginPilot
  );

  return {
    marginGlobal,
    marginZone: marginZoneOf(marginGlobal),
    marginVehicle,
    marginPilot: pilot.marginPilot,
    breakdown: {
      vehicle: marginVehicle,
      pilot: pilot.marginPilot,
      regularity: pilot.regularity,
      smoothness: pilot.smoothness,
    },
    validLapCount: pilot.validLapCount,
  };
}

function computeVehicleMargin(
  session: Pick<TelemetrySession, 'max_g_lateral'>,
  vehicle: VehicleParameters
): number {
  const observedG = Number(session.max_g_lateral ?? 0);
  if (observedG <= 0) return 100;
  if (vehicle.maxGLateral <= 0) return 0;
  const usage = observedG / vehicle.maxGLateral;
  return clampMargin((1 - usage) * 100);
}

interface PilotMarginResult {
  marginPilot: number;
  regularity: number;
  smoothness: number;
  validLapCount: number;
}

function computePilotMargin(laps: Lap[]): PilotMarginResult {
  const validLaps = laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);

  if (validLaps.length < 2) {
    return { marginPilot: 100, regularity: 100, smoothness: 100, validLapCount: validLaps.length };
  }

  const regularity = computeRegularity(validLaps.map((l) => l.duration_seconds));
  const smoothness = computeSmoothness(validLaps.map((l) => Number(l.max_g_lateral ?? 0)));

  const marginPilot = clampMargin(REGULARITY_WEIGHT * regularity + SMOOTHNESS_WEIGHT * smoothness);

  return { marginPilot, regularity, smoothness, validLapCount: validLaps.length };
}

/**
 * Régularité : stddev des temps au tour, mappé sur [0, 100].
 * stddev ≤ 1s → 100 (parfaitement régulier)
 * stddev = 5s → 0 (très irrégulier)
 */
function computeRegularity(lapSecondsList: number[]): number {
  const stddev = standardDeviation(lapSecondsList);
  return clampMargin(100 - Math.max(0, stddev - 1) * 25);
}

/**
 * Smoothness : stddev des G_lat max par tour, mappé sur [0, 100].
 * stddev ≤ 0.05 g → 100 (transitions très constantes)
 * stddev ≥ 0.55 g → 0 (transitions très variables)
 */
function computeSmoothness(gLatPerLap: number[]): number {
  const stddev = standardDeviation(gLatPerLap);
  return clampMargin(100 - Math.max(0, stddev - 0.05) * 200);
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clampMargin(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
