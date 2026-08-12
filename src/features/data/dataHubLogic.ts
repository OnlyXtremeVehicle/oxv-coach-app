/**
 * Logique pure du DATA HUB (L3 DATA, écran d'entrée) — sans React, sans réseau,
 * sans Supabase. Testable seule (ts-jest, environnement node).
 *
 * DOCTRINE L3 — lecture de SES propres données uniquement :
 *  - AUCUNE valeur n'est fabriquée ici. Ce module trie, dédoublonne, filtre et
 *    construit des liens. Une donnée absente reste absente (jamais un zéro
 *    inventé) — le badge d'honnêteté qualifie la DONNÉE, jamais le pilote.
 *  - Le comparateur n'a PAS de gagnant : ce module ne fait que sélectionner deux
 *    sessions et bâtir le lien vers l'écran de comparaison ; il ne classe rien,
 *    n'attribue aucun « mieux ». Le lexique reste neutre.
 *
 * Toute l'I/O (chargement des sessions, des trames) vit dans le hook d'écran ;
 * ce module reçoit des formes déjà normalisées en camelCase (`circuitId`,
 * `circuitName`, `vehicleId`, `startedAt`), miroir de `TelemetrySession` côté
 * service.
 */

import { seancesDeLaPaire } from './pairesLogic';

// ---------------------------------------------------------------------------
// Filtres de PAIRE — les puces viennent de `pairesLogic`.
// ---------------------------------------------------------------------------
//
// `circuitFilters`, `SessionCircuitRef` et `CircuitFilterChip` vivaient ici et
// ont été SUPPRIMÉS le 12/08/2026, avec leurs six tests.
//
// Ils construisaient les puces à partir des circuits seuls. Le plan V3 impose
// la paire circuit-véhicule, et les deux appelants — le hub Data et la Saison —
// sont passés à `pairesRoulees`. Ce qui restait n'était plus appelé nulle part.
//
// Le garder aurait été pire que du code mort : une fonction toute prête,
// nommée exactement comme le besoin apparent, qu'un futur écran aurait
// rebranchée sans savoir que le filtre par circuit seul mélange deux voitures
// sous une puce unique.

// ---------------------------------------------------------------------------
// Filtrage des sessions — pur, déterministe.
// ---------------------------------------------------------------------------

/** Forme minimale filtrable : la paire, plus la date de début ISO. */
export interface FilterableSession {
  circuitId: string | null;
  circuitName: string | null;
  vehicleId: string | null;
  startedAt: string | null;
}

/**
 * Filtre appliqué à la liste :
 *  - `all` : aucune restriction ;
 *  - `paire` : sessions de la PAIRE circuit-véhicule donnée (`pairesLogic`) ;
 *  - `season` : sessions dont l'année de `startedAt` vaut `year`.
 *
 * ---
 *
 * LE FILTRE `circuit` EST DEVENU `paire` LE 12/08/2026.
 *
 * Le plan V3 : *« filtre par paire réellement roulée, jamais deux filtres
 * indépendants »*. Un filtre par circuit seul n'est pas faux, il est
 * incomplet : deux voitures sur le même circuit produisent des chronos qui ne
 * se comparent pas, et les ranger sous une seule puce les mélange en silence.
 *
 * Les paires viennent de `pairesRoulees`, qui ne propose que ce qui a été
 * roulé — jamais le produit des circuits par les véhicules.
 */
export interface SessionFilter {
  kind: 'all' | 'paire' | 'season';
  /** Clé de paire (`pairesLogic`), pas un identifiant de circuit. */
  paireCle?: string;
  year?: number;
}

/** Extrait l'année (UTC) d'une date ISO 'YYYY-…', ou null si illisible. */
function parseYear(startedAt: string | null): number | null {
  if (!startedAt) return null;
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(startedAt);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

/**
 * Filtre PUR de la liste de sessions selon `filter`. Conserve le type d'entrée.
 * `circuit` sans `circuitId` (ou `season` sans `year`) ne fait correspondre
 * aucune session — on ne devine rien.
 */
export function filterSessions<T extends FilterableSession>(
  sessions: readonly T[],
  filter: SessionFilter
): T[] {
  switch (filter.kind) {
    case 'all':
      return [...sessions];
    case 'paire':
      // Une clé absente ne fait correspondre aucune séance : on ne devine pas.
      if (filter.paireCle === undefined) return [];
      return seancesDeLaPaire(sessions, filter.paireCle);
    case 'season':
      return sessions.filter((s) => parseYear(s.startedAt) === filter.year);
    default:
      return [...sessions];
  }
}

// ---------------------------------------------------------------------------
// Badge d'honnêteté — qualifie la DONNÉE d'une session (jamais le pilote).
// ---------------------------------------------------------------------------

/**
 * Niveau de complétude affichable d'une session :
 *  - `full`    : lecture complète (tours + trames + distance réels) ;
 *  - `partial` : quelque chose manque, mais il reste de la matière ;
 *  - `empty`   : ni tour ni trame — rien à lire honnêtement.
 */
export type ConfidenceBadge = 'full' | 'partial' | 'empty';

/**
 * Dérive le badge d'honnêteté d'une session. Aligné sur l'ESPRIT de
 * `computeDataConfidence` (dataConfidenceLogic) : `full` exige une matière
 * réelle sur les trois axes (tours > 0, trames présentes, distance > 0) ;
 * `empty` ne s'affiche que lorsqu'il n'y a NI tour NI trame ; sinon `partial`.
 * Une valeur absente (null) est traitée comme absente, jamais comme un zéro
 * fabriqué qui mentirait sur la qualité de la donnée.
 */
export function confidenceBadge(session: {
  lapCount: number | null;
  hasFrames: boolean;
  distanceKm: number | null;
}): ConfidenceBadge {
  const laps = session.lapCount ?? 0;
  const distance = session.distanceKm ?? 0;

  if (laps > 0 && session.hasFrames && distance > 0) return 'full';
  if (laps <= 0 && !session.hasFrames) return 'empty';
  return 'partial';
}

// ---------------------------------------------------------------------------
// Sélection du comparateur — DEUX sessions, aucun gagnant.
// ---------------------------------------------------------------------------

/** Nombre de sessions requises par le comparateur (deux côtés symétriques). */
const COMPARE_ARITY = 2;

/**
 * Bascule la présence de `id` dans la sélection :
 *  - présent → retiré (désélection) ;
 *  - absent → ajouté, la sélection étant bornée à deux en FIFO (le plus ancien
 *    est éjecté quand un troisième entre).
 * Fonction pure : ne mute pas l'entrée.
 */
export function toggleSelect(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) {
    return selected.filter((x) => x !== id);
  }
  const next = [...selected, id];
  return next.length > COMPARE_ARITY ? next.slice(next.length - COMPARE_ARITY) : next;
}

/** Vrai quand exactement deux sessions sont sélectionnées (comparaison prête). */
export function canCompare(selected: readonly string[]): boolean {
  return selected.length === COMPARE_ARITY;
}

/**
 * Construit le lien vers l'écran de comparaison pour deux sessions.
 * Les deux côtés sont symétriques : `a` et `b` ne portent AUCUN ordre de mérite,
 * seulement l'ordre de sélection. Renvoie '' si la sélection n'est pas de deux
 * (on ne fabrique pas de lien partiel).
 */
export function compareHref(selected: readonly string[]): string {
  if (selected.length !== COMPARE_ARITY) return '';
  const [a, b] = selected;
  return `/data/comparer?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
}
