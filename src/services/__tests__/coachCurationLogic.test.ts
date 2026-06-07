import {
  highlightHasContent,
  normalizeHighlightIndexes,
  toggleCornerIndex,
  validateTemplate,
} from '../coachCurationLogic';

describe('toggleCornerIndex', () => {
  it('ajoute en fin si absent (ordre de lecture)', () => {
    expect(toggleCornerIndex([4, 2], 6)).toEqual([4, 2, 6]);
  });

  it('retire si présent', () => {
    expect(toggleCornerIndex([4, 2, 6], 2)).toEqual([4, 6]);
  });
});

describe('normalizeHighlightIndexes', () => {
  it('retire doublons et invalides, conserve l’ordre', () => {
    expect(normalizeHighlightIndexes([4, 4, 0, 2, -1, 2, 7])).toEqual([4, 2, 7]);
  });

  it('liste vide reste vide', () => {
    expect(normalizeHighlightIndexes([])).toEqual([]);
  });
});

describe('highlightHasContent', () => {
  it('vrai si au moins un virage', () => {
    expect(highlightHasContent({ highlightCornerIndexes: [3] })).toBe(true);
  });

  it('vrai si une note', () => {
    expect(highlightHasContent({ highlightCornerIndexes: [], note: 'Commencez par le 4' })).toBe(
      true
    );
  });

  it('faux si rien', () => {
    expect(highlightHasContent({ highlightCornerIndexes: [], note: '   ' })).toBe(false);
    expect(highlightHasContent({ highlightCornerIndexes: [0, -2] })).toBe(false);
  });
});

describe('validateTemplate', () => {
  it('accepte un gabarit valide', () => {
    expect(validateTemplate({ label: 'Sortie', body: 'Sortie large, patience.' })).toBeNull();
  });

  it('refuse un nom vide', () => {
    expect(validateTemplate({ label: '  ', body: 'x' })).toMatch(/nom/i);
  });

  it('refuse un corps vide', () => {
    expect(validateTemplate({ label: 'x', body: '   ' })).toMatch(/vide/i);
  });

  it('refuse un corps trop long', () => {
    expect(validateTemplate({ label: 'x', body: 'a'.repeat(1001) })).toMatch(/trop long/i);
  });
});
