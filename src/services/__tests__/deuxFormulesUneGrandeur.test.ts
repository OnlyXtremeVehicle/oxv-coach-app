/**
 * DEUX FORMULES, UNE SEULE GRANDEUR — et elles ne s'accordent pas.
 *
 * ===========================================================================
 * CE QUE CE TEST FIGE, ET POURQUOI IL EXISTE
 * ===========================================================================
 *
 * Le 13/08 au soir, j'ai écrit dans quatre fichiers que `qdi.regularite` et
 * `margin_breakdown.regularity` étaient **deux mesures différentes** — l'une la
 * constance du geste, l'autre la dispersion des temps au tour. C'était faux.
 *
 * `qdiLogic.computeRegularite` reçoit `laps.map((l) => l.durationSeconds)`.
 * Les deux partent des MÊMES temps au tour. Une grandeur, deux formules :
 *
 *     QDI    — coefficient de variation (écart-type / moyenne), sur [0 ; 6 %] ;
 *     marge  — écart-type ABSOLU, pénalisé de 25 points par seconde au-delà
 *              d'une seconde.
 *
 * Ce test rejoue les deux sur les **trois tours réels de Bouteville** et
 * confronte le résultat aux deux valeurs lues en production. Il transforme
 * l'affirmation en reproduction — c'est précisément ce qui manquait la
 * première fois.
 *
 * ===========================================================================
 * IL FIGE AUSSI LE DÉFAUT, PAS SEULEMENT L'ACCORD
 * ===========================================================================
 *
 * Le seuil de la marge est absolu : une seconde, quelle que soit la durée du
 * tour. Sur des tours de 5 min 42, un écart-type de 13,6 s vaut 3,98 % — une
 * régularité très correcte — et la formule rend **zéro**.
 *
 * Le dernier cas le montre par construction : deux séries de MÊME dispersion
 * relative, l'une sur des tours courts, l'autre sur des tours longs, reçoivent
 * la même note QDI et deux notes de marge opposées. Tant que ce test est vert,
 * le défaut est là — et documenté plutôt que découvert deux fois.
 */

import { computeRegularite } from '@/services/qdiLogic';

/** La formule de la marge, recopiée à l'identique de `marginCalculator`. */
function margeConsistency(lapSeconds: number[]): number {
  const n = lapSeconds.length;
  const mean = lapSeconds.reduce((a, b) => a + b, 0) / n;
  const variance = lapSeconds.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const ecartType = Math.sqrt(variance);
  return Math.max(0, Math.min(100, 100 - Math.max(0, ecartType - 1) * 25));
}

/** Les trois tours de la séance `ff384ace…`, lus en production le 14/08/2026. */
const BOUTEVILLE = [360.485, 327.542, 339.483];

describe('Bouteville — les deux formules reproduisent la base', () => {
  it('le QDI rend 34, comme la colonne `qdi`', () => {
    expect(computeRegularite(BOUTEVILLE)).toBe(34);
  });

  it('la marge rend 0, comme la clé `margin_breakdown`', () => {
    expect(margeConsistency(BOUTEVILLE)).toBe(0);
  });

  /**
   * L'écart n'est donc PAS un bug de lecture : les deux calculs sont corrects
   * pour leur propre définition. C'est la définition de la marge qui ne tient
   * pas compte de la longueur du tour.
   */
  it('les deux partent bien des mêmes tours — l’écart vient des formules', () => {
    const n = BOUTEVILLE.length;
    const moyenne = BOUTEVILLE.reduce((a, b) => a + b, 0) / n;
    const ecartType = Math.sqrt(BOUTEVILLE.reduce((a, b) => a + (b - moyenne) ** 2, 0) / n);
    expect(moyenne).toBeCloseTo(342.503, 2);
    expect(ecartType).toBeCloseTo(13.617, 2);
    // 3,98 % de dispersion relative — et la marge la note zéro.
    expect((ecartType / moyenne) * 100).toBeCloseTo(3.98, 1);
  });
});

describe('le seuil de la marge ignore la longueur du tour', () => {
  /**
   * Même dispersion RELATIVE (4 %), deux longueurs de tour. Le QDI, qui
   * raisonne en proportion, rend la même note. La marge, qui raisonne en
   * secondes, rend 40 sur les tours courts et 0 sur les longs.
   */
  const COURTS = [57.6, 60.0, 62.4]; // moyenne 60 s
  const LONGS = [326.4, 340.0, 353.6]; // moyenne 340 s, même 4 %

  it('le QDI donne la MÊME note aux deux séries', () => {
    expect(computeRegularite(COURTS)).toBe(computeRegularite(LONGS));
  });

  it('la marge donne deux notes opposées à la même régularité', () => {
    const courts = margeConsistency(COURTS);
    const longs = margeConsistency(LONGS);
    expect(courts).toBeGreaterThan(longs);
    expect(longs).toBe(0);
    // L'écart est massif, pas marginal : c'est ce qui en fait un défaut.
    expect(courts - longs).toBeGreaterThan(30);
  });

  /**
   * Le correctif tient en une division — mais il déplacerait `margin_global`,
   * le seul chiffre que l'écran affiche. Registre fondateur § 0.9.
   */
  it('en relatif, les deux séries se rejoindraient', () => {
    const relatif = (laps: number[]) => {
      const n = laps.length;
      const moyenne = laps.reduce((a, b) => a + b, 0) / n;
      const cv = Math.sqrt(laps.reduce((a, b) => a + (b - moyenne) ** 2, 0) / n) / moyenne;
      return Math.max(0, Math.min(100, 100 - Math.max(0, cv - 0.01) * 2000));
    };
    // `toBeCloseTo`, pas `toBe` : les deux séries n'ont pas exactement la même
    // dispersion relative au bit près (57,6/60,0/62,4 contre
    // 326,4/340,0/353,6), et l'égalité flottante achoppe au douzième chiffre.
    // Ce que le test affirme, c'est que l'écart DISPARAÎT — pas qu'il est nul
    // au sens de la machine.
    expect(relatif(COURTS)).toBeCloseTo(relatif(LONGS), 6);
  });
});
