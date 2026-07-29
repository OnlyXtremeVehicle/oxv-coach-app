/**
 * Le maillon entre les trames et la banque — et les conversions qu'il porte.
 * Jalon 4, phase 4septies.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * La banque a soixante-neuf tests et n'était importée nulle part. Il ne
 * manquait pas du câblage : il manquait la CONVERSION. La banque parle en
 * secondes et en mètres par seconde, l'application stocke des millisecondes et
 * des kilomètres par heure.
 *
 * Une erreur de facteur mille ferait durer un tour de quatre-vingt-dix secondes
 * vingt-cinq heures — et le delta resterait « cohérent avec lui-même », donc
 * invisible au test d'acceptation du jalon. C'est le genre d'erreur qu'aucun
 * test d'intégration n'attrape et qu'un test d'unité attrape en une ligne.
 *
 * Règle fondateur : les conversions se vérifient avant le commit.
 */

import { computeDelta } from '../delta';
import {
  ECART_LONGUEUR_TOLERE,
  longueurTour,
  msDepuisKmh,
  tousDeuxComparables,
  versSamples,
  versSerieDistance,
  type TrameBrute,
} from '../adaptation';

/** Un tour à vitesse constante : la distance attendue se calcule à la main. */
function tourConstant(kmh: number, secondes: number, hz = 25): TrameBrute[] {
  const n = Math.round(secondes * hz);
  return Array.from({ length: n + 1 }, (_, i) => ({
    elapsedMs: (i * 1000) / hz,
    speedKmh: kmh,
  }));
}

describe('les conversions, vérifiées et non supposées', () => {
  it('100 km/h font 27,777… m/s', () => {
    expect(msDepuisKmh(100)).toBeCloseTo(27.7778, 4);
  });

  it('3,6 km/h font exactement 1 m/s', () => {
    expect(msDepuisKmh(3.6)).toBeCloseTo(1, 12);
  });

  it('les millisecondes deviennent des secondes', () => {
    const s = versSamples([{ elapsedMs: 90_000, speedKmh: 36 }]);
    expect(s[0].t).toBe(90);
    expect(s[0].speed).toBeCloseTo(10, 12);
  });

  /**
   * LE TEST QUI ATTRAPE LE FACTEUR MILLE.
   *
   * 100 km/h pendant 36 s font exactement 1 000 m. Si l'une des deux
   * conversions dérivait, ce chiffre ne tomberait pas juste.
   */
  it('cent kilomètres-heure pendant trente-six secondes font mille mètres', () => {
    const s = versSerieDistance(tourConstant(100, 36));
    const fin = s.distance[s.distance.length - 1];
    expect(fin).toBeCloseTo(1000, 1);
  });
});

describe('ce qui n’est pas mesuré n’entre pas', () => {
  /**
   * Une vitesse absente ne devient pas zéro. Zéro serait le fait « le véhicule
   * est à l'arrêt » — l'intégration sauterait alors un morceau de piste en
   * croyant l'avoir parcouru immobile, et la distance de TOUS les points
   * suivants serait fausse.
   */
  it('une vitesse absente est écartée, jamais remplacée par zéro', () => {
    const s = versSamples([
      { elapsedMs: 0, speedKmh: 100 },
      { elapsedMs: 40, speedKmh: null },
      { elapsedMs: 80, speedKmh: 100 },
    ]);
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.speed > 0)).toBe(true);
  });

  it.each([NaN, Infinity, -5])('une vitesse « %s » est écartée', (kmh) => {
    expect(versSamples([{ elapsedMs: 0, speedKmh: kmh }])).toHaveLength(0);
  });

  it('un horodatage non fini est écarté', () => {
    expect(versSamples([{ elapsedMs: NaN, speedKmh: 100 }])).toHaveLength(0);
  });

  /**
   * La file de synchronisation hors ligne peut livrer des trames dans le
   * désordre. `cumulativeDistance` intègre pas à pas et suppose le temps
   * croissant : une trame en retard RETRANCHERAIT de la distance.
   */
  it('les trames désordonnées sont remises dans l’ordre', () => {
    const s = versSamples([
      { elapsedMs: 200, speedKmh: 50 },
      { elapsedMs: 0, speedKmh: 50 },
      { elapsedMs: 100, speedKmh: 50 },
    ]);
    expect(s.map((x) => x.t)).toEqual([0, 0.1, 0.2]);
  });
});

describe('une série vide se voit, une série inventée ne se verrait pas', () => {
  it('moins de deux trames exploitables rend une série vide', () => {
    expect(versSerieDistance([]).distance).toEqual([]);
    expect(versSerieDistance([{ elapsedMs: 0, speedKmh: 100 }]).distance).toEqual([]);
  });

  it('la longueur d’un tour sans mesure est null, pas zéro', () => {
    expect(longueurTour([])).toBeNull();
    expect(longueurTour([{ elapsedMs: 0, speedKmh: null }])).toBeNull();
  });

  // Un véhicule à l'arrêt sur toute la trace parcourt zéro mètre : ce n'est
  // pas un tour, et le dire « nul » vaudrait mieux que le dire « de longueur 0 ».
  it('un tour de longueur nulle rend null', () => {
    expect(longueurTour(tourConstant(0, 10))).toBeNull();
  });
});

describe('deux tours comparables', () => {
  /**
   * Comparer un tour complet à un demi-tour tronqué produit un delta qui
   * diverge sans jamais se refermer — et le pilote lirait un écart qui
   * n'existe pas.
   */
  it('accepte deux tours de longueur voisine', () => {
    expect(tousDeuxComparables(tourConstant(100, 36), tourConstant(101, 36))).toBe(true);
  });

  it('refuse un tour tronqué de moitié', () => {
    expect(tousDeuxComparables(tourConstant(100, 36), tourConstant(100, 18))).toBe(false);
  });

  it('refuse quand l’un des deux n’a rien de mesurable', () => {
    expect(tousDeuxComparables(tourConstant(100, 36), [])).toBe(false);
  });

  it('la tolérance est nommée et vaut dix pour cent', () => {
    expect(ECART_LONGUEUR_TOLERE).toBe(0.1);
  });
});

describe('le maillon tient jusqu’au delta — le critère d’acceptation du jalon', () => {
  /**
   * LE TEST QUI VALIDE LA CHAÎNE ENTIÈRE.
   *
   * `delta.test.ts` prouve que `computeDelta` se referme à zéro sur des séries
   * fabriquées. Celui-ci le prouve depuis des TRAMES — c'est-à-dire depuis la
   * forme que l'application stocke réellement.
   *
   * Si l'adaptation était fausse, le delta resterait cohérent avec lui-même et
   * ce test passerait quand même. Il est donc doublé par les tests de
   * conversion plus haut, qui vérifient les valeurs absolues.
   */
  it('un tour comparé à lui-même, depuis les trames, se referme à zéro', () => {
    const trames = Array.from({ length: 900 }, (_, i) => ({
      elapsedMs: i * 40,
      speedKmh: 90 + 40 * Math.sin(i / 30) + 12 * Math.sin(i / 7),
    }));
    const serie = versSerieDistance(trames);
    expect(serie.distance.length).toBeGreaterThan(100);

    const d = computeDelta(serie, serie, 5);
    expect(d.total).not.toBeNull();
    expect(Math.abs(d.total!)).toBeLessThan(1e-9);
  });

  it('deux tours de rythme différent donnent un delta non nul et fini', () => {
    const a = versSerieDistance(tourConstant(100, 36));
    const b = versSerieDistance(tourConstant(95, 36));
    const d = computeDelta(a, b, 5);
    expect(d.total).not.toBeNull();
    expect(Number.isFinite(d.total!)).toBe(true);
    expect(Math.abs(d.total!)).toBeGreaterThan(0);
  });
});
