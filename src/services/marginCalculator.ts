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
 * Même règle pour la FLUIDITÉ, sur `laps.max_g_lateral` : les tours sans
 * mesure sont écartés, et sous deux tours mesurés la fluidité vaut `null`.
 * Conséquence ASSUMÉE : les séances captées AVANT l'écriture de cette colonne
 * (cf. captureSessionService) n'ont pas de marge et se rendent « — ». On
 * préfère le silence honnête au chiffre inventé ; on ne les rattrape pas.
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

/**
 * Sous-composantes 0..100. `null` = entrée absente, donc rien à dire.
 *
 * ===========================================================================
 * `consistency` S'APPELAIT `regularity` JUSQU'AU 13/08/2026 — UN HOMONYME PIÉGÉ
 * ===========================================================================
 *
 * `app_session_analyses` porte deux colonnes voisines, `qdi` et
 * `margin_breakdown`. Sur la séance de Bouteville du 13/08, LA MÊME LIGNE
 * disait :
 *
 *     qdi.regularite              = 34
 *     margin_breakdown.regularity = 0
 *
 * ---------------------------------------------------------------------------
 * CE QUE J'AI ÉCRIT ICI LE 13/08 AU SOIR ÉTAIT FAUX, ET CORRIGÉ LE LENDEMAIN
 * ---------------------------------------------------------------------------
 *
 * J'avais écrit : *« deux mesures qui n'ont rien à voir — le QDI mesure la
 * constance du geste, la marge la dispersion des temps au tour »*. **Non.**
 *
 * `qdiLogic.computeRegularite` reçoit `laps.map((l) => l.durationSeconds)`.
 * Les deux partent des MÊMES temps au tour. Ce n'est pas une homonymie entre
 * deux grandeurs : c'est **une seule grandeur, calculée deux fois, par deux
 * formules qui ne s'accordent pas**.
 *
 *     QDI    — coefficient de variation (écart-type / moyenne), noté sur
 *              [0 ; 6 %] ;
 *     marge  — écart-type ABSOLU en secondes, pénalisé de 25 points par
 *              seconde au-delà d'une seconde.
 *
 * Reproduit sur les trois tours réels de Bouteville — 360,485 · 327,542 ·
 * 339,483 s :
 *
 *     moyenne 342,503 s · écart-type 13,617 s · coef. de variation 3,98 %
 *     → QDI 34    ·    marge 0
 *
 * Les deux valeurs de la base sortent à l'unité près. Le renommage reste juste
 * — deux formules d'une même grandeur doivent porter deux noms — mais le motif
 * n'était pas celui que j'avais écrit.
 *
 * Cette confusion-là ne se voit pas. Personne ne la remarque tant qu'il n'ouvre
 * pas les deux colonnes côte à côte — et le jour où quelqu'un le fait, il
 * cherche un bug là où il y a un désaccord de calibration.
 *
 * ---------------------------------------------------------------------------
 * ET LA CALIBRATION DE LA MARGE EST DIMENSIONNELLEMENT FAUSSE
 * ---------------------------------------------------------------------------
 *
 * Le seuil de `computeConsistency` est ABSOLU : une seconde, quelle que soit la
 * longueur du tour. Il atteint zéro à cinq secondes d'écart-type.
 *
 * Sur un tour de kart de 60 s, cinq secondes d'écart-type, c'est 8 % — un
 * pilotage effectivement dispersé. Sur les tours de 5 min 42 de Bouteville,
 * c'est **1,5 %**, c'est-à-dire une régularité remarquable, et la formule la
 * note zéro. Elle compare un temps à un seuil sans le rapporter à la durée du
 * tour.
 *
 * **Ce n'est pas corrigé ici, et c'est délibéré.** `consistency` pèse 0,6 de la
 * marge pilote, qui pèse 0,6 de `margin_global` — LE chiffre central du
 * produit. Le passer en relatif ferait passer Bouteville de 39 à 51, et ce
 * n'est pas à moi de déplacer le seul chiffre que l'écran affiche. Porté au
 * registre fondateur (§ 0.9) avec la reproduction.
 *
 * Le renommage porte sur les TROIS endroits, sans quoi il n'en corrige aucun :
 * le calcul ici, l'écrivain serveur (`cron-analyze-pending-sessions`, qui
 * réintroduirait la clé au prochain passage s'il n'était pas redéployé), et
 * les quatorze lignes déjà écrites.
 */
export interface MarginBreakdown {
  vehicle: number | null;
  pilot: number | null;
  consistency: number | null;
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
  consistency: number;
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
    out.breakdown.consistency !== null &&
    out.breakdown.smoothness !== null
  );
}

const VEHICLE_WEIGHT = 0.4;
const PILOT_WEIGHT = 0.6;

const CONSISTENCY_WEIGHT = 0.6;
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
      consistency: pilot.consistency,
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
  consistency: number | null;
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
      consistency: null,
      smoothness: null,
      validLapCount: validLaps.length,
    };
  }

  const consistency = computeConsistency(validLaps.map((l) => l.duration_seconds));
  const smoothness = computeSmoothness(validLaps);

  // Même arbitrage que la marge globale : une composante absente ne se pondère
  // pas. La régularité, elle, reste RÉELLE (les temps au tour sont mesurés) et
  // continue d'être exposée dans le breakdown — mais elle ne peut pas tenir lieu
  // de marge pilote à elle seule.
  const marginPilot =
    smoothness !== null
      ? clampMargin(CONSISTENCY_WEIGHT * consistency + SMOOTHNESS_WEIGHT * smoothness)
      : null;

  return { marginPilot, consistency, smoothness, validLapCount: validLaps.length };
}

/**
 * Constance : écart-type des temps au tour, mappé sur [0, 100].
 * écart-type ≤ 1 s → 100 · écart-type ≥ 5 s → 0.
 *
 * ---------------------------------------------------------------------------
 * CE SEUIL EST ABSOLU, ET C'EST LE DÉFAUT — vu le 14/08/2026, NON corrigé ici
 * ---------------------------------------------------------------------------
 *
 * Une seconde, cinq secondes : les mêmes bornes quelle que soit la longueur du
 * tour. Or un écart-type ne se lit qu'en proportion de ce qu'il disperse.
 *
 *   tour de kart, 60 s      → 5 s d'écart-type = 8 %   → « dispersé », vrai ;
 *   tour de Bouteville, 342 s → 5 s d'écart-type = 1,5 % → remarquable, et
 *                               cette formule le note ZÉRO.
 *
 * Sur la seule séance réelle de la base, elle rend 0 là où le QDI — qui part
 * des MÊMES temps, en coefficient de variation — rend 34. Les deux ont été
 * reproduits à l'unité (voir l'en-tête de `MarginBreakdown`).
 *
 * Le correctif tient en une ligne : diviser par la moyenne avant de comparer.
 * Il n'est PAS appliqué parce que `consistency` pèse 0,6 de la marge pilote,
 * elle-même 0,6 de `margin_global` — le seul chiffre que l'écran affiche.
 * Bouteville passerait de 39 à 51. Déplacer le chiffre central du produit n'est
 * pas une correction de bord : c'est au fondateur (registre § 0.9).
 */
function computeConsistency(lapSecondsList: number[]): number {
  const stddev = standardDeviation(lapSecondsList);
  return clampMargin(100 - Math.max(0, stddev - 1) * 25);
}

/**
 * Smoothness : stddev des G_lat max par tour, mappé sur [0, 100], ou `null`
 * quand moins de DEUX tours portent une mesure.
 * stddev ≤ 0.05 g → 100 (transitions très constantes)
 * stddev ≥ 0.55 g → 0 (transitions très variables)
 *
 * Les tours SANS mesure sont écartés, jamais convertis en 0 g. Le `?? 0` d'avant
 * était la dernière fabrication du write-path : `laps.max_g_lateral` n'était
 * écrit par personne, tous les tours entraient donc à 0, l'écart-type valait 0,
 * et la fluidité sortait à 100 sur 100 % des séances réelles — ~24 % de la marge
 * globale (0,6 × 0,4) adossés à rien. Une dispersion de zéros identiques n'est
 * pas un pilotage d'une constance parfaite : c'est une absence de données.
 */
function computeSmoothness(laps: Lap[]): number | null {
  const measured = laps
    .map((l) => toFiniteNumber(l.max_g_lateral))
    .filter((v): v is number => v !== null);
  // Une dispersion demande deux points. Sous ce seuil il n'y a rien à dire —
  // et surtout pas « 100 ».
  if (measured.length < 2) return null;
  const stddev = standardDeviation(measured);
  return clampMargin(100 - Math.max(0, stddev - 0.05) * 200);
}

/**
 * Nombre exploitable, ou `null`. Couvre l'`undefined` (SELECT partiel casté en
 * `Lap`), le NULL de base, et une valeur corrompue — un trou, quelle qu'en soit
 * la forme, ne devient jamais une valeur.
 */
function toFiniteNumber(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
