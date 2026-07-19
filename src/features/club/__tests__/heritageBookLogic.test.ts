/**
 * Tests heritageBookLogic (V2-L5 CLUB, Mission D, C3) — plan PUR du Carnet
 * Heritage. ts-jest node. Verrouille la STRUCTURE réelle (pages) et le gating
 * doctrinal : réservé au tier Heritage, autant de Signatures que de séances
 * RÉELLES, jamais une page fabriquée.
 */

import {
  HERITAGE_SIGNATURE_IDEAL,
  heritageBookProgress,
  planHeritageBook,
  type HeritageBookSessionInput,
} from '../heritageBookLogic';

function session(id: string): HeritageBookSessionInput {
  return {
    sessionId: id,
    startedAt: null,
    circuitName: null,
    bestLapMs: null,
    lapCount: null,
    pillars: [],
    photoUrl: null,
    hasTrace: false,
  };
}

describe('planHeritageBook — gating tier', () => {
  it('rend null hors du tier Heritage', () => {
    expect(
      planHeritageBook({ isHeritage: false, year: 2026, sessions: [session('a')] })
    ).toBeNull();
  });

  it('rend null sans séance réelle (jamais un livret fabriqué)', () => {
    expect(planHeritageBook({ isHeritage: true, year: 2026, sessions: [] })).toBeNull();
  });
});

describe('planHeritageBook — structure', () => {
  it("une séance : couverture + 1 Signature + colophon (pas d'évolution)", () => {
    const plan = planHeritageBook({ isHeritage: true, year: 2026, sessions: [session('a')] });
    expect(plan).not.toBeNull();
    expect(plan?.pages.map((p) => p.kind)).toEqual(['cover', 'signature', 'colophon']);
    expect(plan?.sessionCount).toBe(1);
  });

  it('trois séances : couverture + 3 Signatures + évolution + colophon', () => {
    const plan = planHeritageBook({
      isHeritage: true,
      year: 2026,
      sessions: [session('a'), session('b'), session('c')],
    });
    expect(plan?.pages.map((p) => p.kind)).toEqual([
      'cover',
      'signature',
      'signature',
      'signature',
      'evolution',
      'colophon',
    ]);
    // index des Signatures = 0..n-1, une par séance réelle
    const sigs = plan?.pages.filter((p) => p.kind === 'signature') ?? [];
    expect(sigs).toHaveLength(3);
    expect(sigs.map((p) => (p.kind === 'signature' ? p.index : -1))).toEqual([0, 1, 2]);
    expect(sigs.map((p) => (p.kind === 'signature' ? p.sessionId : ''))).toEqual(['a', 'b', 'c']);
  });

  it('adapte honnêtement : 4 séances = 4 Signatures (idéal atteint, pas plafonné)', () => {
    const plan = planHeritageBook({
      isHeritage: true,
      year: 2026,
      sessions: [session('a'), session('b'), session('c'), session('d')],
    });
    const sigCount = plan?.pages.filter((p) => p.kind === 'signature').length ?? 0;
    expect(sigCount).toBe(HERITAGE_SIGNATURE_IDEAL);
  });

  it('porte la couverture avec le décompte réel et le colophon en dernier', () => {
    const plan = planHeritageBook({
      isHeritage: true,
      year: 2026,
      sessions: [session('a'), session('b')],
    });
    const cover = plan?.pages[0];
    expect(cover).toEqual({ kind: 'cover', year: 2026, sessionCount: 2 });
    expect(plan?.pages[plan.pages.length - 1].kind).toBe('colophon');
  });
});

describe('heritageBookProgress', () => {
  it('rapporte la progression au nombre de pages, bornée à [0,1]', () => {
    expect(heritageBookProgress(0, 4)).toBe(0);
    expect(heritageBookProgress(2, 4)).toBe(0.5);
    expect(heritageBookProgress(5, 4)).toBe(1);
    expect(heritageBookProgress(1, 0)).toBe(0);
  });
});
