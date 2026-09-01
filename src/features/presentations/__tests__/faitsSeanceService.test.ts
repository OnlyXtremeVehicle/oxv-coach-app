/**
 * LES FAITS DE SÉANCE — ce que le producteur établit, et ce qu'il refuse.
 *
 * Ce fichier ne teste pas Supabase : il teste la DISCIPLINE du module. Un
 * lecteur qui rend `false` sur une panne, une borne de journée qui suit l'heure
 * locale, et six champs dont on affirme qu'ils restent faux — parce qu'un `true`
 * approximatif y coûterait plus cher que la carte qu'il ouvrirait.
 */

import { supabase } from '@/lib/supabase';

import { compterPointsTrace } from '@/services/circuitsService';

import {
  bornesJourneeLocale,
  FAITS_SANS_SOURCE,
  lireCoachLie,
  lireEtatTraitement,
  lireRunsDeLaJournee,
  lireTraceCircuit,
  lireTracePosition,
} from '../faitsSeanceService';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/services/circuitsService', () => ({ compterPointsTrace: jest.fn() }));

const depuis = supabase.from as unknown as jest.Mock;

/** Une chaîne de requête PostgREST qui rend toujours la même réponse. */
function chaine(reponse: unknown) {
  const maillon: Record<string, unknown> = {};
  for (const nom of ['select', 'eq', 'not', 'order', 'limit', 'gte', 'lt']) {
    maillon[nom] = jest.fn(() => maillon);
  }
  // `limit` et `select({count})` terminent : ils doivent être « thenables ».
  (maillon as { then: unknown }).then = (resoudre: (v: unknown) => unknown) =>
    Promise.resolve(reponse).then(resoudre);
  return maillon;
}

beforeEach(() => {
  depuis.mockReset();
});

describe('lireTracePosition', () => {
  it('deux positions distinctes suffisent', async () => {
    depuis.mockReturnValue(
      chaine({
        data: [
          { latitude: 45.1, longitude: 0.2 },
          { latitude: 45.2, longitude: 0.3 },
        ],
        error: null,
      })
    );
    await expect(lireTracePosition('s1')).resolves.toBe(true);
  });

  /**
   * Le cas qui compte : une séance immobile. Deux cents trames au même point ne
   * font pas un tracé — `construireIndex` refuserait une longueur nulle, et un
   * `true` ici ouvrirait vingt-six fiches sur une ligne droite de zéro mètre.
   */
  it('deux cents fois la même position ne font pas un tracé', async () => {
    const immobile = Array.from({ length: 200 }, () => ({ latitude: 45.1, longitude: 0.2 }));
    depuis.mockReturnValue(chaine({ data: immobile, error: null }));
    await expect(lireTracePosition('s1')).resolves.toBe(false);
  });

  it('une seule position ne suffit pas', async () => {
    depuis.mockReturnValue(chaine({ data: [{ latitude: 45.1, longitude: 0.2 }], error: null }));
    await expect(lireTracePosition('s1')).resolves.toBe(false);
  });

  it('une panne rend faux, jamais une exception', async () => {
    depuis.mockReturnValue(chaine({ data: null, error: { message: 'timeout' } }));
    await expect(lireTracePosition('s1')).resolves.toBe(false);
  });

  it('un identifiant vide ne part même pas en requête', async () => {
    await expect(lireTracePosition('')).resolves.toBe(false);
    expect(depuis).not.toHaveBeenCalled();
  });
});

describe('lireCoachLie', () => {
  it('une affiliation active rend vrai', async () => {
    depuis.mockReturnValue(chaine({ data: [{ id: 'a1' }], error: null }));
    await expect(lireCoachLie('p1')).resolves.toBe(true);
  });

  /**
   * La requête filtre sur `status = 'active'` ET `active = true`. Une demande en
   * attente ne rend rien : c'est la base qui l'écarte, et ce test vérifie que le
   * filtre est bien posé — pas qu'on le rejoue en TypeScript.
   */
  it('exige les deux marqueurs d’état, status ET active', async () => {
    const c = chaine({ data: [], error: null });
    depuis.mockReturnValue(c);
    await lireCoachLie('p1');
    const eq = c.eq as jest.Mock;
    const appels = eq.mock.calls.map((a) => `${a[0]}=${String(a[1])}`);
    expect(appels).toContain('status=active');
    expect(appels).toContain('active=true');
  });

  it('une panne rend faux', async () => {
    depuis.mockReturnValue(chaine({ data: null, error: { message: 'RLS' } }));
    await expect(lireCoachLie('p1')).resolves.toBe(false);
  });
});

describe('bornesJourneeLocale', () => {
  /**
   * LA SÉANCE DE RÉFÉRENCE EST EXACTEMENT LE CAS PIÈGE : le 12/08 à 23 h 35 UTC
   * est le 13/08 à 1 h 35 en France. Compter en UTC la rangerait la veille.
   */
  it('la borne basse est minuit LOCAL, pas minuit UTC', () => {
    const b = bornesJourneeLocale('2026-08-12T23:35:54.362Z');
    expect(b).not.toBeNull();
    const de = new Date(b!.de);
    expect(de.getHours()).toBe(0);
    expect(de.getMinutes()).toBe(0);
    // Le jour local de la borne est celui de l'instant, quel que soit le fuseau.
    expect(de.getDate()).toBe(new Date('2026-08-12T23:35:54.362Z').getDate());
  });

  it('la fenêtre dure exactement un jour', () => {
    const b = bornesJourneeLocale('2026-08-12T23:35:54.362Z');
    const heures = (new Date(b!.a).getTime() - new Date(b!.de).getTime()) / 3_600_000;
    // 24 h, sauf changement d'heure — le test tolère les deux bascules.
    expect([23, 24, 25]).toContain(heures);
  });

  it('une date illisible rend null, jamais une fenêtre au hasard', () => {
    expect(bornesJourneeLocale(null)).toBeNull();
    expect(bornesJourneeLocale('')).toBeNull();
    expect(bornesJourneeLocale('pas une date')).toBeNull();
  });
});

describe('lireRunsDeLaJournee', () => {
  it('rend le compte de la base', async () => {
    depuis.mockReturnValue(chaine({ count: 3, error: null }));
    await expect(
      lireRunsDeLaJournee({ piloteId: 'p1', debutSeance: '2026-08-12T23:35:54Z' })
    ).resolves.toBe(3);
  });

  it('sans date, aucune requête et zéro', async () => {
    await expect(lireRunsDeLaJournee({ piloteId: 'p1', debutSeance: null })).resolves.toBe(0);
    expect(depuis).not.toHaveBeenCalled();
  });

  it('une panne rend zéro — la lecture se ferme, elle ne suppose pas', async () => {
    depuis.mockReturnValue(chaine({ count: null, error: { message: 'timeout' } }));
    await expect(
      lireRunsDeLaJournee({ piloteId: 'p1', debutSeance: '2026-08-12T23:35:54Z' })
    ).resolves.toBe(0);
  });
});

describe('lireEtatTraitement', () => {
  it('les deux statuts de la production sont des états connus', () => {
    expect(lireEtatTraitement('completed')).toBe(true);
    expect(lireEtatTraitement('aborted')).toBe(true);
  });

  it('un statut absent ou inconnu ne dit rien', () => {
    expect(lireEtatTraitement(null)).toBe(false);
    expect(lireEtatTraitement('recording')).toBe(false);
    expect(lireEtatTraitement('')).toBe(false);
  });
});

/**
 * LE CLIQUET DES ABSENCES.
 *
 * Si l'un de ces champs devient `true`, c'est qu'une source est apparue — et
 * alors ce test doit ÉCHOUER, pour qu'on écrive la source au lieu de la
 * supposer. C'est la même discipline que la liste des orphelins : une absence
 * déclarée ne se comble pas en silence.
 *
 * `consigneCoach` A QUITTÉ CETTE LISTE le 01/09/2026, et c'est le sens de
 * sortie qu'on veut : la table `coach_consignes` existe, et une absence cesse
 * d'être déclarée parce qu'elle a été comblée.
 */
describe('les faits sans source', () => {
  it('restent faux, tous', () => {
    expect(FAITS_SANS_SOURCE).toEqual({
      santeChaine: false,
      video: false,
      canauxVehicule: false,
      live: false,
      flotteLive: false,
    });
  });

  it('sont exactement cinq clés', () => {
    expect(Object.keys(FAITS_SANS_SOURCE)).toHaveLength(5);
  });

  /**
   * `referencePartagee` est sortie le 01/09/2026 : `session_references` tient
   * les trois limites de M09 — équitable, révocable, anonymisable — et
   * `referenceDisponible` la lit. Une absence déclarée qu'on comble se retire.
   */
  it('la référence partagée n’y est plus — elle a une table', () => {
    expect(Object.keys(FAITS_SANS_SOURCE)).not.toContain('referencePartagee');
  });

  it('la consigne n’y est plus — elle a une table', () => {
    expect(Object.keys(FAITS_SANS_SOURCE)).not.toContain('consigneCoach');
  });
});

/**
 * LE TRACÉ DU CIRCUIT — une géométrie, pas une mesure.
 *
 * Scindé de `tracePosition` le 01/09/2026, parce que le multi-circuit rend la
 * différence visible : ce qui varie d'un circuit à l'autre, c'est justement de
 * savoir s'il porte un tracé. Bouteville 139 points, le Bugatti 589, Albi 138,
 * un circuit neuf aucun.
 */
describe('lireTraceCircuit', () => {
  const compte = compterPointsTrace as unknown as jest.Mock;

  beforeEach(() => compte.mockReset());

  it('un tracé de la base ouvre la lecture', async () => {
    compte.mockResolvedValue(139);
    await expect(lireTraceCircuit('c1')).resolves.toBe(true);
  });

  /**
   * Le plancher est celui de `parseCenterline`, repris et non réinventé : un
   * tracé que l'application refuse de charger n'est pas un tracé affichable.
   */
  it('trois points ne suffisent pas — le même plancher que la lecture', async () => {
    compte.mockResolvedValue(3);
    await expect(lireTraceCircuit('c1')).resolves.toBe(false);
    compte.mockResolvedValue(4);
    await expect(lireTraceCircuit('c1')).resolves.toBe(true);
  });

  it('aucun circuit rattaché : rien à demander', async () => {
    await expect(lireTraceCircuit(null)).resolves.toBe(false);
    expect(compte).not.toHaveBeenCalled();
  });

  it('un circuit sans tracé ferme la lecture', async () => {
    compte.mockResolvedValue(0);
    await expect(lireTraceCircuit('c1')).resolves.toBe(false);
  });
});
