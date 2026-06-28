/**
 * Tests de l'heuristique de sélection du focus corner (#16).
 *
 * Valide la priorité doctrinale : rouge > jaune > rien.
 * Valide aussi la formulation non-directive (verbes interdits absents).
 */

import { isDoctrineSafe } from '../aiSafetyFilter';
import { safeFocusPhrase, selectExplicitFocusCorner, selectFocusCorner } from '../focusCorner';
import type { MarginZone } from '@/types/domain';

// Source UNIQUE du lexique proscrit : le filtre doctrinal (T-1). On y ajoute
// deux extras de CONTEXTE focusCorner (comparatifs directifs « plus tôt / plus
// tard »), volontairement hors du filtre général car trop sujets aux faux
// positifs en prose descriptive, mais proscrits dans une phrase de focus.
const CONTEXT_EXTRAS = ['plus tôt', 'plus tard'];

function expectNonDirective(phrase: string): void {
  expect(isDoctrineSafe(phrase)).toBe(true);
  const lower = phrase.toLowerCase();
  for (const x of CONTEXT_EXTRAS) {
    expect(lower).not.toContain(x);
  }
}

describe('selectFocusCorner', () => {
  it('priorise un rouge même quand plusieurs jaunes existent', () => {
    const margins: Record<number, MarginZone> = {
      1: 'green',
      2: 'yellow',
      3: 'yellow',
      6: 'red',
      7: 'yellow',
    };
    for (let i = 1; i <= 7; i++) {
      if (!margins[i]) margins[i] = 'green';
    }
    const sel = selectFocusCorner(margins);
    expect(sel).not.toBeNull();
    expect(sel!.zone).toBe('red');
    expect(sel!.corner.index).toBe(6);
  });

  it('prend le rouge avec la plus petite marge si plusieurs rouges', () => {
    const margins: Record<number, MarginZone> = {};
    for (let i = 1; i <= 7; i++) margins[i] = 'green';
    margins[3] = 'red';
    margins[5] = 'red';
    const sel = selectFocusCorner(margins, { 3: 8, 5: 3 });
    expect(sel!.corner.index).toBe(5);
  });

  it('prend le jaune le plus faible si aucun rouge', () => {
    const margins: Record<number, MarginZone> = {};
    for (let i = 1; i <= 7; i++) margins[i] = 'green';
    margins[2] = 'yellow';
    margins[6] = 'yellow';
    const sel = selectFocusCorner(margins, { 2: 25, 6: 16 });
    expect(sel!.corner.index).toBe(6);
  });

  it('renvoie null quand tout est vert (rien à proposer)', () => {
    const margins: Record<number, MarginZone> = {};
    for (let i = 1; i <= 7; i++) margins[i] = 'green';
    expect(selectFocusCorner(margins)).toBeNull();
  });

  it('renvoie null sur un mapping vide (V1 robustness)', () => {
    expect(selectFocusCorner({})).toBeNull();
  });

  it('produit une phrase non-directive (pas de verbes interdits)', () => {
    const margins: Record<number, MarginZone> = {};
    for (let i = 1; i <= 7; i++) margins[i] = 'green';
    margins[5] = 'red';
    margins[3] = 'yellow';

    const red = selectFocusCorner(margins);
    expectNonDirective(red!.phrase);
    expectNonDirective(red!.observation);

    margins[5] = 'green'; // on enlève le rouge
    const yellow = selectFocusCorner(margins);
    expectNonDirective(yellow!.phrase);
    expectNonDirective(yellow!.observation);
  });

  it('inclut le nom du virage dans la phrase', () => {
    const margins: Record<number, MarginZone> = {};
    for (let i = 1; i <= 7; i++) margins[i] = 'green';
    margins[7] = 'red';
    const sel = selectFocusCorner(margins);
    // Virage 7 = "La ramenée" depuis refactor sem 16
    expect(sel!.phrase).toContain('La ramenée');
  });
});

describe('safeFocusPhrase — garde-fou doctrinal (T-1)', () => {
  it('garde la phrase nommée quand le nom du virage est conforme', () => {
    const p = safeFocusPhrase('La ramenée', 'red');
    expect(p).toBe('La ramenée a été serré.');
    expect(isDoctrineSafe(p)).toBe(true);
  });

  it('retombe sur une variante neutre si le nom du virage porte une tournure proscrite', () => {
    const p = safeFocusPhrase('Freinez', 'red');
    expect(p).toBe('Cette zone a été serrée.');
    expect(p.toLowerCase()).not.toContain('freinez');
    expect(isDoctrineSafe(p)).toBe(true);
  });

  it('neutralise aussi un nom piégé en zone jaune', () => {
    const p = safeFocusPhrase('Évitez la corde', 'yellow');
    expect(p.toLowerCase()).not.toContain('évitez');
    expect(isDoctrineSafe(p)).toBe(true);
  });
});

describe('selectExplicitFocusCorner', () => {
  it('renvoie une sélection pour un index valide', () => {
    const sel = selectExplicitFocusCorner(3, 'yellow', 22);
    expect(sel).not.toBeNull();
    expect(sel!.corner.index).toBe(3);
    expect(sel!.zone).toBe('yellow');
    expect(sel!.estimatedMargin).toBe(22);
  });

  it('renvoie null pour un index hors plage', () => {
    expect(selectExplicitFocusCorner(0, 'red')).toBeNull();
    expect(selectExplicitFocusCorner(99, 'red')).toBeNull();
  });
});
