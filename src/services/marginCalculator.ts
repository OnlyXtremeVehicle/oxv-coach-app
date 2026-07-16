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
 * DONNÉE ABSENTE ≠ VALEUR NULLE (règle fondateur « données réelles ») :
 * chaque composante vaut `null` quand son entrée manque, et la marge
 * globale vaut `null` dès qu'une composante manque. Un trou ne se comble
 * jamais par une valeur par défaut : une session non close porte
 * `max_g_lateral = NULL`, et la lire comme « 0 g observé » produirait
 * « 100 % de marge » — le chiffre roi du bilan, faux et persisté à vie.
 * Les appelants filtrent avec `isMarginResolved()` et rendent « — ».
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

/** Sous-composantes 0..100. `null` = entrée absente, donc rien à dire. */
export interface MarginBreakdown {
  vehicle: number | null;
  pilot: number | null;
  regularity: number | null;
  smoothness: number | null;
}

export interface ComputeMarginInput {
  session: Pick<TelemetrySession, 'max_g_lateral'>;
  laps: Lap[];
  vehicle?: VehicleParameters;
}

export interface ComputeMarginOutput {
  marginGlobal: MarginPercent | null;
  marginZone: MarginZone | null;
  marginVehicle: number | null;
  marginPilot: number | null;
  breakdown: MarginBreakdown;
  /** Nombre de tours valides utilisés pour le calcul (hors outlap/inlap). */
  validLapCount: number;
}

/** Breakdown entièrement calculé — aucune composante absente. */
export interface ResolvedMarginBreakdown {
  vehicle: number;
  pilot: number;
  regularity: number;
  smoothness: number;
}

/**
 * Marge dont TOUTES les composantes sortent de données réelles. Seule forme
 * persistable (app_session_analyses) et affichable : le reste se rend « — ».
 */
export interface ResolvedMarginOutput extends ComputeMarginOutput {
  marginGlobal: MarginPercent;
  marginZone: MarginZone;
  marginVehicle: number;
  marginPilot: number;
  breakdown: ResolvedMarginBreakdown;
}

/**
 * Garde de type : la marge est-elle réellement calculable ?
 *
 * Le point d'entrée unique des appelants — figer une marge partielle en base
 * la rendrait définitive (upsert `onConflict`, jamais recalculé), et aucun
 * écran ne pourrait plus distinguer le chiffre réel de son bouche-trou.
 */
export function isMarginResolved(out: ComputeMarginOutput): out is ResolvedMarginOutput {
  return (
    out.marginGlobal !== null &&
    out.marginZone !== null &&
    out.marginVehicle !== null &&
    out.marginPilot !== null &&
    out.breakdown.vehicle !== null &&
    out.breakdown.pilot !== null &&
    out.breakdown.regularity !== null &&
    out.breakdown.smoothness !== null
  );
}

const VEHICLE_WEIGHT = 0.4;
const PILOT_WEIGHT = 0.6;

const REGULARITY_WEIGHT = 0.6;
const SMOOTHNESS_WEIGHT = 0.4;

export function computeMargin(input: ComputeMarginInput): ComputeMarginOutput {
  const vehicle = input.vehicle ?? DEFAULT_VEHICLE;

  const marginVehicle = computeVehicleMargin(input.session, vehicle);
  const pilot = computePilotMargin(input.laps);

  // Une composante absente ne se pondère pas : la somme 40/60 n'a de sens que
  // si ses deux termes existent. Sinon il n'y a pas de marge globale — et non
  // pas « une marge de 100 % ».
  const marginGlobal =
    marginVehicle !== null && pilot.marginPilot !== null
      ? clampMargin(VEHICLE_WEIGHT * marginVehicle + PILOT_WEIGHT * pilot.marginPilot)
      : null;

  return {
    marginGlobal,
    marginZone: marginGlobal !== null ? marginZoneOf(marginGlobal) : null,
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

/**
 * Marge véhicule, ou `null` si le G latéral maximum n'a pas été observé.
 *
 * `max_g_lateral` n'est écrit qu'à la CLÔTURE de la session (op `complete` de
 * la file de synchro) : tant qu'elle est en `recording`, la colonne est NULL.
 * Ce NULL dit « pas encore mesuré », pas « 0 g » — le confondre avec un zéro
 * réel donnait 100 % de marge à la séance la plus engagée.
 */
function computeVehicleMargin(
  session: Pick<TelemetrySession, 'max_g_lateral'>,
  vehicle: VehicleParameters
): number | null {
  // `== null` couvre aussi l'`undefined` : les lignes Supabase sont castées en
  // `TelemetrySession`, un SELECT partiel peut donc laisser la clé absente.
  const raw = session.max_g_lateral;
  if (raw == null) return null;
  const observedG = Number(raw);
  if (!Number.isFinite(observedG)) return null;
  if (observedG <= 0) return 100;
  if (vehicle.maxGLateral <= 0) return 0;
  const usage = observedG / vehicle.maxGLateral;
  return clampMargin((1 - usage) * 100);
}

interface PilotMarginResult {
  marginPilot: number | null;
  regularity: number | null;
  smoothness: number | null;
  validLapCount: number;
}

function computePilotMargin(laps: Lap[]): PilotMarginResult {
  const validLaps = laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);

  // Régularité et fluidité sont des DISPERSIONS : sous deux tours valides il
  // n'y a rien à disperser. Zéro tour n'est pas un pilote parfaitement régulier,
  // c'est une séance dont les tours ne sont pas (encore) là.
  if (validLaps.length < 2) {
    return {
      marginPilot: null,
      regularity: null,
      smoothness: null,
      validLapCount: validLaps.length,
    };
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
