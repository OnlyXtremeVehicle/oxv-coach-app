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
 * `circuitName`, `startedAt`), miroir de `TelemetrySession` côté service.
 */

// ---------------------------------------------------------------------------
// Filtres de circuit — puces « Tous » / « Cette saison » gérées par l'écran.
// ---------------------------------------------------------------------------

/** Référence minimale d'une session pour construire les puces de circuit. */
export interface SessionCircuitRef {
  circuitId: string | null;
  circuitName: string | null;
}

/** Une puce de filtre circuit prête à afficher. */
export interface CircuitFilterChip {
  id: string;
  label: string;
}

/** Repli de libellé quand une session porte un `circuitId` mais aucun nom. */
const CIRCUIT_FALLBACK_LABEL = 'Circuit';

/**
 * Liste les circuits DISTINCTS présents dans les sessions, pour les puces de
 * filtre (en plus des puces implicites « Tous » / « Cette saison » gérées par
 * l'écran). Ordre stable (première apparition), sans doublon, les sessions sans
 * `circuitId` étant ignorées. Si une occurrence porte un nom là où une
 * précédente n'en avait pas, le libellé est complété (jamais inventé).
 */
export function circuitFilters(sessions: readonly SessionCircuitRef[]): CircuitFilterChip[] {
  const order: string[] = [];
  const labelById = new Map<string, string>();

  for (const s of sessions) {
    const id = s.circuitId?.trim();
    if (!id) continue; // pas d'identifiant : pas de puce (on ignore les null)
    const name = s.circuitName?.trim();

    if (!labelById.has(id)) {
      order.push(id);
      labelById.set(id, name && name.length > 0 ? name : CIRCUIT_FALLBACK_LABEL);
    } else if (labelById.get(id) === CIRCUIT_FALLBACK_LABEL && name && name.length > 0) {
      // Complète le repli si une occurrence ultérieure porte un vrai nom.
      labelById.set(id, name);
    }
  }

  return order.map((id) => ({ id, label: labelById.get(id) as string }));
}

// ---------------------------------------------------------------------------
// Filtrage des sessions — pur, déterministe.
// ---------------------------------------------------------------------------

/** Forme minimale filtrable : identifiant de circuit + date de début ISO. */
export interface FilterableSession {
  circuitId: string | null;
  startedAt: string | null;
}

/**
 * Filtre appliqué à la liste :
 *  - `all` : aucune restriction ;
 *  - `circuit` : sessions du `circuitId` donné (égalité stricte) ;
 *  - `season` : sessions dont l'année de `startedAt` vaut `year`.
 */
export interface SessionFilter {
  kind: 'all' | 'circuit' | 'season';
  circuitId?: string;
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
    case 'circuit':
      return sessions.filter((s) => s.circuitId === filter.circuitId);
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
