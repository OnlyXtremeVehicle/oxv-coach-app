/**
 * finLogic — logique PURE de l'écran FIN DE SÉANCE (V2-L2, spec 8/8).
 *
 * Fusionne les 3 écrans v1 (pilotage-fini, préservation, bilan-prêt) + un état
 * d'erreur en UNE peau à états cross-fadés. Zéro I/O, zéro React : testable
 * sous ts-jest node (__tests__/finLogic.test.ts). L'écran
 * `app/(app2)/rec/fin.tsx` rebranche les MÊMES appels que la v1
 * (analyzeAndPersistSession, useSessionStore, la file de synchro) ; ce module
 * ne fait que trancher les phases et formater les faits réels.
 *
 * Règle données réelles : le résumé ne montre que ce que le store/la séance
 * ont réellement mesuré (tours, minutes) — jamais un « runs » ou un « km »
 * fabriqué quand la source ne l'expose pas.
 */

// ---------------------------------------------------------------------------
// Phases cross-fadées
// ---------------------------------------------------------------------------

export type FinPhase = 'fini' | 'preservation' | 'pret' | 'erreur';

export const FIN_PHASES: readonly FinPhase[] = ['fini', 'preservation', 'pret', 'erreur'];

/** Titre (accessibilité + display) de chaque phase — descriptif, jamais prescriptif. */
export function finPhaseTitle(phase: FinPhase): string {
  switch (phase) {
    case 'fini':
      return 'Pilotage terminé';
    case 'preservation':
      return 'Préservation de la séance';
    case 'pret':
      return 'Votre bilan est prêt';
    case 'erreur':
      return 'Préservation interrompue';
  }
}

/**
 * Micro-textes d'étapes de la préservation — FACTUELS (la préservation se
 * regarde, elle rassure). Aucun impératif, aucune promesse chiffrée.
 */
export const PRESERVATION_STEPS: readonly string[] = [
  'Trames sécurisées…',
  'Analyse en cours…',
  'Bilan en préparation…',
];

// ---------------------------------------------------------------------------
// Résumé de fin — faits réels du store / de la séance
// ---------------------------------------------------------------------------

export interface FinSummaryInput {
  /** Nombre de tours chronométrés (useSessionStore.lapCount). */
  lapCount: number | null;
  /** Durée de la séance en ms (endedAt − startedAt de la meta). */
  durationMs: number | null;
  /**
   * Distance parcourue en km — souvent NON disponible en fin (non trackée par
   * le store). null → la cellule est simplement absente (jamais un 0 fabriqué).
   */
  distanceKm: number | null;
}

export interface FinSummaryItem {
  key: 'tours' | 'minutes' | 'distance';
  /** Étiquette humaine (sous le chiffre). */
  label: string;
  /** Valeur numérique en chaîne, prête pour RollingCounter. */
  value: string;
}

/** Durée en minutes entières entre deux epochs ms, ou null si indéterminée. */
export function finDurationMin(startedAtMs: number | null, endedAtMs: number | null): number | null {
  if (startedAtMs == null || endedAtMs == null) return null;
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) return null;
  const d = endedAtMs - startedAtMs;
  if (d <= 0) return null;
  return Math.round(d / 60_000);
}

/**
 * Construit le résumé de fin. N'inclut QUE les faits réellement mesurés :
 *   - tours (lapCount > 0),
 *   - minutes (durée > 0),
 *   - km (seulement si la distance est fournie et > 0).
 * Un fait absent est absent — la ligne n'apparaît pas.
 */
export function buildFinSummary(input: FinSummaryInput): FinSummaryItem[] {
  const items: FinSummaryItem[] = [];

  if (typeof input.lapCount === 'number' && Number.isFinite(input.lapCount) && input.lapCount > 0) {
    items.push({
      key: 'tours',
      label: input.lapCount > 1 ? 'Tours' : 'Tour',
      value: String(input.lapCount),
    });
  }

  if (
    typeof input.durationMs === 'number' &&
    Number.isFinite(input.durationMs) &&
    input.durationMs > 0
  ) {
    items.push({ key: 'minutes', label: 'Minutes', value: String(Math.round(input.durationMs / 60_000)) });
  }

  if (
    typeof input.distanceKm === 'number' &&
    Number.isFinite(input.distanceKm) &&
    input.distanceKm > 0
  ) {
    items.push({ key: 'distance', label: 'Km', value: String(Math.round(input.distanceKm)) });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Transitions — transitions machine INCHANGÉES (parité v1)
// ---------------------------------------------------------------------------

/**
 * Résultat de la préservation → phase suivante.
 *
 * Parité v1 : l'analyse (analyzeAndPersistSession) NE LÈVE JAMAIS et le flux v1
 * ouvre le bilan quel que soit son `ok` (bilan avec repli si besoin). On ne
 * bascule donc en `erreur` QUE sur un échec dur : aucune séance à préserver
 * (sessionId absent) ou exception inattendue de l'orchestration. Dans ces cas,
 * la file de synchro garantit que les données restent en sécurité sur
 * l'appareil — d'où la relance possible.
 */
export function mapPreservationResult(input: { hasSessionId: boolean; threw: boolean }): FinPhase {
  if (input.threw) return 'erreur';
  if (!input.hasSessionId) return 'erreur';
  return 'pret';
}

/** Relance depuis l'état d'erreur : on retente la préservation. */
export function retryPhase(): FinPhase {
  return 'preservation';
}

/** Route du Bilan V2 pour une séance (contrat de navigation, chaîne pure). */
export function finBilanRoute(sessionId: string): string {
  return `/(app2)/bilan/${sessionId}`;
}

/** Texte exact de l'état d'erreur (immuable, la file garantit la reprise). */
export const FIN_ERROR_MESSAGE = 'Vos données sont en sécurité sur l’appareil.';
