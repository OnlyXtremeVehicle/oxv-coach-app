import {
  buildFinSummary,
  finBilanRoute,
  finDurationMin,
  finPhaseTitle,
  FIN_PHASES,
  mapPreservationResult,
  retryPhase,
} from '../finLogic';

describe('finPhaseTitle', () => {
  it('nomme chaque phase', () => {
    expect(finPhaseTitle('fini')).toBe('Pilotage terminé');
    expect(finPhaseTitle('preservation')).toBe('Préservation de la séance');
    expect(finPhaseTitle('pret')).toBe('Votre bilan est prêt');
    expect(finPhaseTitle('erreur')).toBe('Préservation interrompue');
  });
  it('couvre les 4 phases', () => {
    expect(FIN_PHASES).toEqual(['fini', 'preservation', 'pret', 'erreur']);
  });
});

describe('finDurationMin', () => {
  it('rend les minutes entières', () => {
    const start = new Date('2026-07-19T14:00:00').getTime();
    const end = new Date('2026-07-19T14:23:30').getTime();
    expect(finDurationMin(start, end)).toBe(24);
  });
  it('null sur bornes manquantes ou durée non positive', () => {
    expect(finDurationMin(null, 1)).toBeNull();
    expect(finDurationMin(1, null)).toBeNull();
    const t = Date.now();
    expect(finDurationMin(t, t)).toBeNull();
    expect(finDurationMin(t + 1000, t)).toBeNull();
  });
});

describe('buildFinSummary — faits réels uniquement', () => {
  it('inclut tours et minutes réels, pluralise', () => {
    const items = buildFinSummary({ lapCount: 5, durationMs: 24 * 60_000, distanceKm: null });
    expect(items).toEqual([
      { key: 'tours', label: 'Tours', value: '5' },
      { key: 'minutes', label: 'Minutes', value: '24' },
    ]);
  });
  it('singularise un seul tour', () => {
    const items = buildFinSummary({ lapCount: 1, durationMs: null, distanceKm: null });
    expect(items).toEqual([{ key: 'tours', label: 'Tour', value: '1' }]);
  });
  it('omet toute valeur absente ou nulle (jamais un 0 fabriqué)', () => {
    expect(buildFinSummary({ lapCount: 0, durationMs: 0, distanceKm: 0 })).toEqual([]);
    expect(buildFinSummary({ lapCount: null, durationMs: null, distanceKm: null })).toEqual([]);
  });
  it('inclut km seulement si fourni et > 0', () => {
    const items = buildFinSummary({ lapCount: null, durationMs: null, distanceKm: 87.4 });
    expect(items).toEqual([{ key: 'distance', label: 'Km', value: '87' }]);
  });
});

describe('mapPreservationResult — parité v1', () => {
  it('séance présente et pas d’exception → pret (bilan ouvert, parité v1)', () => {
    expect(mapPreservationResult({ hasSessionId: true, threw: false })).toBe('pret');
  });
  it('exception inattendue → erreur', () => {
    expect(mapPreservationResult({ hasSessionId: true, threw: true })).toBe('erreur');
  });
  it('aucune séance à préserver → erreur', () => {
    expect(mapPreservationResult({ hasSessionId: false, threw: false })).toBe('erreur');
  });
  it('la relance repart en préservation', () => {
    expect(retryPhase()).toBe('preservation');
  });
});

describe('finBilanRoute', () => {
  it('cible le Bilan V2 de la séance', () => {
    expect(finBilanRoute('abc-123')).toBe('/(app2)/bilan/abc-123');
  });
});
