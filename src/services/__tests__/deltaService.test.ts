/**
 * Le premier appelant de la banque de calculs, et ses refus.
 * Jalon 4, phase 4septies.
 *
 * ---
 *
 * CE QUI EST VÉRIFIÉ ICI
 *
 * `computeDelta` est juste — `delta.test.ts` le prouve, et `adaptation.test.ts`
 * prouve que la chaîne tient depuis la forme réellement stockée. Ce qui reste à
 * vérifier, c'est ce que le service fait quand il n'y a RIEN — et c'est le cas
 * courant : aucune séance de production ne porte à la fois des trames et un
 * tour, donc `loadLapFrames` rend un tableau vide sur toutes.
 *
 * Un service qui rendrait zéro plutôt que null dirait « les deux tours sont
 * identiques ». C'est un fait, et ce n'est pas celui qu'on connaît.
 */

import { loadDeltaEntreTours, TEXTE_ABSENCE } from '../deltaService';
import { loadLapFrames, PLAFOND_TRAMES_TOUR } from '../sessionTelemetryService';

jest.mock('../sessionTelemetryService', () => ({
  loadLapFrames: jest.fn(),
  PLAFOND_TRAMES_TOUR: 2000,
}));

const charge = loadLapFrames as jest.MockedFunction<typeof loadLapFrames>;

/** Un tour à vitesse constante, dans la forme que la base rend. */
function tour(kmh: number, secondes: number) {
  const n = Math.round(secondes * 25);
  return Array.from({ length: n + 1 }, (_, i) => ({
    elapsedMs: (i * 1000) / 25,
    lat: null,
    lon: null,
    speedKmh: kmh,
    gLat: null,
    gLong: null,
    gVert: null,
    yawRateRadS: null,
  }));
}

beforeEach(() => charge.mockReset());

describe('quand il n’y a rien', () => {
  it('aucune trame → null et sa raison, jamais zéro', async () => {
    charge.mockResolvedValue([]);
    const r = await loadDeltaEntreTours('s', 2, 1);
    expect(r.delta).toBeNull();
    expect(r.raison).toBe('aucune-trame');
  });

  it('une lecture qui échoue ne remonte pas d’exception à l’écran', async () => {
    charge.mockRejectedValue(new Error('réseau'));
    const r = await loadDeltaEntreTours('s', 2, 1);
    expect(r.delta).toBeNull();
    expect(r.raison).toBe('erreur-chargement');
  });

  it('un tour d’une seule trame est trop court', async () => {
    charge.mockResolvedValue([tour(100, 36)[0]]);
    const r = await loadDeltaEntreTours('s', 2, 1);
    expect(r.delta).toBeNull();
    expect(r.raison).toBe('tour-trop-court');
  });

  /**
   * Comparer un tour complet à un demi-tour tronqué produirait un delta qui
   * diverge sans jamais se refermer. Le pilote lirait un écart de plusieurs
   * secondes qui ne dit rien de sa conduite.
   */
  it('deux tours de longueurs trop différentes sont refusés', async () => {
    charge.mockImplementation(async (_s, n) => (n === 2 ? tour(100, 36) : tour(100, 12)));
    const r = await loadDeltaEntreTours('s', 2, 1);
    expect(r.delta).toBeNull();
    expect(r.raison).toBe('tours-non-comparables');
  });

  it('les numéros de tour sont rendus même en cas de refus', async () => {
    charge.mockResolvedValue([]);
    const r = await loadDeltaEntreTours('s', 7, 3);
    expect(r.tours).toEqual({ courant: 7, reference: 3 });
  });
});

describe('quand il y a de quoi', () => {
  it('deux tours comparables donnent un delta fini', async () => {
    charge.mockImplementation(async (_s, n) => (n === 2 ? tour(100, 36) : tour(96, 36)));
    const r = await loadDeltaEntreTours('s', 2, 1);
    expect(r.delta).not.toBeNull();
    expect(r.raison).toBeUndefined();
    expect(Number.isFinite(r.delta!.total!)).toBe(true);
  });

  // Le critère d'acceptation du jalon, vu depuis le service.
  it('un tour comparé à lui-même se referme à zéro', async () => {
    charge.mockResolvedValue(tour(100, 36));
    const r = await loadDeltaEntreTours('s', 2, 2);
    expect(Math.abs(r.delta!.total!)).toBeLessThan(1e-9);
  });
});

describe('le tour tronqué', () => {
  /**
   * `loadLapFrames` plafonne à deux mille trames, soit quatre-vingts secondes
   * à vingt-cinq hertz — moins qu'un tour sur beaucoup de circuits.
   *
   * LE PIÈGE : un delta calculé sur deux tours tronqués SE REFERME PROPREMENT.
   * Il décrit un début de tour en se faisant passer pour le tour entier, et
   * rien dans la courbe ne le trahit. D'où ce drapeau.
   */
  it('signale la troncature quand un tour atteint le plafond', async () => {
    const long = Array.from({ length: PLAFOND_TRAMES_TOUR }, (_, i) => ({
      elapsedMs: i * 40,
      lat: null,
      lon: null,
      speedKmh: 100,
      gLat: null,
      gLong: null,
      gVert: null,
      yawRateRadS: null,
    }));
    charge.mockResolvedValue(long);
    const r = await loadDeltaEntreTours('s', 2, 1);
    expect(r.tronque).toBe(true);
    // Le delta reste calculé : il décrit vraiment la portion chargée.
    expect(r.delta).not.toBeNull();
  });

  it('ne signale rien sur un tour court', async () => {
    charge.mockResolvedValue(tour(100, 36));
    expect((await loadDeltaEntreTours('s', 2, 2)).tronque).toBe(false);
  });

  /** Le drapeau accompagne aussi les refus : la raison ne l'efface pas. */
  it('accompagne un refus', async () => {
    charge.mockResolvedValue([]);
    expect((await loadDeltaEntreTours('s', 2, 1)).tronque).toBe(false);
  });
});

describe('ce que le pilote lit', () => {
  it('chaque raison a son texte', () => {
    for (const cle of [
      'aucune-trame',
      'tour-trop-court',
      'tours-non-comparables',
      'erreur-chargement',
    ] as const) {
      expect(TEXTE_ABSENCE[cle].length).toBeGreaterThan(10);
    }
  });

  it('aucun texte n’est prescriptif, ni tutoyant, ni orné', () => {
    for (const t of Object.values(TEXTE_ABSENCE)) {
      expect(t).not.toMatch(/vous devez|il faut|veuillez|réessayez/i);
      expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
