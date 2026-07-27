import { computeDelta, idealLapTime } from '../delta';
import { cumulativeDistance, type Sample } from '../kinematics';
import type { DistanceSeries } from '../resample';

/**
 * Fabrique une trace à vitesse variable, échantillonnée à 25 Hz, et rend sa
 * série vitesse-par-distance — la forme que consomme le delta.
 */
function trace(vitesseA: (t: number) => number, duree = 60, hz = 25): DistanceSeries {
  const samples: Sample[] = [];
  for (let i = 0; i <= duree * hz; i++) {
    const t = i / hz;
    samples.push({ t, speed: vitesseA(t) });
  }
  return {
    distance: cumulativeDistance(samples),
    values: samples.map((s) => s.speed),
  };
}

describe('computeDelta — LE CRITÈRE D’ACCEPTATION DE T1bis', () => {
  // « Le delta cumulé se referme à zéro sur un tour comparé à lui-même. S'il ne
  // le fait pas, le ré-échantillonnage ou l'intégration sont faux. »
  it('se referme à zéro sur un tour comparé à LUI-MÊME (vitesse variable)', () => {
    const t = trace((s) => 30 + 20 * Math.sin(s / 4) + 8 * Math.sin(s / 1.7));
    const d = computeDelta(t, t, 5);

    expect(d.total).not.toBeNull();
    expect(Math.abs(d.total!)).toBeLessThan(1e-9);
    for (const c of d.cumulative) {
      if (c === null) continue;
      expect(Math.abs(c)).toBeLessThan(1e-9);
    }
  });

  it('se referme à zéro quel que soit le pas de grille', () => {
    const t = trace((s) => 25 + 18 * Math.sin(s / 3));
    for (const pas of [1, 2, 5, 10, 25]) {
      const d = computeDelta(t, t, pas);
      expect(Math.abs(d.total ?? 1)).toBeLessThan(1e-9);
    }
  });

  it('se referme à zéro sur un profil accidenté, avec freinages marqués', () => {
    // Trois freinages francs et trois relances : le cas où une intégration
    // fausse se verrait.
    const t = trace((s) => {
      const phase = s % 20;
      if (phase < 8) return 55;
      if (phase < 11) return 55 - (phase - 8) * 13;
      if (phase < 14) return 16;
      return 16 + (phase - 14) * 6.5;
    });
    const d = computeDelta(t, t, 5);
    expect(Math.abs(d.total ?? 1)).toBeLessThan(1e-9);
  });
});

describe('computeDelta — signe et lecture', () => {
  it('rend un delta POSITIF quand le tour courant est plus lent', () => {
    const rapide = trace(() => 40);
    const lent = trace(() => 36);
    const d = computeDelta(lent, rapide, 5);
    expect(d.total).not.toBeNull();
    expect(d.total!).toBeGreaterThan(0);
  });

  it('rend un delta NÉGATIF quand le tour courant est plus rapide', () => {
    const rapide = trace(() => 44);
    const reference = trace(() => 40);
    const d = computeDelta(rapide, reference, 5);
    expect(d.total!).toBeLessThan(0);
  });

  it('chiffre correctement un écart constant de vitesse', () => {
    // Sur 1 000 m à 40 contre 50 m/s : 25 s contre 20 s, soit +5 s.
    const lent: DistanceSeries = {
      distance: Array.from({ length: 1001 }, (_, i) => i),
      values: Array.from({ length: 1001 }, () => 40),
    };
    const ref: DistanceSeries = {
      distance: Array.from({ length: 1001 }, (_, i) => i),
      values: Array.from({ length: 1001 }, () => 50),
    };
    const d = computeDelta(lent, ref, 1);
    expect(d.total!).toBeCloseTo(5, 6);
  });

  it('le cumul est la somme des instantanés', () => {
    const a = trace((s) => 30 + 10 * Math.sin(s / 5));
    const b = trace((s) => 32 + 9 * Math.sin(s / 4));
    const d = computeDelta(a, b, 5);
    let somme = 0;
    for (let i = 0; i < d.instant.length; i++) {
      const v = d.instant[i];
      if (v === null) continue;
      somme += v;
      expect(d.cumulative[i]).toBeCloseTo(somme, 9);
    }
  });
});

describe('computeDelta — l’absence ne se fabrique pas', () => {
  it('rend un total null quand rien n’est exploitable', () => {
    const vide: DistanceSeries = { distance: [], values: [] };
    const d = computeDelta(vide, vide, 5);
    expect(d.total).toBeNull();
  });

  it('ÉCARTE et COMPTE les pas sous le plancher de vitesse', () => {
    // Une trace à l'arrêt : 1/v exploserait et un seul point dominerait le tour.
    const arret: DistanceSeries = {
      distance: [0, 10, 20, 30],
      values: [0.1, 0.1, 0.1, 0.1],
    };
    const normal: DistanceSeries = {
      distance: [0, 10, 20, 30],
      values: [30, 30, 30, 30],
    };
    const d = computeDelta(arret, normal, 5);
    expect(d.skipped).toBeGreaterThan(0);
    // Aucune valeur folle ne s'est glissée dans la courbe.
    for (const c of d.cumulative) {
      if (c === null) continue;
      expect(Number.isFinite(c)).toBe(true);
    }
  });

  it('borne la comparaison à l’emprise PARTAGÉE des deux traces', () => {
    const courte: DistanceSeries = { distance: [0, 100], values: [30, 30] };
    const longue: DistanceSeries = { distance: [0, 5000], values: [30, 30] };
    const d = computeDelta(courte, longue, 10);
    expect(d.distance[d.distance.length - 1]).toBeLessThanOrEqual(100);
  });
});

describe('idealLapTime — une cible théorique, jamais un tour réel', () => {
  it('retient le meilleur de chaque micro-secteur', () => {
    const r = idealLapTime(
      [
        [1, 5, 3],
        [4, 2, 6],
      ],
      3
    );
    expect(r.parSecteur).toEqual([1, 2, 3]);
    expect(r.total).toBe(6);
  });

  it('rend null si UN SEUL micro-secteur manque — pas une cible amputée', () => {
    const r = idealLapTime(
      [
        [1, null, 3],
        [4, null, 6],
      ],
      3
    );
    expect(r.total).toBeNull();
    expect(r.parSecteur[1]).toBeNull();
  });

  it('rend null sans aucun tour', () => {
    expect(idealLapTime([], 3).total).toBeNull();
  });

  it('ignore un tour dont le découpage ne correspond pas', () => {
    const r = idealLapTime(
      [
        [1, 2, 3],
        [9, 9], // mauvais nombre de secteurs
      ],
      3
    );
    expect(r.total).toBe(6);
  });
});
