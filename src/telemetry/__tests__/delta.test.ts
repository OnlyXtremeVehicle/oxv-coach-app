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

/**
 * ===========================================================================
 * LE CRITÈRE D'ACCEPTATION DE T1bis, ET POURQUOI IL A DÛ ÊTRE ARMÉ
 * ===========================================================================
 *
 * Le plan de montage pose : « le delta cumulé se referme à zéro sur un tour
 * comparé à lui-même. S'il ne le fait pas, le ré-échantillonnage ou
 * l'intégration sont faux. »
 *
 * LES TROIS PREMIERS TESTS NE PROUVENT PAS CELA. Relevé le 04/08/2026.
 *
 * Ils passent le MÊME OBJET des deux côtés — `computeDelta(t, t, 5)`.
 * `resampleOnGrid` étant pur et déterministe, les deux ré-échantillonnages
 * sortent identiques bit à bit, donc `b - a` vaut exactement zéro à
 * `delta.ts:111`, AVANT toute intégration. Le total est nul quelle que soit la
 * justesse du ré-échantillonnage : **un resampleur faux passerait ces trois
 * tests**. La tolérance à 1e-9 est décorative — le résultat est 0 strict.
 *
 * Ils gardent une valeur, et elle est réelle : ils prouvent le DÉTERMINISME et
 * l'absence d'accumulation d'erreur en virgule flottante le long du cumul. Ce
 * n'est pas ce que le plan demande, mais ce n'est pas rien. Ils restent, sous
 * leur vrai nom.
 *
 * Ce que le plan demande vient ensuite : le MÊME TOUR PHYSIQUE, échantillonné
 * autrement. Là, les deux séries diffèrent réellement, le ré-échantillonnage
 * travaille, et l'intégration aussi.
 */
describe('computeDelta — déterminisme (ce n’est PAS le critère du plan)', () => {
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

describe('computeDelta — LE CRITÈRE D’ACCEPTATION DE T1bis', () => {
  // Le même tour physique, échantillonné à deux cadences. Les deux séries
  // diffèrent réellement — cadence, nombre de points, axe de distance obtenu
  // par intégration trapézoïdale d'un profil différemment discrétisé. Le
  // ré-échantillonnage travaille pour de bon, et l'intégration aussi.
  const PROFIL = (t: number): number => 30 + 20 * Math.sin(t / 4) + 8 * Math.sin(t / 1.7);

  it('se referme à quelques millisecondes sur le MÊME TOUR à deux cadences', () => {
    const a = trace(PROFIL, 60, 25);
    const b = trace(PROFIL, 60, 10);
    const d = computeDelta(a, b, 5);

    expect(d.total).not.toBeNull();

    // LA GARDE CONTRE LA DÉGÉNÉRESCENCE. Si un jour quelqu'un « répare » ce
    // test en repassant le même objet des deux côtés, le total redeviendra nul
    // exactement et cette ligne le dira. Un critère qui ne peut pas échouer ne
    // vérifie rien.
    expect(Math.abs(d.total!)).toBeGreaterThan(0);

    // Mesuré le 04/08/2026 : −5,347 ms sur un tour de 60 s. La borne laisse
    // une marge d'un facteur deux ; elle n'est pas là pour absorber du bruit
    // (le calcul est déterministe) mais pour rester lisible si le profil de
    // test bouge. Un ré-échantillonnage faux sort de plusieurs centaines de
    // millisecondes, pas de quelques-unes.
    expect(Math.abs(d.total!)).toBeLessThan(0.012);
  });

  it('se resserre quand les deux cadences se rapprochent', () => {
    // La signature d'un ré-échantillonnage juste : l'écart résiduel est un
    // artefact de discrétisation, donc il DIMINUE quand les deux traces se
    // ressemblent. Un écart qui ne bougerait pas viendrait d'ailleurs.
    const a = trace(PROFIL, 60, 25);
    const loin = Math.abs(computeDelta(a, trace(PROFIL, 60, 5), 5).total!);
    const moyen = Math.abs(computeDelta(a, trace(PROFIL, 60, 10), 5).total!);
    const proche = Math.abs(computeDelta(a, trace(PROFIL, 60, 20), 5).total!);

    expect(proche).toBeLessThan(moyen);
    expect(moyen).toBeLessThan(loin);
    expect(proche).toBeLessThan(0.003);
  });
});

describe('computeDelta — le biais de quadrature, mesuré et borné', () => {
  // `delta.ts:109-111` prend les vitesses au seul indice `i` : rectangle à
  // droite, ordre 1. `cumulativeDistance` intègre par trapèzes, ordre 2. Cette
  // asymétrie a un coût, et il n'était mesuré nulle part.
  //
  // Profil à solution analytique : v(s) = v0 (1 + k s) sur une distance D.
  //   ∫ ds / v(s) = ln(1 + k D) / (v0 k)
  const v0 = 20;
  const D = 2000;
  const rampe = (k: number): DistanceSeries => {
    const distance = Array.from({ length: Math.floor(D / 0.5) + 1 }, (_, i) => i * 0.5);
    return { distance, values: distance.map((s) => v0 * (1 + k * s)) };
  };
  const tempsExact = (k: number): number => Math.log(1 + k * D) / (v0 * k);

  it('l’erreur croît LINÉAIREMENT avec le pas — c’est la signature de l’ordre 1', () => {
    const exact = tempsExact(0.002) - D / 30;
    const plat: DistanceSeries = {
      distance: rampe(0.002).distance,
      values: rampe(0.002).distance.map(() => 30),
    };
    const erreur = (pas: number): number =>
      Math.abs((computeDelta(rampe(0.002), plat, pas).total as number) - exact);

    // Mesuré : 19,99 ms à 1 m · 99,80 ms à 5 m · 199,20 ms à 10 m. Le rapport
    // suit le pas. Si un jour l'intégration passait aux trapèzes, ce test
    // tomberait — et ce serait une bonne nouvelle à constater, pas un échec.
    expect(erreur(5) / erreur(1)).toBeGreaterThan(4);
    expect(erreur(5) / erreur(1)).toBeLessThan(6);
    expect(erreur(10) / erreur(5)).toBeGreaterThan(1.8);
    expect(erreur(10) / erreur(5)).toBeLessThan(2.2);
  });

  it('l’erreur est RELATIVE au delta, pas un décalage fixe', () => {
    // Le fait qui rend le biais acceptable en production. Sur deux tours
    // semblables — le cas réel, un pilote sur un même circuit — l'erreur vaut
    // environ un millième du delta. Sur un écart d'une demi-seconde, c'est un
    // demi-millième de seconde.
    for (const [k1, k2] of [
      [0.002, 0.0019],
      [0.002, 0.0018],
      [0.002, 0.0015],
    ]) {
      const exact = tempsExact(k1) - tempsExact(k2);
      const obtenu = computeDelta(rampe(k1), rampe(k2), 5).total as number;
      const relatif = Math.abs((obtenu - exact) / exact);

      // Mesuré le 04/08/2026 : 0,099 % · 0,100 % · 0,104 %.
      expect(relatif).toBeLessThan(0.002);
    }
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
