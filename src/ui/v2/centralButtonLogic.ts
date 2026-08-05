/**
 * centralButtonLogic — décision pure du mode du bouton central (lot L0,
 * Livrable 8). Le hook `useCentralButtonState` lit le store et le service,
 * ce module tranche :
 *
 *   rec        → une capture est en cours (activeRecording non nul) ;
 *   countdown  → une journée circuit à venir (label 'J-x', 'J-0' le jour J) ;
 *   reserve    → sinon (aucune journée, date passée ou illisible).
 *
 * Module .ts pur, sans React ni react-native : testé sous ts-jest/node
 * (src/ui/v2/__tests__/centralButtonLogic.test.ts). Les jours sont comptés
 * de minuit LOCAL à minuit local (même convention que nextTrackDayService :
 * à 23 h 59, demain reste 'J-1') ; l'arrondi absorbe les bascules d'heure
 * d'été (jour de 23 h ou 25 h).
 *
 * Porte aussi la liste des segments V2 du flux capture (masquage de la
 * TabBar sous /rec/<segment>) : logique pure de coquille, rangée ici — dans
 * un module déjà testé — sans toucher à appMap (v1) ni à shellLogic.
 */

import type { CentralButtonMode } from './shellLogic';

/** Ce que le hook restitue à la TabBar (props `central`). */
export interface CentralButtonDecision {
  mode: CentralButtonMode;
  /** Label court mono du countdown ('J-3'). Absent hors countdown. */
  label?: string;
}

/** Entrées de la décision — tout est fourni, rien n'est lu ici. */
export interface CentralButtonInputs {
  /** Une capture est-elle en cours (activeRecording non nul) ? */
  recordingActive: boolean;
  /** Date ISO ('YYYY-MM-DD') de la prochaine journée circuit, null si aucune. */
  nextDayDate: string | null;
  /** Maintenant — passé en paramètre pour faciliter les tests. */
  now: Date;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Jours entiers (locaux) entre maintenant et la journée `dateIso`.
 * 0 = aujourd'hui, 1 = demain, négatif = passé. Date illisible → null.
 */
export function daysUntilTrackDay(dateIso: string, now: Date): number | null {
  const m = ISO_DATE.exec(dateIso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const target = new Date(year, month - 1, day);
  // Rejette les dates qui « débordent » (2026-02-31 → 3 mars) : pas une donnée.
  if (
    target.getFullYear() !== year ||
    target.getMonth() !== month - 1 ||
    target.getDate() !== day
  ) {
    return null;
  }
  // Arrondi : un jour de 23 h / 25 h (heure d'été) compte pour un jour.
  return Math.round((target.getTime() - startOfLocalDay(now)) / DAY_MS);
}

/** Label mono du compte à rebours : 'J-3', 'J-0' le jour J. */
export function countdownLabel(days: number): string {
  return `J-${Math.max(0, Math.floor(days))}`;
}

/** LA décision — seule source de vérité du mode du bouton central. */
export function decideCentralButton(inputs: CentralButtonInputs): CentralButtonDecision {
  if (inputs.recordingActive) return { mode: 'rec' };
  if (inputs.nextDayDate !== null) {
    const days = daysUntilTrackDay(inputs.nextDayDate, inputs.now);
    if (days !== null && days >= 0) {
      return { mode: 'countdown', label: countdownLabel(days) };
    }
  }
  return { mode: 'reserve' };
}

// ---------------------------------------------------------------------------
// Flux capture V2 — masquage de la TabBar (mécanisme prêt pour le lot L2)
// ---------------------------------------------------------------------------

/**
 * Segments du futur flux capture V2, sous /rec/<segment> : la TabBar
 * s'efface sur ces écrans (silence en piste). Les routes n'existent pas
 * encore (lot L2) — la liste fait foi, le layout (app2) est déjà branché.
 */
/**
 * `equipement` est devenu `appairage` le 05/08/2026, et `consentement` s'y
 * ajoute — l'étape 4b, hors des huit.
 *
 * SANS CES DEUX ENTRÉES, LA BARRE D'ONGLETS RÉAPPARAÎT sur les deux écrans
 * neufs, et le test qui accompagne cette liste ITÈRE la liste : il serait
 * resté vert. Le silence en piste aurait été rompu sans qu'aucune garde ne le
 * dise.
 */
export const V2_HIDDEN_SEGMENTS = [
  'arrivee',
  'appairage',
  'consentement',
  'placement',
  'roulage',
  'fin',
] as const;

/**
 * Le chemin courant est-il un écran immersif du flux capture V2 ?
 * Vrai quand le pathname est sous /rec/<segment> avec un segment de
 * V2_HIDDEN_SEGMENTS (sous-chemins inclus). '/rec' seul reste visible :
 * c'est l'amorce, pas le flux immersif.
 */
export function isV2CaptureFlowPath(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, '').split('/');
  if (segments[0] !== 'rec') return false;
  const second = segments[1] ?? '';
  return (V2_HIDDEN_SEGMENTS as readonly string[]).includes(second);
}
