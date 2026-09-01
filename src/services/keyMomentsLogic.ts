/**
 * OXV Key Moments (T-3, V4 §9) — moments SAILLANTS et FACTUELS d'une séance,
 * dérivés des tours et des segments. PUR (sans réseau), testable.
 *
 * Doctrine : des FAITS, jamais des consignes. « Le passage le plus engagé »
 * décrit une mesure (G latéral max) ; il ne dit pas quoi faire. Si la matière
 * manque, on renvoie moins de moments plutôt que d'en inventer.
 */

import { virgule } from '@/utils/format';

export interface KMLap {
  lapNumber: number;
  durationSeconds: number;
  isOutlap?: boolean | null;
  isInlap?: boolean | null;
}

export interface KMSegment {
  segmentIndex: number;
  segmentName: string | null;
  maxGLateral: number | null;
}

export interface KeyMoment {
  key: string;
  title: string;
  fact: string;
}

/** Chrono M:SS.mmm — arrondi AVANT découpage (119,9996 s → 2:00.000, jamais 1:60.000). */
function fmtLap(s: number): string {
  const totalMs = Math.round(s * 1000);
  const m = Math.floor(totalMs / 60_000);
  const r = (totalMs % 60_000) / 1000;
  return virgule(`${m}:${r.toFixed(3).padStart(6, '0')}`);
}

/**
 * L'APPUI MAXIMUM DE LA SÉANCE, QUAND AUCUN SEGMENT NE LE PORTE.
 *
 * « Le passage le plus engagé » exigeait une ligne de `app_segment_analyses` :
 * un G latéral ET un segment pour le situer. Cette table est vide sur toute
 * séance réelle, et le moment disparaissait — alors que `telemetry_sessions`
 * porte `max_g_lateral` depuis la capture. Sur la séance de référence, la base
 * dit 0,62 g et l'écran ne disait rien.
 *
 * On sépare donc les deux faits. La VALEUR est mesurée et s'affiche. Le LIEU ne
 * l'est pas sans segment : on ne l'invente pas, et le titre cesse de le
 * promettre — « le passage » devient « l'appui ».
 */
function momentAppuiMaximum(gLateralMax: number | null | undefined): KeyMoment | null {
  if (typeof gLateralMax !== 'number' || !Number.isFinite(gLateralMax) || gLateralMax <= 0) {
    return null;
  }
  return {
    key: 'engaged',
    title: 'L’appui latéral maximum',
    fact: virgule(`${gLateralMax.toFixed(2)} g. Position non mesurée.`),
  };
}

/** Dérive jusqu'à 3 moments factuels (référence, passage engagé, plus grand écart). */
export function computeKeyMoments(input: {
  laps: KMLap[];
  segments: KMSegment[];
  /**
   * `telemetry_sessions.max_g_lateral` — le maximum de la séance entière, écrit
   * par la capture. Il sert de repli quand aucun segment n'est analysé : la
   * valeur est mesurée, seule sa position manque.
   */
  gLateralMaxSeance?: number | null;
}): KeyMoment[] {
  const moments: KeyMoment[] = [];
  const valid = input.laps.filter((l) => !l.isOutlap && !l.isInlap && l.durationSeconds > 0);

  if (valid.length > 0) {
    const best = valid.reduce((m, l) => (l.durationSeconds < m.durationSeconds ? l : m));
    moments.push({
      key: 'reference',
      title: 'Votre tour de référence',
      fact: `Tour ${best.lapNumber} — ${fmtLap(best.durationSeconds)}.`,
    });
  }

  const withG = input.segments.filter((s) => s.maxGLateral != null && s.maxGLateral > 0);
  if (withG.length > 0) {
    const top = withG.reduce((m, s) => ((s.maxGLateral ?? 0) > (m.maxGLateral ?? 0) ? s : m));
    moments.push({
      key: 'engaged',
      title: 'Le passage le plus engagé',
      fact: `${top.segmentName ?? `Virage ${top.segmentIndex}`} — ${(top.maxGLateral as number).toFixed(2).replace('.', ',')} g d'appui latéral.`,
    });
  } else {
    // Aucun segment analysé : la valeur reste lisible, le lieu non.
    const appui = momentAppuiMaximum(input.gLateralMaxSeance);
    if (appui !== null) moments.push(appui);
  }

  if (valid.length >= 2) {
    const sorted = [...valid].sort((a, b) => a.lapNumber - b.lapNumber);
    let maxDelta = 0;
    let from = sorted[0];
    let to = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      // Uniquement des tours PHYSIQUEMENT consécutifs : un écart qui enjambe un
      // arrêt au stand (in/out-lap intermédiaire) n'est pas une variation de rythme.
      if (sorted[i].lapNumber !== sorted[i - 1].lapNumber + 1) continue;
      const d = Math.abs(sorted[i].durationSeconds - sorted[i - 1].durationSeconds);
      if (d > maxDelta) {
        maxDelta = d;
        from = sorted[i - 1];
        to = sorted[i];
      }
    }
    if (maxDelta >= 0.1) {
      moments.push({
        key: 'variation',
        title: 'L’écart le plus net',
        fact: `${maxDelta.toFixed(1).replace('.', ',')} s entre les tours ${from.lapNumber} et ${to.lapNumber}.`,
      });
    }
  }

  return moments;
}
