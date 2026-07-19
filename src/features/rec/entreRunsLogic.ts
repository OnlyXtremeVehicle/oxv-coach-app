/**
 * entreRunsLogic — logique PURE de l'écran ENTRE-RUNS (V2-L2, spec 7/8).
 *
 * Zéro I/O, zéro React : testable sous ts-jest node
 * (__tests__/entreRunsLogic.test.ts). L'écran `app/(app2)/rec/entre-runs.tsx`
 * orchestre les services v1 (getMyNextTrackDay, addNote), lit useSessionStore
 * et le MMKV, et délègue CHAQUE décision à ce module.
 *
 * Règle fondateur « données réelles câblées » : une valeur absente reste
 * absente (Dial masqué, « — »), jamais un compte fabriqué. Le cadran du break
 * ne s'affiche QUE pour un vrai départ, aujourd'hui et à venir (même source
 * que la v1 : sessions.start_time du site via nextTrackDayService).
 *
 * Réutilise la géométrie de cadran du kit (shellLogic, déjà testée sous node)
 * pour ne pas dupliquer le mapping valeur → angle/arc.
 */

import { dialNeedleAngleDeg, dialProgress } from '@/ui/v2/shellLogic';

// ---------------------------------------------------------------------------
// Compte à rebours du break — LE cadran
// ---------------------------------------------------------------------------

/**
 * Échelle VISUELLE du cadran (45 min) : sert uniquement à mapper le temps
 * restant sur l'arc et l'aiguille. Ce n'est pas une donnée de break (aucun
 * break réel n'est mesuré) — le chiffre affiché reste le mm:ss RÉEL, seul le
 * remplissage de l'arc est borné à cette échelle.
 */
export const BREAK_DIAL_MAX_MS = 45 * 60 * 1000;

export interface BreakCountdown {
  /** Le cadran s'affiche-t-il ? Faux → aucun cadran (jamais un compte fabriqué). */
  show: boolean;
  /** Millisecondes restantes avant le prochain départ (0 si masqué). */
  remainingMs: number;
  /** Chiffre roi du centre : « mm:ss ». */
  label: string;
  /** Progression 0..1 de l'arc (restant borné à l'échelle). */
  progress: number;
  /** Angle de l'aiguille (convention cadran, 0° = midi). */
  needleDeg: number;
}

/** Même jour calendaire LOCAL ? (le rebours ne s'affiche que pour aujourd'hui). */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Formate un délai en « m:ss » (minutes non paddées, secondes sur 2 chiffres). */
export function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const HIDDEN_COUNTDOWN: BreakCountdown = {
  show: false,
  remainingMs: 0,
  label: '0:00',
  progress: 0,
  needleDeg: dialNeedleAngleDeg(0, BREAK_DIAL_MAX_MS),
};

/**
 * Compte à rebours du prochain départ. Affiché SEULEMENT si le départ est
 * connu, tombe sur le jour local courant, et est encore à venir. Sinon
 * `show=false` — le cadran est masqué (règle données réelles).
 */
export function computeBreakCountdown(nextStartMs: number | null, nowMs: number): BreakCountdown {
  if (nextStartMs === null || !Number.isFinite(nextStartMs)) return HIDDEN_COUNTDOWN;
  if (!isSameLocalDay(new Date(nextStartMs), new Date(nowMs))) return HIDDEN_COUNTDOWN;
  const remaining = nextStartMs - nowMs;
  if (remaining <= 0) return HIDDEN_COUNTDOWN;
  const clamped = Math.min(remaining, BREAK_DIAL_MAX_MS);
  return {
    show: true,
    remainingMs: remaining,
    label: formatMmSs(remaining),
    progress: dialProgress(clamped, BREAK_DIAL_MAX_MS),
    needleDeg: dialNeedleAngleDeg(clamped, BREAK_DIAL_MAX_MS),
  };
}

// ---------------------------------------------------------------------------
// Meilleur tour du JOUR + célébration (garde distincte de la garde all-time)
// ---------------------------------------------------------------------------

/** Préfixe MMKV du meilleur tour du jour (clé par date locale YYYY-MM-DD). */
export const DAY_BEST_PREFIX = 'day-best:';
/** Préfixe MMKV de la garde de célébration du record du jour (clé par séance). */
export const DAY_RECORD_CELEBRATED_PREFIX = 'day-record:';

/** Date locale au format YYYY-MM-DD (jamais UTC : le « jour » est celui du pilote). */
export function localDayIso(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Clé MMKV du meilleur tour d'une date locale. */
export function dayBestKey(dateIso: string): string {
  return `${DAY_BEST_PREFIX}${dateIso}`;
}

/** Clé MMKV de la garde de célébration du record du jour, pour une séance. */
export function dayRecordCelebratedKey(sessionId: string): string {
  return `${DAY_RECORD_CELEBRATED_PREFIX}${sessionId}`;
}

export interface DayBestEval {
  /** Meilleur tour du jour (ms) après prise en compte du run courant, ou null. */
  dayBestMs: number | null;
  /** Le run courant a-t-il STRICTEMENT battu un run antérieur du jour ? */
  isNewDayRecord: boolean;
}

/**
 * Évalue le meilleur tour du jour à partir du meilleur PERSISTÉ (runs
 * antérieurs du jour) et du meilleur du run COURANT.
 *
 * Règle données réelles : sans tour courant valide, le meilleur du jour reste
 * inchangé et rien n'est célébré. Le PREMIER tour du jour pose la référence
 * mais NE déclenche PAS de célébration (on ne se bat pas encore contre soi) ;
 * seul un run qui bat strictement un run antérieur du jour est un record.
 */
export function evaluateDayBest(
  prevBestMs: number | null,
  currentBestMs: number | null
): DayBestEval {
  const validCurrent =
    typeof currentBestMs === 'number' && Number.isFinite(currentBestMs) && currentBestMs > 0;
  const validPrev = typeof prevBestMs === 'number' && Number.isFinite(prevBestMs) && prevBestMs > 0;

  if (!validCurrent) {
    return { dayBestMs: validPrev ? (prevBestMs as number) : null, isNewDayRecord: false };
  }
  if (!validPrev) {
    // Premier tour du jour : référence posée, pas de célébration.
    return { dayBestMs: currentBestMs as number, isNewDayRecord: false };
  }
  if ((currentBestMs as number) < (prevBestMs as number)) {
    return { dayBestMs: currentBestMs as number, isNewDayRecord: true };
  }
  return { dayBestMs: prevBestMs as number, isNewDayRecord: false };
}

// ---------------------------------------------------------------------------
// Biométrie à la pause — gating fail-closed (phase A honnête)
// ---------------------------------------------------------------------------

/**
 * `strip`  → coaché avec ceinture Polar appairée : la sparkline du run
 *            (BiometryStrip). Inatteignable tant que BIO-2 (scan Polar)
 *            n'est pas livré — modélisé pour le test et l'avenir.
 * `hint`   → flag + consentement, mais pas de ceinture : ListRow honnête
 *            « Cœur disponible au bilan » (phase A).
 * `none`   → flag OFF ou consentement absent : RIEN (fail-closed, zéro teasing).
 */
export type PauseBiometryMode = 'strip' | 'hint' | 'none';

export function decidePauseBiometry(input: {
  flagEnabled: boolean;
  captureConsent: boolean;
  polarPaired: boolean;
}): PauseBiometryMode {
  if (input.flagEnabled !== true) return 'none';
  if (input.captureConsent !== true) return 'none';
  return input.polarPaired === true ? 'strip' : 'hint';
}
