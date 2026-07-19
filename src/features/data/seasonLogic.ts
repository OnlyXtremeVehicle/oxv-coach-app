/**
 * Agrégats de saison L3 — cœur PUR (sans React, sans réseau, sans Supabase),
 * testable seul (ts-jest, node).
 *
 * DOCTRINE — des FAITS sur SOI, jamais un rang ni un palmarès :
 *  - la courbe de progression et l'histogramme de régularité décrivent la
 *    trajectoire du pilote contre lui-même ; aucun classement, aucun autre
 *    pilote.
 *  - rien n'est fabriqué : une entrée sans chrono est écartée (jamais un zéro
 *    inventé), et le « % de tours à moins d'une seconde » vaut `null` faute de
 *    tour plutôt que 0.
 */

import { formatChronoMs } from '@/utils/time';

// ---------------------------------------------------------------------------
// Courbe du tour de référence — progression chronologique (piste dorée).
// ---------------------------------------------------------------------------

/**
 * Ne garde que les séances dont le tour de référence est réel et les trie du
 * plus ancien au plus récent (axe du temps). Les entrées sans chrono sont
 * écartées : on ne trace pas un point qui n'existe pas.
 */
export function bestLapCurve(
  sessions: { startedAt: string; bestLapMs: number | null }[]
): { startedAt: string; bestLapMs: number }[] {
  return sessions
    .filter(
      (s): s is { startedAt: string; bestLapMs: number } =>
        s.bestLapMs !== null && Number.isFinite(s.bestLapMs)
    )
    .sort((x, y) => new Date(x.startedAt).getTime() - new Date(y.startedAt).getTime());
}

// ---------------------------------------------------------------------------
// Histogramme de régularité — distribution des écarts au tour de référence.
// ---------------------------------------------------------------------------

/** Un seau de l'histogramme : borne basse incluse, borne haute exclue (secondes). */
export interface HistogramBucket {
  loSec: number;
  hiSec: number;
  count: number;
}

export interface RegularityHistogram {
  buckets: HistogramBucket[];
  /** Part FACTUELLE des tours à ≤ 1 s du tour de référence ; `null` sans tour. */
  withinOneSecPct: number | null;
}

/** Bornes fixes des seaux, en secondes d'écart au tour de référence. */
const BUCKET_EDGES: readonly { loSec: number; hiSec: number }[] = [
  { loSec: 0, hiSec: 0.5 },
  { loSec: 0.5, hiSec: 1 },
  { loSec: 1, hiSec: 2 },
  { loSec: 2, hiSec: 5 },
  { loSec: 5, hiSec: Infinity },
];

/**
 * Distribue l'écart de chaque tour au tour de référence (`lap − best`, en
 * secondes) dans des seaux fixes, et calcule la part des tours à moins d'une
 * seconde. Aucun classement : une distribution de SOI.
 *
 * Robustesse : les valeurs non finies sont ignorées ; un écart négatif (tour
 * sous la référence fournie) tombe dans le premier seau ; sans tour lisible,
 * `withinOneSecPct` vaut `null`.
 */
export function regularityHistogram(lapMs: number[], bestMs: number): RegularityHistogram {
  const buckets: HistogramBucket[] = BUCKET_EDGES.map((e) => ({ ...e, count: 0 }));
  const valid = lapMs.filter((v) => Number.isFinite(v));

  if (valid.length === 0 || !Number.isFinite(bestMs)) {
    return { buckets, withinOneSecPct: null };
  }

  let within = 0;
  for (const ms of valid) {
    const gapSec = (ms - bestMs) / 1000;
    // Un tour sous la référence est ramené au premier seau (écart nul plancher).
    const g = gapSec < 0 ? 0 : gapSec;
    const idx = buckets.findIndex((b) => g >= b.loSec && g < b.hiSec);
    if (idx >= 0) buckets[idx].count += 1;
    if (gapSec <= 1) within += 1;
  }

  // Arrondi au dixième de pour-cent — un fait mesuré, pas un rang.
  const withinOneSecPct = Math.round((within / valid.length) * 1000) / 10;
  return { buckets, withinOneSecPct };
}

// ---------------------------------------------------------------------------
// Cellules de statistiques pilote — formatage de passage (passthrough).
// ---------------------------------------------------------------------------

export type PilotStatKind = 'count' | 'chrono' | 'speed' | 'distance' | 'pct';

/** Une statistique déjà calculée, à formater pour l'affichage. */
export interface PilotStatInput {
  key: string;
  label: string;
  value: number | null;
  kind: PilotStatKind;
}

/** Une cellule prête à afficher (valeur formatée, « — » si absente). */
export interface PilotStatCell {
  key: string;
  label: string;
  value: string;
}

/** Formate une valeur selon sa nature ; une valeur absente reste « — ». */
function formatStat(value: number | null, kind: PilotStatKind): string {
  if (value === null || !Number.isFinite(value)) return '—';
  switch (kind) {
    case 'count':
      return String(Math.round(value));
    case 'chrono':
      return formatChronoMs(value);
    case 'speed':
      return `${Math.round(value)} km/h`;
    case 'distance':
      return `${value.toFixed(1).replace('.', ',')} km`;
    case 'pct':
      return `${Math.round(value)} %`;
    default:
      return '—';
  }
}

/**
 * Passe une liste de statistiques déjà calculées en cellules affichables. Pur
 * formatage : ne classe rien, n'invente rien, ne réordonne rien.
 */
export function pilotStatCells(stats: readonly PilotStatInput[]): PilotStatCell[] {
  return stats.map((s) => ({ key: s.key, label: s.label, value: formatStat(s.value, s.kind) }));
}
