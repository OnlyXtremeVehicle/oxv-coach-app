/**
 * OXV Key Moments (T-3, V4 §9) — moments SAILLANTS et FACTUELS d'une séance,
 * dérivés des tours et des segments. PUR (sans réseau), testable.
 *
 * Doctrine : des FAITS, jamais des consignes. « Le passage le plus engagé »
 * décrit une mesure (G latéral max) ; il ne dit pas quoi faire. Si la matière
 * manque, on renvoie moins de moments plutôt que d'en inventer.
 */

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

function fmtLap(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, '0')}`;
}

/** Dérive jusqu'à 3 moments factuels (référence, passage engagé, plus grand écart). */
export function computeKeyMoments(input: { laps: KMLap[]; segments: KMSegment[] }): KeyMoment[] {
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
      fact: `${top.segmentName ?? `Virage ${top.segmentIndex}`} — ${(top.maxGLateral as number).toFixed(2)} g d'appui latéral.`,
    });
  }

  if (valid.length >= 2) {
    const sorted = [...valid].sort((a, b) => a.lapNumber - b.lapNumber);
    let maxDelta = 0;
    let from = sorted[0];
    let to = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
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
