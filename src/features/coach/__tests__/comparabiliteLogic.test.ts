/**
 * COMPARABILITÉ DE DEUX SÉANCES — le score.
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `deux circuits différents bloquent, quel que soit le reste`. Même véhicule,
 * même journée, même météo, lecture complète des deux côtés : si les tracés
 * diffèrent, aucun cumul de points ne rachète la comparaison. Le verdict est
 * « non comparable » d'emblée.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT AUSSI
 *
 * L'inconnu n'est pas l'identique. Un véhicule non renseigné coûte des points
 * ET abaisse la confiance du score : le chiffre est calculé, mais sur des
 * métadonnées trouées — et il le dit.
 */

import {
  ECART_TEMPERATURE_C,
  PENALITE_LECTURE_PARTIELLE,
  PENALITE_LECTURE_REDUITE,
  PENALITE_PLUIE_DIFFERENTE,
  PENALITE_VEHICULE_DIFFERENT,
  SEUIL_AVEC_RESERVES,
  SEUIL_COMPARABLE,
  VERSION_COMPARABILITE,
  libelleVerdict,
  litComparabilite,
  type MetadonneesSeance,
  type VerdictComparabilite,
} from '@/features/coach/comparabiliteLogic';

/** Une séance entièrement renseignée — le point de départ de chaque cas. */
function seance(sur: Partial<MetadonneesSeance> = {}): MetadonneesSeance {
  return {
    circuitId: 'chs',
    vehiculeId: 'gt3-01',
    dateIso: '2026-07-04T14:00:00.000Z',
    meteo: { pluie: false, temperatureC: 22 },
    qualiteMesure: 'complete',
    ...sur,
  };
}

describe('litComparabilite', () => {
  it('deux séances identiques et entièrement renseignées : 100, comparable, confiance haute', () => {
    const c = litComparabilite(seance(), seance());
    expect(c.score).toBe(100);
    expect(c.verdict).toBe('comparable');
    expect(c.confiance).toBe('haute');
    expect(c.raisons).toEqual([]);
    expect(c.version).toBe(VERSION_COMPARABILITE);
  });

  it('deux circuits différents bloquent, quel que soit le reste', () => {
    // LE TEST QUI COMPTE. Tout le reste est parfait — même véhicule, même
    // jour, même météo, lecture complète. Le tracé diffère : rien d'autre ne
    // compte.
    const c = litComparabilite(seance(), seance({ circuitId: 'magny-cours' }));
    expect(c.verdict).toBe('non comparable');
    expect(c.score).toBe(0);
    expect(c.raisons.join(' ')).toContain('Circuits différents');
  });

  it('un autre véhicule pèse lourd sans bloquer', () => {
    const c = litComparabilite(seance(), seance({ vehiculeId: 'gt4-02' }));
    expect(c.score).toBe(100 - PENALITE_VEHICULE_DIFFERENT);
    expect(c.verdict).toBe('comparable avec réserves');
    expect(c.raisons.join(' ')).toContain('Véhicules différents');
  });

  it('pluie d’un côté, sec de l’autre : l’adhérence n’est plus la même donnée', () => {
    const c = litComparabilite(
      seance(),
      seance({ meteo: { pluie: true, temperatureC: 22 } })
    );
    expect(c.score).toBe(100 - PENALITE_PLUIE_DIFFERENTE);
    expect(c.raisons.join(' ')).toContain('Pluie');
  });

  it('les différences s’accumulent jusqu’au « non comparable »', () => {
    // Autre véhicule + pluie : 100 − 40 − 25 = 35, sous le seuil des réserves.
    const c = litComparabilite(
      seance(),
      seance({ vehiculeId: 'gt4-02', meteo: { pluie: true, temperatureC: 22 } })
    );
    expect(c.score).toBe(100 - PENALITE_VEHICULE_DIFFERENT - PENALITE_PLUIE_DIFFERENTE);
    expect(c.verdict).toBe('non comparable');
  });

  describe('l’écart de date', () => {
    it('quelques jours ne coûtent rien', () => {
      const c = litComparabilite(seance(), seance({ dateIso: '2026-07-10T14:00:00.000Z' }));
      expect(c.score).toBe(100);
    });

    it('plus d’un mois se paie, plus de six mois se paie davantage', () => {
      const unMois = litComparabilite(seance(), seance({ dateIso: '2026-09-01T14:00:00.000Z' }));
      const sixMois = litComparabilite(seance(), seance({ dateIso: '2027-03-01T14:00:00.000Z' }));
      expect(unMois.score).toBeLessThan(100);
      expect(sixMois.score).toBeLessThan(unMois.score);
    });

    it('une séance non datée rend l’écart inconnaissable — réserve, pas silence', () => {
      const c = litComparabilite(seance(), seance({ dateIso: null }));
      expect(c.score).toBeLessThan(100);
      expect(c.raisons.join(' ')).toContain('n’est pas datée');
    });
  });

  it('un grand écart de température se lit dans les raisons', () => {
    const c = litComparabilite(
      seance({ meteo: { pluie: false, temperatureC: 8 } }),
      seance({ meteo: { pluie: false, temperatureC: 8 + ECART_TEMPERATURE_C + 1 } })
    );
    expect(c.score).toBeLessThan(100);
    expect(c.raisons.join(' ')).toContain('°C');
  });

  describe('la qualité de mesure', () => {
    it('une lecture réduite pèse plus qu’une lecture partielle', () => {
      const reduite = litComparabilite(seance(), seance({ qualiteMesure: 'limited' }));
      const partielle = litComparabilite(seance(), seance({ qualiteMesure: 'partial' }));
      expect(reduite.score).toBe(100 - PENALITE_LECTURE_REDUITE);
      expect(partielle.score).toBe(100 - PENALITE_LECTURE_PARTIELLE);
      expect(reduite.score).toBeLessThan(partielle.score);
    });
  });

  describe('l’inconnu n’est pas l’identique', () => {
    it('un véhicule non renseigné coûte des points ET une raison', () => {
      const c = litComparabilite(seance(), seance({ vehiculeId: null }));
      expect(c.score).toBeLessThan(100);
      expect(c.raisons.join(' ')).toContain('Véhicule non renseigné');
    });

    it('un circuit non renseigné ne bloque pas, mais ne garantit rien', () => {
      const c = litComparabilite(seance(), seance({ circuitId: null }));
      expect(c.verdict).not.toBe('non comparable');
      expect(c.raisons.join(' ')).toContain('même tracé non garanti');
    });

    it('beaucoup d’inconnues : le score reste calculé, la confiance tombe', () => {
      const trouee = seance({
        vehiculeId: null,
        dateIso: null,
        meteo: null,
        qualiteMesure: null,
      });
      const c = litComparabilite(seance(), trouee);
      expect(typeof c.score).toBe('number');
      expect(c.confiance).toBe('faible');
    });

    it('une seule inconnue suffit à quitter la confiance haute', () => {
      const c = litComparabilite(seance(), seance({ meteo: null }));
      expect(c.confiance).toBe('moyenne');
    });
  });

  it('des métadonnées absentes ne font rien tomber', () => {
    const c = litComparabilite(null, undefined);
    expect(c.verdict).toBe('non comparable');
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.confiance).toBe('faible');
  });

  it('le score reste borné entre 0 et 100', () => {
    const pire = litComparabilite(
      seance({ vehiculeId: 'a', qualiteMesure: 'limited', meteo: { pluie: true, temperatureC: 5 } }),
      seance({
        vehiculeId: 'b',
        dateIso: '2029-01-01T00:00:00.000Z',
        qualiteMesure: 'limited',
        meteo: { pluie: false, temperatureC: 30 },
      })
    );
    expect(pire.score).toBeGreaterThanOrEqual(0);
    expect(pire.score).toBeLessThanOrEqual(100);
  });

  it('les seuils de verdict sont ordonnés — « à valider », mais cohérents', () => {
    expect(SEUIL_AVEC_RESERVES).toBeLessThan(SEUIL_COMPARABLE);
    expect(SEUIL_COMPARABLE).toBeLessThanOrEqual(100);
    expect(SEUIL_AVEC_RESERVES).toBeGreaterThan(0);
  });
});

describe('libelleVerdict', () => {
  it('décrit sans prescrire — l’application montre, elle ne dirige pas', () => {
    const verdicts: VerdictComparabilite[] = [
      'comparable',
      'comparable avec réserves',
      'non comparable',
    ];
    for (const v of verdicts) {
      const phrase = libelleVerdict(v);
      expect(phrase.length).toBeGreaterThan(10);
      expect(phrase).not.toMatch(/vous devriez|il faut|évitez|comparez/i);
    }
  });
});
