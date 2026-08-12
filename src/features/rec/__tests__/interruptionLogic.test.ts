/**
 * Le seuil d'interruption — relatif au pilote, et honnête sur ce qu'il ignore.
 *
 * Le plan : « seuil d'interruption sur le tour de référence du pilote, repli en
 * secondes ». Ces tests tiennent les deux moitiés, plus la retenue de la phrase
 * affichée — on affirme la durée, jamais ce qu'elle a coûté.
 */

import {
  FRACTION_SEUIL,
  SEUIL_REPLI_MS,
  bilanInterruptions,
  phraseInterruptions,
  seuilInterruptionMs,
  trouSignificatif,
  type TrouLiaison,
} from '../interruptionLogic';

const trou = (dureeMs: number): TrouLiaison => ({
  dureeMs,
  repriseIso: '2026-08-05T10:00:00Z',
});

const TOUR_1M41 = 101_203; // 1:41,203
const TOUR_3M00 = 180_000;

describe('le seuil suit le pilote, pas une constante', () => {
  /**
   * VINGT SECONDES NE VEULENT PAS DIRE LA MÊME CHOSE PARTOUT. Sur un tour de
   * 1:41 c'est un cinquième de tour ; sur un tour de 3:00, un neuvième. Un
   * seuil unique dirait « interruption » à l'un et se tairait pour l'autre.
   */
  it('un tour plus long donne un seuil plus haut', () => {
    expect(seuilInterruptionMs(TOUR_3M00)).toBeGreaterThan(seuilInterruptionMs(TOUR_1M41));
  });

  it('le seuil vaut la fraction annoncée', () => {
    expect(seuilInterruptionMs(TOUR_1M41)).toBe(Math.round(TOUR_1M41 * FRACTION_SEUIL));
  });

  it('le même trou est significatif ici et pas là', () => {
    const t = trou(15_000);
    expect(trouSignificatif(t, TOUR_1M41)).toBe(true); // seuil ≈ 10,1 s
    expect(trouSignificatif(t, TOUR_3M00)).toBe(false); // seuil = 18 s
  });
});

describe('le repli — un tour non mesuré ne produit pas un seuil inventé', () => {
  it('sans tour de référence, le repli s’applique', () => {
    for (const v of [null, undefined]) {
      expect(seuilInterruptionMs(v)).toBe(SEUIL_REPLI_MS);
    }
  });

  it('une valeur absurde retombe sur le repli, elle ne la propage pas', () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(seuilInterruptionMs(v)).toBe(SEUIL_REPLI_MS);
    }
  });
});

describe('le bilan — ce qui est sous le seuil ne compte pas', () => {
  /**
   * Les inclure dans le cumul ferait apparaître une somme que rien ne
   * justifie : l'application dirait « quatre minutes d'interruption » là où il
   * n'y a eu que des reconnexions ordinaires.
   */
  it('les petits trous ne gonflent pas le total', () => {
    const b = bilanInterruptions([trou(2_000), trou(3_000), trou(30_000)], TOUR_1M41);
    expect(b.nombre).toBe(1);
    expect(b.cumulMs).toBe(30_000);
  });

  it('aucun trou retenu, aucune part calculée', () => {
    const b = bilanInterruptions([trou(1_000)], TOUR_1M41);
    expect(b.nombre).toBe(0);
    expect(b.partDuTour).toBeNull();
  });

  it('sans tour de référence, la part reste nulle même avec des trous', () => {
    // On peut mesurer la durée sans pouvoir la rapporter à quoi que ce soit.
    const b = bilanInterruptions([trou(30_000)], null);
    expect(b.nombre).toBe(1);
    expect(b.cumulMs).toBe(30_000);
    expect(b.partDuTour).toBeNull();
  });

  it('une durée nulle ou négative n’est pas un trou', () => {
    expect(bilanInterruptions([trou(0), trou(-5_000)], TOUR_1M41).nombre).toBe(0);
  });
});

describe('la phrase — on affirme la durée, jamais ce qu’elle a coûté', () => {
  it('rien à dire quand rien n’a dépassé le seuil', () => {
    expect(phraseInterruptions(bilanInterruptions([trou(1_000)], TOUR_1M41))).toBeNull();
  });

  it('une interruption se dit au singulier', () => {
    const p = phraseInterruptions(bilanInterruptions([trou(30_000)], TOUR_1M41));
    expect(p).toContain('une fois');
    expect(p).toContain('30 s');
  });

  it('plusieurs se comptent, et le cumul se dit en minutes au-delà de 60 s', () => {
    const p = phraseInterruptions(bilanInterruptions([trou(45_000), trou(40_000)], TOUR_1M41));
    expect(p).toContain('2 fois');
    expect(p).toContain('1 min 25 s');
  });

  /**
   * LE MOT « ENVIRON » N'EST PAS UNE PRÉCAUTION DE STYLE. Un trou de quarante
   * secondes n'a pas forcément coûté un demi-tour : le pilote était peut-être
   * aux stands. On situe, on n'affirme pas.
   */
  it('la part du tour est donnée au conditionnel, jamais comme un compte de tours', () => {
    const p = phraseInterruptions(bilanInterruptions([trou(50_000)], TOUR_1M41));
    expect(p).toContain('environ');
    expect(p).not.toMatch(/tours? perdus?/i);
  });

  it('sous un dixième de tour, on ne chiffre pas la part', () => {
    // Chiffrer « 0,0 fois votre tour » ne dirait rien et ferait douter du reste.
    const p = phraseInterruptions({ nombre: 1, cumulMs: 4_000, partDuTour: 0.04 });
    expect(p).not.toContain('environ');
  });

  it('la part emploie la virgule décimale', () => {
    const p = phraseInterruptions({ nombre: 1, cumulMs: 50_000, partDuTour: 0.5 });
    expect(p).toContain('0,5');
    expect(p).not.toContain('0.5');
  });
});

describe('ton OXV', () => {
  const phrases = [
    phraseInterruptions(bilanInterruptions([trou(30_000)], TOUR_1M41)) ?? '',
    phraseInterruptions(bilanInterruptions([trou(45_000), trou(40_000)], TOUR_1M41)) ?? '',
  ];

  it('aucun reproche, aucun impératif', () => {
    // Une liaison qui tombe n'est pas une faute du pilote. Le lui dire sur ce
    // ton serait doublement faux.
    for (const p of phrases) {
      expect(p).not.toMatch(
        /vous auriez|il aurait fallu|dommage|malheureusement|vérifiez|pensez à/i
      );
    }
  });

  it('aucun mot proscrit, aucun emoji, aucun tutoiement', () => {
    for (const p of phrases) {
      expect(p).not.toMatch(/\blimite/i);
      expect(p).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(p).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });
});
