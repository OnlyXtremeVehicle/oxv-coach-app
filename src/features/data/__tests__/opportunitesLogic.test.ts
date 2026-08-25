/**
 * Écarts locaux par segment — module M07.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 *   - LE CONTRAT DU CAHIER : la somme des écarts locaux se réconcilie au delta
 *     total du tour dans la tolérance nommée — vérifié sur un delta RÉEL
 *     (computeDelta), trous compris ;
 *   - les signes : un segment où le tour courant est plus lent rend un écart
 *     positif, jamais l'inverse ;
 *   - l'ordre : segments triés par écart local décroissant — le potentiel,
 *     pas un classement ;
 *   - la doctrine : aucune cause attribuée — le verrou lexical relit la source.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { computeDelta, type DeltaResult } from '@/telemetry/delta';
import type { DistanceSeries } from '@/telemetry/resample';

import {
  calculeOpportunites,
  LONGUEUR_SEGMENT_M_DEFAUT,
  OPPORTUNITES_ALGO_VERSION,
  TOLERANCE_RECONCILIATION_S,
} from '../opportunitesLogic';

/** Une trace de vitesse (m/s) échantillonnée tous les 5 m sur [0, longueur]. */
function trace(longueurM: number, vitesse: (d: number) => number): DistanceSeries {
  const distance: number[] = [];
  const values: number[] = [];
  for (let d = 0; d <= longueurM; d += 5) {
    distance.push(d);
    values.push(vitesse(d));
  }
  return { distance, values };
}

/** Tour de référence : 50 m/s constants sur 1000 m. */
const REFERENCE = trace(1000, () => 50);

/** Tour courant : 40 m/s entre 200 et 400 m, 50 m/s ailleurs. */
const COURANT = trace(1000, (d) => (d >= 200 && d < 400 ? 40 : 50));

describe('la réconciliation — contrat du cahier', () => {
  it('la somme des écarts locaux retombe sur le delta total, dans la tolérance', () => {
    const delta = computeDelta(COURANT, REFERENCE);
    const r = calculeOpportunites(delta)!;
    expect(r.totalS).not.toBeNull();
    expect(r.ecartReconciliationS).not.toBeNull();
    expect(r.ecartReconciliationS!).toBeLessThanOrEqual(TOLERANCE_RECONCILIATION_S);
    expect(r.reconcilie).toBe(true);
  });

  it('la réconciliation tient aussi quand le delta amont a écarté des pas', () => {
    // Une zone quasi à l'arrêt sur le tour courant : le delta amont écarte ces
    // pas et reporte la dernière valeur connue. La somme télescopique doit
    // toujours retomber sur le total.
    const courantTroue = trace(1000, (d) => (d >= 600 && d < 650 ? 0.5 : 50));
    const delta = computeDelta(courantTroue, REFERENCE);
    expect(delta.skipped).toBeGreaterThan(0);
    const r = calculeOpportunites(delta)!;
    expect(r.pasEcartes).toBe(delta.skipped);
    expect(r.reconcilie).toBe(true);
  });

  it('sans aucun pas exploitable, le total est absent et rien ne se réconcilie', () => {
    const arret = trace(1000, () => 0.5);
    const r = calculeOpportunites(computeDelta(arret, REFERENCE))!;
    expect(r.totalS).toBeNull();
    expect(r.ecartReconciliationS).toBeNull();
    expect(r.reconcilie).toBe(false);
  });
});

describe('les signes et l’ordre', () => {
  it('le temps rendu se lit là où il s’est rendu, en positif', () => {
    const delta = computeDelta(COURANT, REFERENCE);
    const r = calculeOpportunites(delta)!;

    // Le tour courant est plus lent entre 200 et 400 m : ces segments rendent
    // du temps (écart positif) ; les autres sont plats. Le pas qui ABOUTIT à
    // 200 m porte déjà la vitesse lente : le segment qui se termine à 200 m
    // fait partie de la zone.
    for (const s of r.segments) {
      if (s.finM < 200 || s.debutM >= 400) {
        expect(Math.abs(s.ecartLocalS)).toBeLessThan(1e-9);
      } else {
        expect(s.ecartLocalS).toBeGreaterThan(0);
      }
    }
  });

  it('les segments sont triés par écart local décroissant', () => {
    const r = calculeOpportunites(computeDelta(COURANT, REFERENCE))!;
    for (let i = 1; i < r.segments.length; i++) {
      expect(r.segments[i - 1].ecartLocalS).toBeGreaterThanOrEqual(r.segments[i].ecartLocalS);
    }
    // Les deux premiers sont bien ceux de la zone lente.
    expect([200, 300]).toContain(r.segments[0].debutM);
    expect([200, 300]).toContain(r.segments[1].debutM);
  });

  it('un segment où le tour courant est plus rapide rend un écart négatif', () => {
    const courantRapide = trace(1000, (d) => (d >= 500 && d < 600 ? 60 : 50));
    const r = calculeOpportunites(computeDelta(courantRapide, REFERENCE))!;
    const dernier = r.segments[r.segments.length - 1];
    expect(dernier.debutM).toBe(500);
    expect(dernier.ecartLocalS).toBeLessThan(0);
  });
});

describe('la découpe', () => {
  it('couvre tout le tour, sans trou ni recouvrement, du départ à la fin', () => {
    const r = calculeOpportunites(computeDelta(COURANT, REFERENCE))!;
    const parPiste = [...r.segments].sort((a, b) => a.debutM - b.debutM);
    expect(parPiste[0].debutM).toBe(0);
    expect(parPiste[parPiste.length - 1].finM).toBe(1000);
    for (let i = 1; i < parPiste.length; i++) {
      expect(parPiste[i].debutM).toBe(parPiste[i - 1].finM);
    }
    expect(parPiste).toHaveLength(1000 / LONGUEUR_SEGMENT_M_DEFAUT);
  });

  it('des bornes explicites remplacent la découpe régulière', () => {
    const r = calculeOpportunites(computeDelta(COURANT, REFERENCE), { bornesM: [250, 600] })!;
    const parPiste = [...r.segments].sort((a, b) => a.debutM - b.debutM);
    expect(parPiste.map((s) => [s.debutM, s.finM])).toEqual([
      [0, 250],
      [250, 600],
      [600, 1000],
    ]);
    expect(r.reconcilie).toBe(true);
  });

  it('des bornes hors du tour ou non finies sont ignorées', () => {
    const r = calculeOpportunites(computeDelta(COURANT, REFERENCE), {
      bornesM: [500, -10, 5000, NaN],
    })!;
    const parPiste = [...r.segments].sort((a, b) => a.debutM - b.debutM);
    expect(parPiste.map((s) => [s.debutM, s.finM])).toEqual([
      [0, 500],
      [500, 1000],
    ]);
  });

  it('moins de deux points de grille → null, jamais un résultat vide déguisé', () => {
    const vide: DeltaResult = {
      distance: [],
      cumulative: [],
      instant: [],
      total: null,
      step: 5,
      skipped: 0,
    };
    expect(calculeOpportunites(vide)).toBeNull();
  });
});

describe('confiance et estampille', () => {
  it('sans pas écarté, la lecture est de confiance haute', () => {
    const r = calculeOpportunites(computeDelta(COURANT, REFERENCE))!;
    expect(r.confiance).toBe('haute');
    expect(r.version).toBe(OPPORTUNITES_ALGO_VERSION);
  });

  it('une large part de pas écartés fait tomber la confiance', () => {
    // Plus de la moitié du tour quasi à l'arrêt côté courant.
    const courantDegrade = trace(1000, (d) => (d < 550 ? 0.5 : 50));
    const delta = computeDelta(courantDegrade, REFERENCE);
    const r = calculeOpportunites(delta)!;
    expect(r.confiance).toBe('faible');
  });
});

describe('DOCTRINE — verrou lexical de la source', () => {
  it('le module opportunitesLogic.ts n’attribue aucune cause et ne prescrit rien', () => {
    const source = readFileSync(join(__dirname, '..', 'opportunitesLogic.ts'), 'utf8').toLowerCase();
    const banned = [
      'freinez',
      'accélérez',
      'il faut',
      'vous devriez',
      'évitez',
      'limite',
      'sous-virage',
      'survirage',
      'erreur de pilotage',
      'faute',
      'cause probable',
    ];
    for (const mot of banned) {
      expect(source).not.toContain(mot);
    }
  });
});
