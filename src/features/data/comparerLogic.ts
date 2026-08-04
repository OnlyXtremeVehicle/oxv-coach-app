/**
 * Comparateur L3 — cœur PUR de la mise en regard de deux séances (doctrine).
 * Sans React, sans react-native, sans Supabase : testable seul (ts-jest, node).
 *
 * DOCTRINE — une mise en regard SANS classement :
 *  - deux côtés strictement symétriques (`a` et `b`), aucun n'est désigné en
 *    tête ; l'ordre n'est que celui de la sélection à l'écran.
 *  - l'écart est rendu NEUTRE : un signe (« + » ou « - ») qui indique seulement
 *    le SENS de la différence, jamais un jugement, un rang ni une couleur.
 *  - une valeur absente reste absente (« — ») : on ne fabrique aucun chiffre, et
 *    l'écart vaut `null` dès qu'un des deux côtés manque.
 *
 * Aucune fonction de ce module ne renvoie quel côté « l'emporte ». Ce lexique
 * neutre est verrouillé par un test lexical (comparerLogic.test.ts) qui relit
 * cette source.
 */

import { formatChronoMs } from '@/utils/time';
import { virgule } from '@/utils/format';

/** Repère d'absence — une donnée non lue n'est jamais un zéro fabriqué. */
const EMPTY = '—';

/** Faits d'UN côté du comparateur (déjà normalisés par le hook d'écran). */
export interface SideFacts {
  /** Tour de référence, en millisecondes. */
  bestLapMs: number | null;
  /** Régularité, en pourcentage. */
  regularityPct: number | null;
  /** Vitesse maxi relevée, en km/h. */
  maxSpeedKmh: number | null;
  /** Distance parcourue, en kilomètres. */
  distanceKm: number | null;
}

/** Une ligne mise en regard : deux textes factuels + un écart signé neutre. */
export interface ComparedRow {
  key: string;
  label: string;
  /** Texte du côté `a` (« — » si absent). */
  aText: string;
  /** Texte du côté `b` (« — » si absent). */
  bText: string;
  /** Écart signé neutre `b − a`, ou `null` si un côté manque. */
  deltaText: string | null;
}

/**
 * Formate un nombre avec un signe explicite qui n'indique que le SENS de la
 * valeur : « + » pour positif, « - » pour négatif, « ± » pour zéro. Ne porte
 * aucun jugement : le signe est un fait, pas un verdict.
 *
 * Exemples :
 *   signedNumber(0.412, 3) → "+0.412"
 *   signedNumber(-3, 0)    → "-3"
 *   signedNumber(0, 0)     → "±0"
 */
export function signedNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return EMPTY;
  // Arrondi AVANT le signe pour éviter un « -0 » quand la valeur est négligeable.
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '±';
  return virgule(`${sign}${Math.abs(rounded).toFixed(decimals)}`);
}

/**
 * Formate un écart de temps (en millisecondes) en secondes signées.
 *
 * Exemple : formatDeltaMs(412) → "+0.412 s"
 */
export function formatDeltaMs(deltaMs: number): string {
  if (!Number.isFinite(deltaMs)) return EMPTY;
  return `${signedNumber(deltaMs / 1000, 3)} s`;
}

/** Construit une ligne : textes factuels de chaque côté + écart `b − a` neutre. */
function buildRow(
  key: string,
  label: string,
  aVal: number | null,
  bVal: number | null,
  format: (v: number) => string,
  formatDelta: (delta: number) => string
): ComparedRow {
  const aOk = aVal !== null && Number.isFinite(aVal);
  const bOk = bVal !== null && Number.isFinite(bVal);
  return {
    key,
    label,
    aText: aOk ? format(aVal as number) : EMPTY,
    bText: bOk ? format(bVal as number) : EMPTY,
    // Écart seulement si les DEUX côtés sont lus — sinon `null` (rendu « — »).
    deltaText: aOk && bOk ? formatDelta((bVal as number) - (aVal as number)) : null,
  };
}

/** Distance en km, virgule décimale française : 12.4 → "12,4 km". */
function formatKm(v: number): string {
  return `${v.toFixed(1).replace('.', ',')} km`;
}

/**
 * Met deux jeux de faits en regard, ligne par ligne. Les deux côtés sont
 * symétriques ; l'écart n'est qu'un signe orienté `b − a`, sans vainqueur.
 */
export function compareFacts(a: SideFacts, b: SideFacts): ComparedRow[] {
  return [
    buildRow(
      'bestLap',
      'Tour de référence',
      a.bestLapMs,
      b.bestLapMs,
      (v) => formatChronoMs(v),
      (delta) => formatDeltaMs(delta)
    ),
    buildRow(
      'regularity',
      'Régularité',
      a.regularityPct,
      b.regularityPct,
      (v) => `${Math.round(v)} %`,
      (delta) => `${signedNumber(delta, 0)} %`
    ),
    buildRow(
      'maxSpeed',
      'Vitesse maxi',
      a.maxSpeedKmh,
      b.maxSpeedKmh,
      (v) => `${Math.round(v)} km/h`,
      (delta) => `${signedNumber(delta, 0)} km/h`
    ),
    buildRow(
      'distance',
      'Distance',
      a.distanceKm,
      b.distanceKm,
      (v) => formatKm(v),
      (delta) => `${signedNumber(delta, 1).replace('.', ',')} km`
    ),
  ];
}
