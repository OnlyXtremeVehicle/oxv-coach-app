/**
 * LA PISTE CONSTRUITE DEPUIS LA BASE — ce qu'elle découpe, et ce qu'elle refuse.
 *
 * Le découpage était écrit en dur : sept segments de Haute Saintonge, appliqués
 * à n'importe quelle séance. La garde du 30/08 a arrêté cela en refusant
 * d'analyser ailleurs, ce qui laissait le trou entier — plus aucune séance
 * réelle n'avait de segments. Ces tests tiennent ce qui comble le trou.
 */

import { pisteDepuisBase, POINTS_TRACE_MIN } from '../pisteDepuisBase';
import type { VirageCircuit } from '@/features/data/viragesCircuit';

const TRACE = [
  { lat: 45.24, lon: -0.09 },
  { lat: 45.241, lon: -0.091 },
  { lat: 45.242, lon: -0.092 },
  { lat: 45.243, lon: -0.093 },
  { lat: 45.244, lon: -0.094 },
];

function virage(index: number, s: number | null, nom: string | null = null): VirageCircuit {
  return { index, nom, sens: 'gauche', positionNormalisee: s, rayonM: 40 };
}

describe('pisteDepuisBase', () => {
  it('rend un segment par virage situé', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.1), virage(2, 0.5), virage(3, 0.9)]);
    expect(p).not.toBeNull();
    expect(p!.segments.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  /**
   * LA RÈGLE DES BORNES : à mi-chemin entre deux cordes. Elle n'invente ni angle
   * d'entrée ni longueur de freinage — deux choses que `circuits.corners` ne
   * porte pas.
   */
  it('pose les bornes à mi-chemin entre deux cordes', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.2), virage(2, 0.6)]);
    const [a, b] = p!.segments;
    expect(a.progressStart).toBe(0);
    expect(a.progressEnd).toBeCloseTo(0.4, 4);
    expect(b.progressStart).toBeCloseTo(0.4, 4);
    expect(b.progressEnd).toBe(1);
  });

  /**
   * On ne franchit PAS la ligne : le premier segment part de 0, le dernier
   * finit à 1. Un segment modulaire vaudrait quelques mètres de bitume et
   * coûterait une classe de bugs à tout ce qui lit ces deux nombres.
   */
  it('le tour est couvert de 0 à 1, sans segment qui enjambe la ligne', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.1), virage(2, 0.5), virage(3, 0.95)]);
    for (const s of p!.segments) {
      expect(s.progressStart).toBeLessThan(s.progressEnd);
    }
    expect(p!.segments[0].progressStart).toBe(0);
    expect(p!.segments[p!.segments.length - 1].progressEnd).toBe(1);
  });

  it('trie par position, même si la base rend les virages en désordre', () => {
    const p = pisteDepuisBase(TRACE, [virage(3, 0.9), virage(1, 0.1), virage(2, 0.5)]);
    expect(p!.segments.map((s) => s.apexProgress)).toEqual([0.1, 0.5, 0.9]);
  });

  it('écarte un virage sans position — il n’a pas d’endroit sur le tour', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.2), virage(2, null), virage(3, 0.8)]);
    expect(p!.segments.map((s) => s.order)).toEqual([1, 3]);
  });

  it('garde le nom de la base, et numérote les autres', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.2, 'L’Épingle'), virage(2, 0.8)]);
    expect(p!.segments[0].name).toBe('L’Épingle');
    expect(p!.segments[1].name).toBe('Virage 2');
  });

  it('n’écrit aucun conseil — le champ existe et reste vide', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.5)]);
    expect(p!.segments[0].coachingFocus).toBe('');
  });

  it('tous les segments sont des virages : le détecteur ne trouve que ça', () => {
    const p = pisteDepuisBase(TRACE, [virage(1, 0.3), virage(2, 0.7)]);
    expect(p!.segments.every((s) => s.kind === 'turn')).toBe(true);
  });

  describe('ce qui rend null plutôt qu’une piste approximative', () => {
    it('un tracé trop court', () => {
      const court = TRACE.slice(0, POINTS_TRACE_MIN - 1);
      expect(pisteDepuisBase(court, [virage(1, 0.5)])).toBeNull();
    });

    it('aucun tracé', () => {
      expect(pisteDepuisBase(null, [virage(1, 0.5)])).toBeNull();
      expect(pisteDepuisBase(undefined, [virage(1, 0.5)])).toBeNull();
    });

    it('aucun virage situé', () => {
      expect(pisteDepuisBase(TRACE, [])).toBeNull();
      expect(pisteDepuisBase(TRACE, [virage(1, null)])).toBeNull();
    });

    it('une position hors de [0, 1] est écartée, jamais ramenée aux bornes', () => {
      expect(pisteDepuisBase(TRACE, [virage(1, 1.4), virage(2, -0.2)])).toBeNull();
    });
  });

  /**
   * BOUTEVILLE, DOUZE VIRAGES — la séance de référence. La contrainte de base
   * plafonnait `segment_index` à 7 jusqu'au 01/09 ; les virages 8 à 12 étaient
   * refusés à l'insertion, et la table restait vide.
   */
  it('douze virages donnent douze segments, jusqu’au douzième', () => {
    const douze = Array.from({ length: 12 }, (_, i) => virage(i + 1, (i + 0.5) / 12));
    const p = pisteDepuisBase(TRACE, douze);
    expect(p!.segments).toHaveLength(12);
    expect(p!.segments[11].order).toBe(12);
  });
});
