/**
 * POSER UN MARQUEUR — la décision.
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `l'horloge du coach n'entre jamais dans le calcul`. Le marqueur se date sur
 * `atMs`, posé par l'appareil DU PILOTE — le même qui a horodaté le début de la
 * capture. La soustraction est donc exacte par construction.
 *
 * Se dater sur la montre du coach serait faux : deux téléphones ne sont jamais
 * d'accord à la seconde près, et le résolveur ne tolère qu'une seconde d'écart
 * avec la trame la plus proche. Un décalage d'horloge rendrait la vitesse et le
 * freinage muets, sans qu'on sache pourquoi.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT AUSSI
 *
 * Le refus. Un marqueur posé sur du vide ne résoudra rien : mieux vaut un bouton
 * éteint qui DIT pourquoi, qu'une ligne écrite que personne ne saura relire.
 */

import {
  TRAME_FRAICHE_MAX_MS,
  decideMarqueur,
  motifLisible,
} from '@/features/coach/marqueurGesteLogic';

/** Début de capture, et une trame 42 s plus tard. */
const DEBUT = '2026-07-04T14:30:00.000Z';
const DEBUT_MS = Date.parse(DEBUT);
const TRAME = DEBUT_MS + 42000;

describe('decideMarqueur', () => {
  it('un décalage d’horloge entre les deux téléphones ne change RIEN', () => {
    // LE TEST QUI COMPTE, ET QUI NE PROUVAIT RIEN.
    //
    // Sa première version écrivait `maintenantMs: TRAME + 120000 - 120000 + 500`.
    // Les deux termes s'annulent : c'était `TRAME + 500`, décalage NUL. Le
    // commentaire annonçait « délibérément décalé de deux minutes » et
    // l'arithmétique le contredisait. Il serait passé à l'identique si tout
    // traitement du décalage avait disparu — la garde posée, non armée.
    //
    // Ici le coach est réellement 90 s EN AVANCE sur le pilote. La trame vient
    // d'être reçue (300 ms) : le geste doit rester posable, et l'instant doit
    // valoir 42 s — celui de la capture, pas celui du coach.
    const decalage = 90000;
    const d = decideMarqueur({
      derniereTrameAtMs: TRAME,
      receptionMs: TRAME + decalage,
      debutCaptureIso: DEBUT,
      maintenantMs: TRAME + decalage + 300,
    });
    expect(d).toEqual({ posable: true, elapsedMs: 42000 });
  });

  it('un coach EN RETARD ne laisse pas passer une trame morte', () => {
    // Cas miroir : sans la correction, `maintenantMs - atMs` devenait négatif et
    // la garde ne pouvait STRUCTURELLEMENT plus se déclencher — un marqueur se
    // posait sur une trame vieille de plusieurs minutes.
    const d = decideMarqueur({
      derniereTrameAtMs: TRAME,
      receptionMs: TRAME - 60000,
      debutCaptureIso: DEBUT,
      maintenantMs: TRAME - 60000 + 10000,
    });
    expect(d).toEqual({ posable: false, motif: 'trame-perimee' });
  });

  it('sans instant de réception, on ne sait pas juger l’âge — on refuse', () => {
    const d = decideMarqueur({
      derniereTrameAtMs: TRAME,
      receptionMs: null,
      debutCaptureIso: DEBUT,
      maintenantMs: TRAME + 100,
    });
    expect(d).toEqual({ posable: false, motif: 'pas-de-trame' });
  });

  it('désigne l’instant de la capture, pas celui du geste', () => {
    const d = decideMarqueur({
      derniereTrameAtMs: TRAME,
      receptionMs: TRAME,
      debutCaptureIso: DEBUT,
      maintenantMs: TRAME + 900,
    });
    expect(d.posable).toBe(true);
    if (d.posable) expect(d.elapsedMs).toBe(42000);
  });

  describe('on ne pose rien sur du vide', () => {
    it('aucune trame → refus nommé', () => {
      const d = decideMarqueur({
        derniereTrameAtMs: null,
        receptionMs: TRAME,
        debutCaptureIso: DEBUT,
        maintenantMs: TRAME,
      });
      expect(d).toEqual({ posable: false, motif: 'pas-de-trame' });
    });

    it('trame périmée → refus, pas un marqueur au mauvais endroit', () => {
      // Au-delà du seuil, on n'est plus en direct mais sur un reste
      // d'affichage : dater le geste là placerait le pilote où il ÉTAIT.
      const d = decideMarqueur({
        derniereTrameAtMs: TRAME,
        receptionMs: TRAME,
        debutCaptureIso: DEBUT,
        maintenantMs: TRAME + TRAME_FRAICHE_MAX_MS + 1,
      });
      expect(d).toEqual({ posable: false, motif: 'trame-perimee' });
    });

    it('une trame juste à la limite reste posable', () => {
      const d = decideMarqueur({
        derniereTrameAtMs: TRAME,
        receptionMs: TRAME,
        debutCaptureIso: DEBUT,
        maintenantMs: TRAME + TRAME_FRAICHE_MAX_MS,
      });
      expect(d.posable).toBe(true);
    });

    it('début de capture inconnu → refus', () => {
      expect(
        decideMarqueur({
          derniereTrameAtMs: TRAME,
          receptionMs: TRAME,
          debutCaptureIso: null,
          maintenantMs: TRAME,
        })
      ).toEqual({ posable: false, motif: 'debut-inconnu' });
    });

    it('une date de début illisible ne passe pas pour zéro', () => {
      expect(
        decideMarqueur({
          derniereTrameAtMs: TRAME,
          receptionMs: TRAME,
          debutCaptureIso: 'pas une date',
          maintenantMs: TRAME,
        })
      ).toEqual({ posable: false, motif: 'debut-inconnu' });
    });

    it('un instant ANTÉRIEUR au début refuse plutôt que d’écrire un négatif', () => {
      // Signe que les deux valeurs ne viennent pas de la même horloge. Un
      // marqueur négatif serait illisible pour toujours.
      const d = decideMarqueur({
        derniereTrameAtMs: DEBUT_MS - 5000,
        receptionMs: DEBUT_MS - 5000,
        debutCaptureIso: DEBUT,
        maintenantMs: DEBUT_MS - 5000,
      });
      expect(d).toEqual({ posable: false, motif: 'avant-le-debut' });
    });

    it('un contexte absent ne fait rien tomber', () => {
      expect(decideMarqueur(null as never)).toEqual({ posable: false, motif: 'pas-de-trame' });
    });
  });
});

describe('motifLisible', () => {
  it('dit ce qui manque, sans reprocher quoi que ce soit', () => {
    for (const m of ['pas-de-trame', 'trame-perimee', 'debut-inconnu', 'avant-le-debut'] as const) {
      const phrase = motifLisible(m);
      expect(phrase.length).toBeGreaterThan(10);
      // Ni impératif, ni reproche : l'application montre, elle ne dirige pas.
      expect(phrase).not.toMatch(/vous devez|il faut|réessayez|erreur/i);
    }
  });
});
