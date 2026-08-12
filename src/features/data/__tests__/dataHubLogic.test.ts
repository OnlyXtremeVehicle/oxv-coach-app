/**
 * Tests — logique pure du DATA HUB (L3 DATA). Vérifie les filtres de circuit
 * (distincts, ordre stable), le filtrage saison/circuit, les seuils du badge
 * d'honnêteté, et la sélection du comparateur (max 2, FIFO, lien symétrique).
 */

import {
  canCompare,
  compareHref,
  confidenceBadge,
  filterSessions,
  toggleSelect,
  type FilterableSession,
} from '../dataHubLogic';

// ---------------------------------------------------------------------------
// filterSessions
// ---------------------------------------------------------------------------

describe('filterSessions', () => {
  const sessions: FilterableSession[] = [
    { circuitId: 'hs', circuitName: 'HS', vehicleId: 'v1', startedAt: '2026-07-16T09:00:00Z' },
    { circuitId: 'val', circuitName: 'Val', vehicleId: 'v1', startedAt: '2025-11-02T09:00:00Z' },
    { circuitId: 'hs', circuitName: 'HS', vehicleId: 'v2', startedAt: '2025-05-01T09:00:00Z' },
    { circuitId: null, circuitName: null, vehicleId: null, startedAt: null },
  ];

  it('all : renvoie toutes les sessions (copie, pas la même référence)', () => {
    const out = filterSessions(sessions, { kind: 'all' });
    expect(out).toHaveLength(4);
    expect(out).not.toBe(sessions);
  });

  /**
   * LE FILTRE PORTE SUR LA PAIRE, PAS SUR LE CIRCUIT — depuis le 12/08/2026.
   *
   * Deux voitures sur le même circuit produisent des chronos qui ne se
   * comparent pas. L'ancienne puce « Haute Saintonge » les mélangeait en
   * silence : deux séances y entraient, dont une roulée avec une autre auto.
   */
  it('paire : le même circuit avec deux voitures fait deux filtres distincts', () => {
    const out = filterSessions(sessions, { kind: 'paire', paireCle: 'hs::v1' });
    expect(out).toHaveLength(1);
    expect(out[0].startedAt).toBe('2026-07-16T09:00:00Z');
  });

  it('season : ne garde que l’année de startedAt demandée', () => {
    const out = filterSessions(sessions, { kind: 'season', year: 2025 });
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.circuitId)).toEqual(['val', 'hs']);
  });

  it('paire sans clé ne fait correspondre aucune session', () => {
    expect(filterSessions(sessions, { kind: 'paire' })).toEqual([]);
  });

  it('season sans year ne fait correspondre aucune session', () => {
    expect(filterSessions(sessions, { kind: 'season' })).toEqual([]);
  });

  it('season ignore les startedAt nulls ou illisibles', () => {
    const out = filterSessions(sessions, { kind: 'season', year: 2026 });
    expect(out).toHaveLength(1);
    expect(out[0].circuitId).toBe('hs');
  });
});

// ---------------------------------------------------------------------------
// confidenceBadge
// ---------------------------------------------------------------------------

describe('confidenceBadge', () => {
  it('full : tours > 0, trames présentes et distance > 0', () => {
    expect(confidenceBadge({ lapCount: 3, hasFrames: true, distanceKm: 12.4 })).toBe('full');
  });

  it('empty : ni tour ni trame', () => {
    expect(confidenceBadge({ lapCount: 0, hasFrames: false, distanceKm: 0 })).toBe('empty');
    expect(confidenceBadge({ lapCount: null, hasFrames: false, distanceKm: null })).toBe('empty');
  });

  it('partial : matière incomplète sur l’un des axes', () => {
    // Tours + trames mais aucune distance mesurée.
    expect(confidenceBadge({ lapCount: 2, hasFrames: true, distanceKm: 0 })).toBe('partial');
    // Trames sans tour détecté.
    expect(confidenceBadge({ lapCount: 0, hasFrames: true, distanceKm: null })).toBe('partial');
    // Tours et distance mais aucune trame chargée.
    expect(confidenceBadge({ lapCount: 4, hasFrames: false, distanceKm: 10 })).toBe('partial');
  });

  it('ne fabrique pas de valeur : null est traité comme absent, pas comme un zéro exploitable', () => {
    // lapCount null => pas de tour => ne peut pas être full.
    expect(confidenceBadge({ lapCount: null, hasFrames: true, distanceKm: 10 })).toBe('partial');
  });
});

// ---------------------------------------------------------------------------
// Sélection du comparateur
// ---------------------------------------------------------------------------

describe('toggleSelect', () => {
  it('ajoute un id absent', () => {
    expect(toggleSelect([], 'a')).toEqual(['a']);
    expect(toggleSelect(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('retire un id déjà présent (désélection)', () => {
    expect(toggleSelect(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('borne à 2 en FIFO : le plus ancien est éjecté quand un 3e entre', () => {
    expect(toggleSelect(['a', 'b'], 'c')).toEqual(['b', 'c']);
    expect(toggleSelect(toggleSelect(['a', 'b'], 'c'), 'd')).toEqual(['c', 'd']);
  });

  it('ne mute pas l’entrée', () => {
    const input = ['a'];
    toggleSelect(input, 'b');
    expect(input).toEqual(['a']);
  });
});

describe('canCompare', () => {
  it('vrai uniquement pour exactement deux sélections', () => {
    expect(canCompare([])).toBe(false);
    expect(canCompare(['a'])).toBe(false);
    expect(canCompare(['a', 'b'])).toBe(true);
    // Structurellement, toggleSelect n'autorise jamais 3, mais on le vérifie.
    expect(canCompare(['a', 'b', 'c'])).toBe(false);
  });
});

describe('compareHref', () => {
  it('construit un lien symétrique a/b dans l’ordre de sélection', () => {
    expect(compareHref(['s1', 's2'])).toBe('/data/comparer?a=s1&b=s2');
  });

  it('encode les identifiants', () => {
    expect(compareHref(['a b', 'c&d'])).toBe('/data/comparer?a=a%20b&b=c%26d');
  });

  it('renvoie une chaîne vide si la sélection n’est pas de deux (aucun lien partiel)', () => {
    expect(compareHref([])).toBe('');
    expect(compareHref(['s1'])).toBe('');
    expect(compareHref(['s1', 's2', 's3'])).toBe('');
  });

  it('ne porte aucun ordre de mérite : a et b sont symétriques', () => {
    // Le vocabulaire du lien est neutre : ni « gagnant », ni « mieux », ni rang.
    const href = compareHref(['s1', 's2']);
    expect(href).not.toMatch(/gagnant|winner|mieux|better|meilleur|rang|rank/i);
  });
});
