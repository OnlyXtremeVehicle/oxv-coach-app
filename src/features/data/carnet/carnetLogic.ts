/**
 * carnetLogic — logique PURE de l'écran Carnet (V2-L4, porte VOUS, 4/8).
 *
 * Regroupe les décisions sans état natif du Carnet à 4 onglets :
 *   - la table des onglets (Notes · Intentions · Objectifs · Programme), le
 *     bornage d'index et la décision de swipe horizontal (pager gestuel) ;
 *   - l'état factuel d'une intention (honorée en séance / en attente) ;
 *   - le résumé météo « du jour de la note » — sous garde A-WEATHER-1 stricte :
 *     jamais un 0° fabriqué, jamais une météo d'un autre jour ;
 *   - la mesurabilité d'un objectif (barre hairline SI mesurable, sinon rien —
 *     un objectif sans mesure réelle n'affiche AUCUNE barre inventée).
 *
 * Aucune dépendance React / react-native / Supabase : testé sous ts-jest/node
 * (src/features/vous/__tests__/carnetLogic.test.ts). Les services (pilotNotes,
 * intentions, pilotGoals, developmentCycle, weather) restent INTACTS — ce module
 * ne fait que classer/qualifier ce qu'ils émettent.
 */

// ---------------------------------------------------------------------------
// Onglets — table, index, swipe
// ---------------------------------------------------------------------------

export type CarnetTab = 'notes' | 'intentions' | 'objectifs' | 'programme';

/** Ordre canonique des 4 onglets (source unique — la barre et le pager le lisent). */
export const CARNET_TABS: readonly CarnetTab[] = [
  'notes',
  'intentions',
  'objectifs',
  'programme',
] as const;

export const CARNET_TAB_LABELS: Record<CarnetTab, string> = {
  notes: 'Notes',
  intentions: 'Intentions',
  objectifs: 'Objectifs',
  programme: 'Programme',
};

/** Index d'un onglet dans l'ordre canonique (−1 si inconnu). */
export function tabIndexOf(tab: CarnetTab): number {
  return CARNET_TABS.indexOf(tab);
}

/** Borne un index dans [0, nombre d'onglets − 1] ; entrée douteuse → 0. */
export function clampTabIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  const i = Math.round(index);
  if (i < 0) return 0;
  const max = CARNET_TABS.length - 1;
  return i > max ? max : i;
}

/** L'onglet à l'index donné (index borné) — jamais undefined. */
export function tabAt(index: number): CarnetTab {
  return CARNET_TABS[clampTabIndex(index)];
}

/** Fraction de la largeur d'écran au-delà de laquelle un tirage change d'onglet. */
export const CARNET_SWIPE_DISTANCE_RATIO = 0.28;
/** Vitesse (px/s) d'un flick qui change d'onglet même sur un petit tirage. */
export const CARNET_SWIPE_VELOCITY = 500;
/** Tirage minimal (px) pour qu'un flick rapide compte comme une intention. */
export const CARNET_SWIPE_FLICK_MIN_DRAG = 8;

/**
 * Onglet cible au relâchement du pager. translationX < 0 = swipe vers la gauche
 * = onglet SUIVANT ; > 0 = onglet PRÉCÉDENT. On change si le tirage dépasse la
 * fraction seuil OU si le flick est franc (vitesse + tirage minimal). Le résultat
 * est toujours borné : aux extrémités, un swipe « au-delà » reste sur place.
 */
export function nextTabIndex(
  current: number,
  translationX: number,
  velocityX: number,
  width: number
): number {
  const cur = clampTabIndex(current);
  if (!Number.isFinite(width) || width <= 0) return cur;
  if (!Number.isFinite(translationX)) return cur;

  const distance = Math.abs(translationX);
  const distanceTrip = distance >= width * CARNET_SWIPE_DISTANCE_RATIO;
  // Une vitesse non finie ne doit pas invalider un tirage suffisant : elle rend
  // seulement le flick inopérant (le tirage, lui, décide).
  const velocityTrip =
    Number.isFinite(velocityX) &&
    Math.abs(velocityX) >= CARNET_SWIPE_VELOCITY &&
    distance >= CARNET_SWIPE_FLICK_MIN_DRAG;

  if (!distanceTrip && !velocityTrip) return cur;

  // Direction : par le tirage s'il a franchi le seuil, sinon par le flick.
  const dir = distanceTrip ? (translationX < 0 ? 1 : -1) : velocityX < 0 ? 1 : -1;
  return clampTabIndex(cur + dir);
}

/**
 * Progression continue du pager (0 = premier onglet, N−1 = dernier), dérivée du
 * décalage courant `tx` (négatif en avançant). Sert l'indicateur hairline
 * glissant sous les onglets. Bornée, jamais NaN.
 */
export function pagerProgress(tx: number, width: number): number {
  if (!Number.isFinite(tx) || !Number.isFinite(width) || width <= 0) return 0;
  const p = -tx / width;
  const max = CARNET_TABS.length - 1;
  // `+ 0` normalise le -0 (ex. tx=0 → -0/width) : sémantiquement 0, mais
  // Object.is(-0, 0) est faux (piège de test et d'interpolation animée).
  if (p <= 0) return 0;
  return p > max ? max : p + 0;
}

// ---------------------------------------------------------------------------
// Intentions — état factuel
// ---------------------------------------------------------------------------

/**
 * `honored` : l'intention a été rattachée à une séance (portée en piste).
 * `pending` : encore en attente (posée pour la prochaine fois, session_id null).
 * L'app CONSTATE, elle ne juge pas la réussite du contenu.
 */
export type IntentionState = 'honored' | 'pending';

export function intentionState(sessionId: string | null): IntentionState {
  return sessionId != null ? 'honored' : 'pending';
}

export function intentionStateLabel(state: IntentionState): string {
  return state === 'honored' ? 'Portée en séance' : 'En attente';
}

// ---------------------------------------------------------------------------
// Météo du jour de la note — garde A-WEATHER-1
// ---------------------------------------------------------------------------

/** Les deux dates ISO tombent-elles le même jour calendaire LOCAL ? Invalide → false. */
export function isSameLocalDay(aIso: string, bIso: string): boolean {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso);
  const b = new Date(bIso);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface NoteWeather {
  /** Température en °C, arrondie — JAMAIS 0 par défaut (A-WEATHER-1). */
  tempC: number;
  /** Libellé de ciel (peut être vide si non renseigné). */
  label: string;
}

/**
 * Résume la météo à afficher sous une note — ou null (section masquée).
 *
 * A-WEATHER-1 (règle fondateur) : on ne rend une ligne QUE si un relevé RÉEL
 * existe pour le jour de la note. `temperatureC` NULL ou non fini → null (jamais
 * un 0° fabriqué). Relevé d'un autre jour → null (« du jour » doit être vrai).
 *
 * Le relevé brut est lu SANS coercition (température nullable telle qu'en base),
 * précisément pour distinguer « 0°C réel » d'« absence » — cf. useCarnet.
 */
export function summarizeNoteWeather(
  snapshot: { capturedAt: string; temperatureC: number | null; weatherLabel: string | null } | null,
  noteCreatedAt: string
): NoteWeather | null {
  if (snapshot === null) return null;
  const t = snapshot.temperatureC;
  if (t === null || !Number.isFinite(t)) return null;
  if (!isSameLocalDay(snapshot.capturedAt, noteCreatedAt)) return null;
  return { tempC: Math.round(t), label: (snapshot.weatherLabel ?? '').trim() };
}

// ---------------------------------------------------------------------------
// Objectifs — mesurabilité
// ---------------------------------------------------------------------------

/** Un objectif porte-t-il une mesure chiffrée exploitable (barre de progression) ? */
export interface GoalMeasure {
  current?: number | null;
  target?: number | null;
}

/**
 * Progression 0..1 d'un objectif MESURABLE, ou null.
 *
 * Le schéma `pilot_goals` actuel ne porte AUCUN champ de mesure (voir
 * pilotGoalsService) : avec des objectifs réels, cette fonction rend toujours
 * null → l'écran n'affiche AUCUNE barre (règle données réelles — pas de barre
 * inventée). La fonction reste générique et testée pour le jour où une mesure
 * (current/target) sera ajoutée au modèle.
 */
export function goalProgress(goal: GoalMeasure): number | null {
  const { current, target } = goal;
  if (current == null || target == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return null;
  const r = current / target;
  if (r < 0) return 0;
  return r > 1 ? 1 : r;
}

/** Vrai si l'objectif porte une progression chiffrée (→ barre hairline). */
export function isGoalMeasurable(goal: GoalMeasure): boolean {
  return goalProgress(goal) !== null;
}

/** Libellé humain d'un statut d'objectif (auto-évaluation pilote). */
export function goalStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'En cours';
    case 'achieved':
      return 'Atteint';
    case 'continued':
      return 'Poursuivi';
    case 'abandoned':
      return 'Écarté';
    default:
      return 'En cours';
  }
}
