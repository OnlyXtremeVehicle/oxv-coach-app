/**
 * La propriété qui fait qu'un canal gradué dit la vérité : l'axe tombe sur des
 * valeurs RONDES, et la courbe partage le dénominateur de ces valeurs.
 *
 * Le reste (séries plates, domaines vides ou inversés) sont les cas de bord par
 * lesquels un axe se met à mentir sans prévenir — en affichant un repère là où
 * il n'y a pas de mesure, ou une variation là où la donnée est constante.
 */

import { domaineGradue, domaineSymetrique, graduations } from '../courbeCanalLogic';

describe('domaineSymetrique — rien n’est écrêté, le zéro reste au centre', () => {
  /**
   * LE TEST QUI DÉFINIT LE MODULE. Une pleine échelle figée à ±1,5 traçait un
   * freinage à 1,8 g comme un freinage à 1,5 g. L'axe doit CONTENIR la mesure.
   */
  it('contient la valeur la plus extrême, si loin soit-elle', () => {
    for (const vs of [[1.8, -0.4], [-2.7, 0.1], [0.2], [-4]]) {
      const d = domaineSymetrique(vs)!;
      const ample = Math.max(...vs.map(Math.abs));
      expect(d.max).toBeGreaterThanOrEqual(ample);
      expect(d.min).toBeLessThanOrEqual(-ample);
    }
  });

  /** Gradué, l'axe contient encore la mesure — c'est là que l'écrêtage revenait. */
  it('reste contenant une fois gradué', () => {
    const vs = [1.8, -0.4, 0.9];
    const g = domaineGradue(domaineSymetrique(vs)!, 4);
    expect(g.max).toBeGreaterThanOrEqual(1.8);
    expect(g.min).toBeLessThanOrEqual(-1.8);
  });

  /**
   * Le zéro doit rester au MILIEU du canal : c'est lui qui fait lire le signe
   * (bas = freinage, haut = accélération) sans avoir à déchiffrer l'axe.
   */
  it('reste symétrique même quand la donnée ne l’est pas', () => {
    const d = domaineSymetrique([1.8, -0.2])!;
    expect(d.min).toBe(-d.max);
    expect(graduations(d, 4)).toContain(0);
  });

  it('ignore les valeurs non finies', () => {
    const d = domaineSymetrique([0.5, Number.NaN, Number.POSITIVE_INFINITY, -0.9])!;
    expect(d).toEqual({ min: -0.9, max: 0.9 });
  });

  it('une série toute à zéro rend un domaine plat, pas une variation', () => {
    expect(domaineSymetrique([0, 0])).toEqual({ min: 0, max: 0 });
    expect(graduations(domaineSymetrique([0, 0])!)).toEqual([0]);
  });

  it('rend null quand rien n’est mesurable', () => {
    expect(domaineSymetrique([])).toBeNull();
    expect(domaineSymetrique([Number.NaN])).toBeNull();
  });
});

describe('graduations — l’axe tombe rond', () => {
  it('gradue une vitesse de 0 à 187 par pas de 50', () => {
    expect(graduations({ min: 0, max: 187 })).toEqual([0, 50, 100, 150, 200]);
  });

  /**
   * L'axe DÉBORDE la donnée, et c'est voulu : s'arrêter pile sur 187 laisserait
   * croire que c'est une limite du système plutôt qu'une mesure du jour.
   */
  it('déborde le maximum observé pour tomber sur un repère rond', () => {
    const g = graduations({ min: 0, max: 187 });
    expect(g[g.length - 1]).toBeGreaterThanOrEqual(187);
  });

  it('encadre aussi par le bas', () => {
    const g = graduations({ min: 37, max: 92 });
    expect(g[0]).toBeLessThanOrEqual(37);
    expect(g[g.length - 1]).toBeGreaterThanOrEqual(92);
  });

  it('les pas appartiennent à la famille 1-2-5', () => {
    for (const d of [
      { min: 0, max: 3 },
      { min: 0, max: 9 },
      { min: 0, max: 187 },
      { min: -2.5, max: 2.5 },
      { min: 0, max: 4200 },
    ]) {
      const g = graduations(d);
      if (g.length < 2) continue;
      const pas = g[1] - g[0];
      const mantisse = pas / Math.pow(10, Math.floor(Math.log10(pas)));
      expect([1, 2, 5]).toContain(Math.round(mantisse));
    }
  });

  it('le pas est constant sur tout l’axe', () => {
    const g = graduations({ min: 0, max: 187 });
    const pas = g[1] - g[0];
    for (let i = 1; i < g.length; i++) {
      expect(g[i] - g[i - 1]).toBeCloseTo(pas, 9);
    }
  });

  /** `0.1 * 3` vaut 0.30000000000000004 — une graduation ne porte pas cette queue. */
  it('aucune graduation ne traîne de résidu binaire', () => {
    for (const v of graduations({ min: 0, max: 1 })) {
      expect(String(v)).not.toMatch(/\d{10,}/);
    }
  });

  it('gère les valeurs négatives', () => {
    const g = graduations({ min: -30, max: 30 });
    expect(g[0]).toBeLessThanOrEqual(-30);
    expect(g[g.length - 1]).toBeGreaterThanOrEqual(30);
    expect(g).toContain(0);
  });

  /** Fabriquer un intervalle autour d'une valeur plate dessinerait une variation. */
  it('un domaine plat rend un seul repère, sur la valeur', () => {
    expect(graduations({ min: 7, max: 7 })).toEqual([7]);
  });

  it('un domaine inversé ou non fini ne rend rien', () => {
    expect(graduations({ min: 10, max: 0 })).toEqual([]);
    expect(graduations({ min: Number.NaN, max: 10 })).toEqual([]);
    expect(graduations({ min: 0, max: Number.POSITIVE_INFINITY })).toEqual([]);
  });

  it('la cible est visée, pas garantie — mais l’axe reste lisible', () => {
    const g = graduations({ min: 0, max: 187 }, 4);
    expect(g.length).toBeGreaterThanOrEqual(3);
    expect(g.length).toBeLessThanOrEqual(9);
  });
});

describe('domaineGradue — la courbe et les repères partagent un dénominateur', () => {
  it('rend les extrémités des graduations, pas celles de la donnée', () => {
    expect(domaineGradue({ min: 0, max: 187 })).toEqual({ min: 0, max: 200 });
  });

  /**
   * LE TEST QUI ÉVITE LE DÉCALAGE. Si le domaine gradué ne contenait pas la
   * donnée, une pointe sortirait du cadre ; s'il ne coïncidait pas avec les
   * repères, « 150 » se retrouverait en face de 140.
   */
  it('contient toujours le domaine observé', () => {
    for (const d of [
      { min: 12, max: 88 },
      { min: -5, max: 5 },
      { min: 0.2, max: 0.9 },
      { min: 0, max: 187 },
    ]) {
      const g = domaineGradue(d);
      expect(g.min).toBeLessThanOrEqual(d.min);
      expect(g.max).toBeGreaterThanOrEqual(d.max);
    }
  });

  it('ses bornes SONT des graduations', () => {
    const d = { min: 0, max: 187 };
    const g = graduations(d);
    const borne = domaineGradue(d);
    expect(g).toContain(borne.min);
    expect(g).toContain(borne.max);
  });

  it('un domaine plat se reporte tel quel', () => {
    expect(domaineGradue({ min: 7, max: 7 })).toEqual({ min: 7, max: 7 });
  });
});
