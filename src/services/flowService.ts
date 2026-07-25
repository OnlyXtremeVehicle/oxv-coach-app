/**
 * Service fluidité (A-FLOW-1) — loader FIN, SELECT-only, qui alimente le cœur pur
 * `computeFlowTrace`.
 *
 * Contrat : docs/architecture/A-FLOW-1_flowService_definition.md (§4 « forme du
 * code »). Ce fichier NE CALCULE RIEN : il charge des `SessionFrame`, les passe
 * à la logique pure, et ré-exporte celle-ci pour les consommateurs. Toute la
 * physique (jerk, sévérité, lissage causal) vit dans `flowLogic.ts` — pur, testé
 * sans matériel.
 *
 * SELF-ONLY : ne lit que via `loadLapFrames` / `loadSessionFrames`
 * (`sessionTelemetryService`), qui s'appuient sur les policies RLS existantes.
 * Aucune écriture, aucun effet de bord, aucune table nouvelle.
 *
 * DONNÉES RÉELLES — VIDE HONNÊTE : sur erreur ou sur absence de trames, la
 * réponse est `[]` accompagnée d'un `console.warn` (best-effort, même style que
 * `sessionTelemetryService`). Jamais un point fabriqué, jamais une valeur par
 * défaut : une séance dont on n'a pas les trames n'est pas une séance
 * parfaitement fluide, c'est une séance qu'on n'a pas mesurée.
 *
 * AUCUN SEUIL, AUCUN LIBELLÉ : le service ne qualifie rien. La frontière du
 * « fluide » est reportée au post-piste (verrou 4 du contrat) ; ce fichier ne
 * fait que charger.
 */

import { computeFlowTrace, type FlowOptions, type FlowPoint } from '@/services/flowLogic';
import { loadLapFrames, loadSessionFrames } from '@/services/sessionTelemetryService';

export {
  computeFlowTrace,
  explainedJerkGPerS,
  jerkDistribution,
  meanResidualGPerS,
  segmentIntensity,
  DEFAULT_BIN_WIDTH_G_PER_S,
  DEFAULT_MAX_GAP_MS,
  DEFAULT_SEVERITY_WEIGHTS,
  DEFAULT_SEVERITY_WINDOW_MS,
  DEFAULT_SMOOTHING_WINDOW_MS,
  type FlowBin,
  type FlowChannel,
  type FlowOptions,
  type FlowPoint,
  type FlowSegment,
  type FlowSegmentIntensity,
  type FlowSeverityContext,
  type FlowSeverityWeights,
} from '@/services/flowLogic';

/**
 * Trace du jerk sur UN tour du pilote.
 *
 * @param sessionId séance (self-only, RLS).
 * @param lapNumber tour ciblé.
 * @param opts      paramètres exposés du cœur pur (`smoothingWindowMs` et les
 *                  coefficients de sévérité), à régler sur le réel après le
 *                  smoke test sans toucher à ce loader.
 */
export async function loadLapFlow(
  sessionId: string,
  lapNumber: number,
  opts?: FlowOptions
): Promise<FlowPoint[]> {
  try {
    const frames = await loadLapFrames(sessionId, lapNumber);
    // `loadLapFrames` rend déjà `[]` (et warn) sur erreur DB : on ne distingue
    // pas ici « erreur » de « tour vide », les deux donnent le même vide honnête.
    if (frames.length === 0) return [];
    return computeFlowTrace(frames, opts);
  } catch (error) {
    console.warn('[OXV][flow] loadLapFlow :', error);
    return [];
  }
}

/**
 * Trace du jerk sur une séance ENTIÈRE (toutes les trames capturées, out-lap et
 * in-lap compris — le découpage par segment se fait ensuite via
 * `segmentIntensity`, avec des bornes fournies par l'appelant).
 *
 * @param sessionId séance (self-only, RLS).
 * @param opts      paramètres exposés du cœur pur.
 */
export async function loadSessionFlow(sessionId: string, opts?: FlowOptions): Promise<FlowPoint[]> {
  try {
    const frames = await loadSessionFrames(sessionId);
    if (frames.length === 0) return [];
    return computeFlowTrace(frames, opts);
  } catch (error) {
    console.warn('[OXV][flow] loadSessionFlow :', error);
    return [];
  }
}
