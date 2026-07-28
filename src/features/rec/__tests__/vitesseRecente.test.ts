/**
 * La moyenne glissante qui arme le silence en piste.
 *
 * ---
 *
 * CE QU'ELLE COMMANDE
 *
 * `determineState` bascule en `S6_roulage` au-dessus de 60 km/h de moyenne
 * récente, et cette bascule arme le silence — Principe 3.
 *
 * `setActiveRecording` n'avait aucun appelant : le champ restait nul, l'état
 * restait `S1_decouverte`, `setSilenceMode` ne recevait jamais autre chose que
 * `false`. Le garde-fou existait sans jamais se déclencher.
 */

import { ajouter, FENETRE_MS, moyenne } from '../vitesseRecente';

describe('la fenêtre glisse', () => {
  it('garde ce qui est dedans, écarte ce qui en sort', () => {
    let f = ajouter([], { ts: 0, kmh: 100 });
    f = ajouter(f, { ts: 1_000, kmh: 100 });
    expect(f).toHaveLength(2);

    // Le relevé de t=0 sort exactement à t = FENETRE_MS + 1.
    f = ajouter(f, { ts: FENETRE_MS + 1, kmh: 100 });
    expect(f.map((r) => r.ts)).toEqual([1_000, FENETRE_MS + 1]);
  });

  it('la borne est inclusive — un relevé pile sur la fenêtre reste', () => {
    let f = ajouter([], { ts: 0, kmh: 80 });
    f = ajouter(f, { ts: FENETRE_MS, kmh: 80 });
    expect(f).toHaveLength(2);
  });

  it('ne mute pas le tableau reçu', () => {
    const origine = ajouter([], { ts: 0, kmh: 50 });
    const suite = ajouter(origine, { ts: 100, kmh: 50 });
    expect(origine).toHaveLength(1);
    expect(suite).toHaveLength(2);
  });
});

describe('les relevés non mesurés sont écartés', () => {
  /**
   * Une trame GPS sans fix peut porter un NaN. Un seul NaN dans la somme
   * contamine la moyenne entière — et une moyenne contaminée ne franchit
   * jamais le seuil, donc le silence ne s'armerait jamais.
   */
  it('un NaN n’entre pas dans la fenêtre', () => {
    const f = ajouter([], { ts: 0, kmh: NaN });
    expect(f).toHaveLength(0);
    expect(moyenne(f)).toBeNull();
  });

  it('un NaN n’écrase pas une fenêtre saine', () => {
    let f = ajouter([], { ts: 0, kmh: 100 });
    f = ajouter(f, { ts: 100, kmh: NaN });
    expect(moyenne(f)).toBe(100);
  });

  it('un horodatage non fini est écarté aussi', () => {
    expect(ajouter([], { ts: Infinity, kmh: 100 })).toHaveLength(0);
  });
});

describe('la moyenne', () => {
  it('rend null sur une fenêtre vide — pas zéro', () => {
    expect(moyenne([])).toBeNull();
  });

  it('calcule la moyenne arithmétique', () => {
    expect(
      moyenne([
        { ts: 0, kmh: 40 },
        { ts: 1, kmh: 80 },
      ])
    ).toBe(60);
  });
});

describe('le comportement au seuil de 60 km/h', () => {
  const SEUIL = 60;

  /**
   * LE CAS QUI JUSTIFIE LE LISSAGE.
   *
   * Une trame isolée au-dessus du seuil, dans un flux à l'arrêt, ne doit pas
   * faire basculer l'état. Le RaceBox émet à 25 Hz : sans lissage, un rebond
   * GPS armerait et désarmerait le silence plusieurs fois par seconde.
   */
  it('un rebond isolé ne franchit pas le seuil', () => {
    let f: ReturnType<typeof ajouter> = [];
    for (let i = 0; i < 20; i++) f = ajouter(f, { ts: i * 40, kmh: 0 }, i * 40);
    f = ajouter(f, { ts: 800, kmh: 90 }, 800);
    expect(moyenne(f)!).toBeLessThan(SEUIL);
  });

  it('une entrée en piste soutenue franchit le seuil', () => {
    let f: ReturnType<typeof ajouter> = [];
    // 5 secondes à 100 km/h, à 25 Hz.
    for (let i = 0; i < 125; i++) f = ajouter(f, { ts: i * 40, kmh: 100 }, i * 40);
    expect(moyenne(f)!).toBeGreaterThan(SEUIL);
  });

  /**
   * Et le retour au stand redescend. Sans cela, le silence resterait armé
   * après la séance — et un pilote qui ne reçoit plus rien au paddock croit
   * l'application en panne.
   */
  it('le retour au stand repasse sous le seuil', () => {
    let f: ReturnType<typeof ajouter> = [];
    for (let i = 0; i < 125; i++) f = ajouter(f, { ts: i * 40, kmh: 100 }, i * 40);
    const apres = 5_000;
    for (let i = 0; i < 125; i++) {
      const t = apres + i * 40;
      f = ajouter(f, { ts: t, kmh: 0 }, t);
    }
    expect(moyenne(f)!).toBeLessThan(SEUIL);
  });
});
