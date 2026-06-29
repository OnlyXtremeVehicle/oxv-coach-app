/**
 * OXV Trace — assemblage de la « Trace du jour » (V9 §6, livrable signature).
 *
 * La Trace du jour est l'ENTRÉE NARRATIVE post-séance : avant l'analyse
 * détaillée (Bilan / Data Lab), une lecture posée — « voici ce que votre séance
 * a laissé ». Logique PURE (sans réseau) → testable unitairement.
 *
 * Doctrine : des FAITS situés (soi contre soi), jamais un verdict ni une
 * consigne. Si la matière manque, la trace reste sobre plutôt qu'inventée. Le
 * ressenti appartient au pilote : l'app invite, ne rédige jamais le contenu.
 */

import type { ConfidenceLevel, DataConfidence } from './dataConfidenceLogic';
import type { KeyMoment } from './keyMomentsLogic';
import type { RegularityBand } from './regularityService';

export interface TraceOfDayParts {
  circuitName: string | null;
  /** Nombre de tours valides exploités. */
  lapCount: number;
  bestSeconds: number | null;
  spreadSeconds: number | null;
  band: RegularityBand | null;
  confidence: DataConfidence | null;
  keyMoments: KeyMoment[];
  /** Une note de carnet est-elle déjà rattachée à cette séance ? */
  hasRessenti: boolean;
  /** Rang de la séance dans le fil de ce circuit (1 = première). */
  sessionsHere: number;
}

export interface TraceOfDay {
  circuitName: string | null;
  /** Libellé de confiance de lecture (« Lecture complète » …), ou null. */
  qualityLabel: string | null;
  qualityLevel: ConfidenceLevel | null;
  bestSeconds: number | null;
  lapCount: number;
  /** Le moment-clé mis en avant (le plus saillant), ou null. */
  highlight: KeyMoment | null;
  /** Phrase sobre situant la séance (soi contre soi), jamais un jugement. */
  narrative: string;
  /** Invitation au ressenti, adaptée à l'existant. Jamais un contenu pré-rédigé. */
  ressentiPrompt: string;
  hasRessenti: boolean;
}

/** Ordinal français sobre : 1 → « 1ʳᵉ », n → « nᵉ ». */
function ordinal(n: number): string {
  return n <= 1 ? '1ʳᵉ' : `${n}ᵉ`;
}

/** Qualificatif neutre de la dispersion (jamais un « bon »/« mauvais »). */
function bandPhrase(band: RegularityBand | null): string | null {
  switch (band) {
    case 'resserré':
      return 'Des tours qui se ressemblent.';
    case 'régulier':
      return 'Une ligne stable, avec quelques respirations.';
    case 'dispersé':
      return 'Un large éventail — chaque tour raconte autre chose.';
    default:
      return null;
  }
}

/** Le moment que la trace retient : référence, à défaut passage engagé, sinon premier. */
function pickHighlight(moments: KeyMoment[]): KeyMoment | null {
  if (moments.length === 0) return null;
  return (
    moments.find((m) => m.key === 'reference') ??
    moments.find((m) => m.key === 'engaged') ??
    moments[0]
  );
}

function buildNarrative(parts: TraceOfDayParts): string {
  // Pas assez de tours pour situer : on reste sobre, sans inventer un fil.
  if (parts.lapCount < 2) {
    return 'Une séance posée. La trace s’écrit, tour après tour.';
  }
  const head =
    parts.sessionsHere <= 1
      ? 'Première trace sur ce circuit. Le fil commence ici.'
      : `Votre ${ordinal(parts.sessionsHere)} séance sur ce circuit.`;
  const tail = bandPhrase(parts.band);
  return tail ? `${head} ${tail}` : head;
}

export function assembleTraceOfDay(parts: TraceOfDayParts): TraceOfDay {
  return {
    circuitName: parts.circuitName,
    qualityLabel: parts.confidence?.label ?? null,
    qualityLevel: parts.confidence?.level ?? null,
    bestSeconds: parts.bestSeconds,
    lapCount: parts.lapCount,
    highlight: pickHighlight(parts.keyMoments),
    narrative: buildNarrative(parts),
    ressentiPrompt: parts.hasRessenti ? 'Votre ressenti est noté.' : 'Ajouter votre ressenti.',
    hasRessenti: parts.hasRessenti,
  };
}
