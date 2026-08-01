/**
 * LE MARQUEUR RÉSOLU — un instant devient des faits.
 *
 * ---
 *
 * LES TROIS TESTS QUI COMPTENT
 *
 * `l'accélération n'est pas prise pour un freinage`. La convention est
 * verrouillée par `captureFrameMapping` : `gForceX > 0` vaut FREINAGE. En
 * inverser le signe transformerait chaque relance en coup de frein, et le
 * marqueur raconterait le contraire de ce qui s'est passé.
 *
 * `une trame trop lointaine ne résout rien`. Une vitesse lue une seconde trop
 * tard, dans un freinage, peut être fausse de trente kilomètres-heure. On
 * préfère un marqueur qui se tait à un marqueur qui ment.
 *
 * `le virage n'est pas ré-incrémenté` — même piège que partout ailleurs : la
 * base est en 1 (D-21).
 *
 * ---
 *
 * CE QUE CES TESTS NE PROUVENT PAS
 *
 * Que les cordes de référence existent. `app_segment_analyses` est VIDE en
 * production au 01/08/2026, et `coach_corner_reference` aussi. Le résolveur
 * rendra donc `virage: null` sur toutes les séances actuelles — ce qui est
 * l'affichage juste, pas une panne.
 */

import {
  type BorneTour,
  type CordeVirage,
  type TrameMarqueur,
  DISTANCE_CORDE_MAX_M,
  ECART_TRAME_MAX_MS,
  phraseMarqueur,
  resoudreMarqueur,
} from '@/telemetry/marqueur';

/** Une corde quelque part au Circuit de Haute Saintonge. */
const CORDE = { numero: 5, lat: 45.2711, lon: -0.3222 };
/** ~40 m au nord de la corde — dans la zone d'approche. */
const AVANT_CORDE = { lat: 45.27146, lon: -0.3222 };

const trame = (p: Partial<TrameMarqueur>): TrameMarqueur => ({
  elapsedMs: 0,
  lat: AVANT_CORDE.lat,
  lon: AVANT_CORDE.lon,
  speedKmh: 118,
  gForceX: null,
  ...p,
});

const BORNES: BorneTour[] = [
  { numero: 3, debutMs: 0, finMs: 90000 },
  { numero: 4, debutMs: 90001, finMs: 180000 },
];
const CORDES: CordeVirage[] = [CORDE];

describe('resoudreMarqueur', () => {
  it('résout un instant en tour, virage, vitesse, freinage et distance', () => {
    const m = resoudreMarqueur(
      100000,
      [
        trame({ elapsedMs: 98500, gForceX: 0.9 }),
        trame({ elapsedMs: 99500, gForceX: 1.2 }),
        trame({ elapsedMs: 100020, speedKmh: 118, gForceX: 0.4 }),
      ],
      BORNES,
      CORDES
    );

    expect(m.tour).toBe(4);
    expect(m.virage).toBe(5);
    expect(m.vitesseEntreeKmh).toBe(118);
    expect(m.decelerationG).toBeCloseTo(1.2, 5);
    expect(m.distanceCordeM).toBeGreaterThan(30);
    expect(m.distanceCordeM).toBeLessThan(60);
    expect(m.ecartTrameMs).toBe(20);
  });

  describe('la convention des axes G', () => {
    it('l’accélération n’est pas prise pour un freinage', () => {
      // gForceX < 0 = accélération. Le marqueur ne doit y voir aucun freinage.
      const m = resoudreMarqueur(1000, [trame({ elapsedMs: 1000, gForceX: -1.1 })], BORNES, CORDES);
      expect(m.decelerationG).toBe(null);
    });

    it('retient le freinage le plus fort de la fenêtre', () => {
      const m = resoudreMarqueur(
        3000,
        [
          trame({ elapsedMs: 1500, gForceX: 0.5 }),
          trame({ elapsedMs: 2500, gForceX: 1.4 }),
          trame({ elapsedMs: 3000, gForceX: 0.2 }),
        ],
        BORNES,
        CORDES
      );
      expect(m.decelerationG).toBeCloseTo(1.4, 5);
    });

    it('ne regarde jamais APRÈS le marqueur', () => {
      // Un marqueur décrit ce qui vient de se passer, pas ce qui va suivre.
      const m = resoudreMarqueur(
        2000,
        [trame({ elapsedMs: 2000, gForceX: 0.3 }), trame({ elapsedMs: 2500, gForceX: 1.9 })],
        BORNES,
        CORDES
      );
      expect(m.decelerationG).toBeCloseTo(0.3, 5);
    });

    it('ignore un freinage antérieur à la fenêtre — c’est celui du virage d’avant', () => {
      const m = resoudreMarqueur(
        10000,
        [trame({ elapsedMs: 5000, gForceX: 1.8 }), trame({ elapsedMs: 10000, gForceX: 0.6 })],
        BORNES,
        CORDES
      );
      expect(m.decelerationG).toBeCloseTo(0.6, 5);
    });
  });

  describe('ce qui n’est pas mesurable reste nul', () => {
    it('une trame trop lointaine ne résout rien — sauf le tour', () => {
      const m = resoudreMarqueur(
        50000,
        [trame({ elapsedMs: 50000 + ECART_TRAME_MAX_MS + 1 })],
        BORNES,
        CORDES
      );
      expect(m.vitesseEntreeKmh).toBe(null);
      expect(m.virage).toBe(null);
      expect(m.ecartTrameMs).toBe(null);
      // Le tour vient des BORNES, pas des trames : il reste connaissable.
      expect(m.tour).toBe(3);
    });

    it('une corde trop lointaine ne nomme aucun virage', () => {
      // Un marqueur posé en pleine ligne droite n'appartient à aucun virage.
      const loin: CordeVirage[] = [{ numero: 2, lat: 45.35, lon: -0.32 }];
      const m = resoudreMarqueur(1000, [trame({ elapsedMs: 1000 })], BORNES, loin);
      expect(m.virage).toBe(null);
      expect(m.distanceCordeM).toBe(null);
      // La vitesse, elle, reste mesurée : l'un n'empêche pas l'autre.
      expect(m.vitesseEntreeKmh).toBe(118);
    });

    it('sans position, aucun virage — mais la vitesse tient', () => {
      const m = resoudreMarqueur(
        1000,
        [trame({ elapsedMs: 1000, lat: null, lon: null })],
        BORNES,
        CORDES
      );
      expect(m.virage).toBe(null);
      expect(m.vitesseEntreeKmh).toBe(118);
    });

    it('un instant hors de tout tour ne fabrique pas de numéro', () => {
      const m = resoudreMarqueur(999999, [trame({ elapsedMs: 999999 })], BORNES, CORDES);
      expect(m.tour).toBe(null);
    });

    it('aucune trame → le TOUR tient quand même, le reste est nul', () => {
      // Ce test encodait le défaut : il exigeait que le tour soit perdu. Or le
      // tour se déduit des BORNES, pas des trames — c'est écrit dans le module,
      // et une garde plus haut sautait par-dessus le calcul. Relevé par la revue
      // adversariale du 01/08/2026.
      const m = resoudreMarqueur(1000, [], BORNES, CORDES);
      expect(m.instantMs).toBe(1000);
      expect(m.tour).toBe(3);
      expect(m.ecartTrameMs).toBe(null);
      expect(m.vitesseEntreeKmh).toBe(null);
      expect(m.virage).toBe(null);
    });

    it('des entrées absentes ne font pas tomber la résolution', () => {
      const m = resoudreMarqueur(
        1000,
        [null as unknown as TrameMarqueur, trame({ elapsedMs: 1000 })],
        null as unknown as BorneTour[],
        null as unknown as CordeVirage[]
      );
      expect(m.vitesseEntreeKmh).toBe(118);
      expect(m.tour).toBe(null);
      expect(m.virage).toBe(null);
    });
  });

  it('le seuil de corde est celui qui est documenté', () => {
    // Garde contre un durcissement silencieux : la constante est publique et
    // citée dans le commentaire, elle ne doit pas dériver sans qu'on le voie.
    expect(DISTANCE_CORDE_MAX_M).toBe(300);
  });
});

describe('phraseMarqueur', () => {
  it('n’énonce que ce qui est mesuré', () => {
    const m = resoudreMarqueur(
      100000,
      [trame({ elapsedMs: 100000, speedKmh: 118, gForceX: 1.2 })],
      BORNES,
      CORDES
    );
    const p = phraseMarqueur(m);
    expect(p).toContain('Tour 4');
    // Le virage est rendu tel quel — base 1, jamais ré-incrémenté (D-21).
    expect(p).toContain('virage 5');
    expect(p).toContain('118 km/h');
    expect(p).toContain('1.2 g');
  });

  it('rend null plutôt qu’une phrase à trous', () => {
    const vide = resoudreMarqueur(1000, [], [], []);
    expect(phraseMarqueur(vide)).toBe(null);
  });
});
