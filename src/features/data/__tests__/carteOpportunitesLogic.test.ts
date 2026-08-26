/**
 * Carte des opportunités sur le tracé — M07, lot 7b.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 *   - LES TROIS REFUS : lecture fragile, zone fragile, écart sous la bande
 *     morte — chacun rend une portion NUE, et chacun est compté ;
 *   - LA COULEUR : elle vient du rôle POLARITÉ de la grammaire, et ni le rouge
 *     de marque, ni les deux ors, ni les cinq couleurs QDI n'y entrent ;
 *   - LA CONVERSION : fraction de tour → mètres de polyligne, jamais une
 *     abscisse hors du tracé même quand la grille du delta est plus longue ;
 *   - L'ORDRE : la carte se lit dans le sens de la piste ;
 *   - la doctrine : aucune cause attribuée — le verrou lexical relit la source.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { colors } from '@/ui/v2/tokens';
import { palette } from '@/theme/v2';
import { POLES_DELTA } from '@/ui/v2/grammaireViz';
import type { SegmentEcart } from '../opportunitesLogic';
import {
  ETENDUE_MIN_PEINTE_M,
  SEUIL_ECART_PEINT_S,
  VERSION_CARTE_OPPORTUNITES,
  carteOpportunites,
} from '../carteOpportunitesLogic';

/** Un segment d'écart local, tel que `calculeOpportunites` le rend. */
function seg(debutM: number, finM: number, ecartLocalS: number): SegmentEcart {
  return {
    debutM,
    finM,
    deltaEntreeS: 0,
    deltaSortieS: ecartLocalS,
    ecartLocalS,
  };
}

/** Tour de 1 000 m sur la grille du delta, tracé de 1 000 m : 1 m = 1 m. */
const BASE = {
  longueurTourM: 1000,
  longueurTraceM: 1000,
  confiance: 'haute' as const,
  zonesFaiblesM: [] as { debutM: number; finM: number }[],
};

describe('ce qui se peint, et ce qui reste nu', () => {
  it('un écart franc se peint, au pôle qui correspond à son signe', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(0, 100, 0.3), seg(100, 200, -0.3)],
    })!;

    expect(r.portions).toHaveLength(2);
    expect(r.portions[0].couleur).toBe(POLES_DELTA.perd);
    expect(r.portions[1].couleur).toBe(POLES_DELTA.reprend);
    expect(r.version).toBe(VERSION_CARTE_OPPORTUNITES);
  });

  it('un écart dans la bande morte reste NU, et il est compté', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(0, 100, SEUIL_ECART_PEINT_S / 2), seg(100, 200, 0.3)],
    })!;

    expect(r.portions).toHaveLength(1);
    expect(r.portions[0].debutM).toBe(100);
    expect(r.sousSeuil).toBe(1);
  });

  it('le seuil est une borne INCLUSE : pile dessus, le trait reste nu', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(0, 100, SEUIL_ECART_PEINT_S)],
    })!;

    expect(r.portions).toHaveLength(0);
    expect(r.sousSeuil).toBe(1);
  });

  it('un segment qui recoupe une zone en confiance faible n’est PAS peint', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(0, 100, 0.3), seg(400, 500, 0.4)],
      zonesFaiblesM: [{ debutM: 50, finM: 120 }],
    })!;

    expect(r.portions).toHaveLength(1);
    expect(r.portions[0].debutM).toBe(400);
    expect(r.ecartesConfianceZone).toBe(1);
  });

  it('une zone faible qui touche une borne sans la recouvrir ne retire rien', () => {
    // Contact en un point : ce n'est pas un chevauchement.
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(100, 200, 0.3)],
      zonesFaiblesM: [{ debutM: 0, finM: 100 }],
    })!;

    expect(r.portions).toHaveLength(1);
    expect(r.ecartesConfianceZone).toBe(0);
  });

  it('une lecture en confiance FAIBLE ne peint rien du tout — `null`, pas un vide', () => {
    expect(
      carteOpportunites({
        ...BASE,
        confiance: 'faible',
        segments: [seg(0, 100, 0.3)],
      })
    ).toBeNull();
  });

  it('une confiance MOYENNE peint : c’est « faible » qui interdit, pas « pas haute »', () => {
    const r = carteOpportunites({
      ...BASE,
      confiance: 'moyenne',
      segments: [seg(0, 100, 0.3)],
    })!;
    expect(r.portions).toHaveLength(1);
  });

  it('une longueur de tour ou de tracé inexploitable rend `null`', () => {
    expect(
      carteOpportunites({ ...BASE, longueurTourM: 0, segments: [seg(0, 100, 0.3)] })
    ).toBeNull();
    expect(
      carteOpportunites({ ...BASE, longueurTraceM: 0, segments: [seg(0, 100, 0.3)] })
    ).toBeNull();
    expect(
      carteOpportunites({ ...BASE, longueurTourM: Number.NaN, segments: [seg(0, 100, 0.3)] })
    ).toBeNull();
  });

  it('des bornes non finies ne fabriquent pas de portion — elles sont comptées', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(Number.NaN, 100, 0.3), seg(200, 300, 0.3)],
    })!;

    expect(r.portions).toHaveLength(1);
    expect(r.ecartesGeometrie).toBe(1);
  });

  it('un segment sans étendue n’est pas une portion', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(500, 500 + ETENDUE_MIN_PEINTE_M / 2, 0.3)],
    })!;

    expect(r.portions).toHaveLength(0);
    expect(r.ecartesGeometrie).toBe(1);
  });
});

describe('la conversion vers le tracé — fraction de tour, jamais une abscisse hors bornes', () => {
  it('une grille du delta plus COURTE que le tracé s’étire sur toute sa longueur', () => {
    const r = carteOpportunites({
      ...BASE,
      longueurTourM: 500,
      longueurTraceM: 4000,
      segments: [seg(0, 250, 0.3), seg(250, 500, 0.3)],
    })!;

    expect(r.portions.map((p) => [p.debutM, p.finM])).toEqual([
      [0, 2000],
      [2000, 4000],
    ]);
  });

  it('une grille du delta plus LONGUE que le tracé ne sort jamais du tracé', () => {
    const r = carteOpportunites({
      ...BASE,
      longueurTourM: 4100,
      longueurTraceM: 4000,
      segments: [seg(4000, 4100, 0.3)],
    })!;

    expect(r.portions).toHaveLength(1);
    expect(r.portions[0].finM).toBeLessThanOrEqual(4000);
    expect(r.portions[0].debutM).toBeGreaterThanOrEqual(0);
  });

  it('la carte se lit dans l’ordre de la PISTE, pas dans celui du potentiel', () => {
    // Le module amont trie par écart décroissant : on lui donne cet ordre-là.
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(700, 800, 0.5), seg(100, 200, 0.4), seg(400, 500, 0.3)],
    })!;

    expect(r.portions.map((p) => p.debutM)).toEqual([100, 400, 700]);
  });

  it('l’écart local est repris tel quel — le module ne le retouche pas', () => {
    const r = carteOpportunites({ ...BASE, segments: [seg(0, 100, 0.37)] })!;
    expect(r.portions[0].ecartLocalS).toBe(0.37);
  });
});

describe('DOCTRINE — la couleur ne peut pas être une couleur réservée', () => {
  const couleursPeintes = [POLES_DELTA.perd, POLES_DELTA.reprend];

  it('aucune portion ne porte le ROUGE DE MARQUE', () => {
    expect(couleursPeintes).not.toContain(colors.accent);
    expect(couleursPeintes).not.toContain(palette.red);
  });

  it('aucune portion ne porte l’OR — ni celui du chrono, ni celui de Heritage', () => {
    expect(couleursPeintes).not.toContain(palette.gold);
    expect(couleursPeintes).not.toContain(colors.heritage.gold);
  });

  it('aucune portion ne porte une des CINQ COULEURS QDI', () => {
    for (const qdi of Object.values(colors.qdi)) {
      expect(couleursPeintes).not.toContain(qdi);
    }
  });

  it('les couleurs peintes sortent bien du rôle POLARITÉ, et de nulle part ailleurs', () => {
    const r = carteOpportunites({
      ...BASE,
      segments: [seg(0, 100, 0.3), seg(100, 200, -0.3)],
    })!;
    for (const p of r.portions) {
      expect(couleursPeintes).toContain(p.couleur);
    }
  });
});

describe('DOCTRINE — verrou lexical de la source', () => {
  it('le module carteOpportunitesLogic.ts n’attribue aucune cause et ne prescrit rien', () => {
    const source = readFileSync(
      join(__dirname, '..', 'carteOpportunitesLogic.ts'),
      'utf8'
    ).toLowerCase();
    const bannis = [
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
    for (const mot of bannis) {
      expect(source).not.toContain(mot);
    }
  });
});
