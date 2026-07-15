/**
 * Base de temps monotone (Valencia §4.6) — garanties de non-régression.
 *
 * On vérifie que la suite des valeurs retournées est NON DÉCROISSANTE et que la
 * DIFFÉRENCE de deux instants monotones (une durée de tour) reste correcte et
 * jamais négative, même si l'horloge murale recule entre deux points.
 */

import { nextMonotonic } from '../monotonicClock';

describe('nextMonotonic', () => {
  it('ne recule jamais : renvoie le max(dernier retenu, horloge murale)', () => {
    expect(nextMonotonic(1000, 900)).toBe(1000); // recul mural ignoré
    expect(nextMonotonic(1000, 1500)).toBe(1500); // avance mural suivie
    expect(nextMonotonic(1000, 1000)).toBe(1000); // égalité
    expect(nextMonotonic(0, 0)).toBe(0);
  });

  it('sur horloge murale saine, la durée monotone égale la durée murale', () => {
    let mono = 0;
    mono = nextMonotonic(mono, 200_000); // passage A
    const monoA = mono;
    mono = nextMonotonic(mono, 230_000); // frame intermédiaire
    mono = nextMonotonic(mono, 291_500); // passage B
    const monoB = mono;

    expect(monoB - monoA).toBe(91_500); // = 291500 - 200000, durée murale exacte
  });

  it('une durée de tour ne devient jamais négative si l’horloge murale recule', () => {
    let mono = 0;
    mono = nextMonotonic(mono, 100_000); // passage A (mural 100000)
    const monoA = mono;
    mono = nextMonotonic(mono, 100_500); // frame : horloge encore en avance
    mono = nextMonotonic(mono, 94_000); // SAUT ARRIÈRE (resync NTP) : mono tient
    mono = nextMonotonic(mono, 94_800); // passage B, horloge toujours en retard
    const monoB = mono;

    const naiveDurationMs = 94_800 - 100_000; // simple différence murale
    const monotonicDurationMs = monoB - monoA;

    expect(naiveDurationMs).toBeLessThan(0); // aberrant : temps de tour négatif
    expect(monotonicDurationMs).toBeGreaterThanOrEqual(0); // jamais faussé par le recul
    expect(monotonicDurationMs).toBe(500); // = plus haut palier atteint (100500) - départ (100000)
  });

  it('la suite reste non décroissante sur une séquence murale chaotique', () => {
    const wall = [1000, 1200, 1100, 1150, 900, 2000, 1990];
    let mono = 0;
    const monoSeq: number[] = [];
    for (const w of wall) {
      mono = nextMonotonic(mono, w);
      monoSeq.push(mono);
    }
    for (let i = 1; i < monoSeq.length; i += 1) {
      expect(monoSeq[i]).toBeGreaterThanOrEqual(monoSeq[i - 1]);
    }
    expect(monoSeq[monoSeq.length - 1]).toBe(2000); // plus haut palier atteint
  });
});
