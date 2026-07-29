/**
 * La file des créneaux à valider — jalon 6, préalable.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * *« Liseré rouge sur une seule séance, la plus ancienne en attente : une file
 * où tout est urgent n'est plus une file. »*
 *
 * La tentation, à la première refonte, sera de marquer toutes les lignes en
 * attente — c'est plus simple à écrire et ça paraît plus visible. Le test
 * central l'interdit.
 */

import {
  construitFile,
  joursDAttente,
  libelleAttente,
  libelleCoach,
  type CreneauEnAttente,
} from '../creneauxValidationLogic';

/** 15 juillet 2026, midi UTC — repère fixe, aucune horloge lue. */
const MAINTENANT = Date.parse('2026-07-15T12:00:00Z');

function creneau(id: string, createdAt: string, coachNom: string | null = null): CreneauEnAttente {
  return {
    id,
    coachId: `${id}-0000-0000-0000-000000000000`,
    coachNom,
    circuitName: 'Haute Saintonge',
    startsAt: '2026-08-01T09:00:00Z',
    endsAt: null,
    capacity: 4,
    notes: null,
    createdAt,
  };
}

describe('l’ordre est celui de l’attente', () => {
  /**
   * On trie par date de PROPOSITION, pas par date de séance. Un coach qui a
   * proposé il y a trois jours attend depuis trois jours, que sa séance soit
   * demain ou dans six mois.
   */
  it('le plus anciennement proposé vient en tête', () => {
    const f = construitFile(
      [
        creneau('c', '2026-07-14T10:00:00Z'),
        creneau('a', '2026-07-10T10:00:00Z'),
        creneau('b', '2026-07-12T10:00:00Z'),
      ],
      MAINTENANT
    );
    expect(f.map((l) => l.creneau.id)).toEqual(['a', 'b', 'c']);
  });

  it('la date de séance n’entre pas dans l’ordre', () => {
    const tot = { ...creneau('tot', '2026-07-14T10:00:00Z'), startsAt: '2026-07-16T09:00:00Z' };
    const tard = { ...creneau('tard', '2026-07-10T10:00:00Z'), startsAt: '2026-12-01T09:00:00Z' };
    expect(construitFile([tot, tard], MAINTENANT).map((l) => l.creneau.id)).toEqual([
      'tard',
      'tot',
    ]);
  });
});

describe('une seule marque', () => {
  /**
   * LE TEST CENTRAL. Une file où tout est urgent n'est plus une file.
   */
  it('exactement une ligne est marquée, et c’est la plus ancienne', () => {
    const f = construitFile(
      [
        creneau('c', '2026-07-14T10:00:00Z'),
        creneau('a', '2026-07-10T10:00:00Z'),
        creneau('b', '2026-07-12T10:00:00Z'),
      ],
      MAINTENANT
    );
    expect(f.filter((l) => l.marquee)).toHaveLength(1);
    expect(f.find((l) => l.marquee)?.creneau.id).toBe('a');
  });

  it('une file d’un seul créneau marque ce créneau', () => {
    const f = construitFile([creneau('seul', '2026-07-14T10:00:00Z')], MAINTENANT);
    expect(f[0].marquee).toBe(true);
  });

  it('une file vide ne marque rien, et ne lève rien', () => {
    expect(construitFile([], MAINTENANT)).toEqual([]);
  });
});

describe('les horodatages abîmés', () => {
  /**
   * Un créneau existe même si sa date de proposition est illisible. L'écarter
   * le rendrait INVALIDABLE — il resterait en attente sans que personne ne
   * puisse le voir. Il passe en fin de file, là où il ne masque rien.
   */
  it('un horodatage illisible passe en fin de file, sans disparaître', () => {
    const f = construitFile(
      [creneau('casse', 'pas-une-date'), creneau('bon', '2026-07-12T10:00:00Z')],
      MAINTENANT
    );
    expect(f.map((l) => l.creneau.id)).toEqual(['bon', 'casse']);
    expect(f).toHaveLength(2);
  });

  /** Marquer une date illisible dirait « commencez par là » sans raison. */
  it('la marque ne va jamais à un horodatage illisible s’il existe une date lisible', () => {
    const f = construitFile(
      [creneau('casse', 'pas-une-date'), creneau('bon', '2026-07-12T10:00:00Z')],
      MAINTENANT
    );
    expect(f.find((l) => l.marquee)?.creneau.id).toBe('bon');
  });

  it('une file entièrement illisible ne marque rien', () => {
    const f = construitFile([creneau('x', 'nawak'), creneau('y', '')], MAINTENANT);
    expect(f.filter((l) => l.marquee)).toHaveLength(0);
    expect(f).toHaveLength(2);
  });
});

describe('les jours d’attente', () => {
  it('compte les jours pleins', () => {
    expect(joursDAttente('2026-07-12T12:00:00Z', MAINTENANT)).toBe(3);
    expect(joursDAttente('2026-07-15T11:00:00Z', MAINTENANT)).toBe(0);
  });

  /**
   * Une horloge d'appareil peut avancer. « En attente depuis −2 jours »
   * n'informe personne.
   */
  it('un horodatage futur rend zéro, jamais un négatif', () => {
    expect(joursDAttente('2026-08-01T00:00:00Z', MAINTENANT)).toBe(0);
  });

  it('un horodatage illisible rend zéro', () => {
    expect(joursDAttente('n’importe quoi', MAINTENANT)).toBe(0);
  });
});

describe('ce que l’administrateur lit', () => {
  it('le libellé d’attente est un fait, jamais un reproche', () => {
    expect(libelleAttente(0)).toBe('Proposé aujourd’hui');
    expect(libelleAttente(1)).toBe('En attente depuis hier');
    expect(libelleAttente(5)).toBe('En attente depuis 5 jours');
    for (const j of [0, 1, 5, 40]) {
      expect(libelleAttente(j)).not.toMatch(/retard|urgent|oubli|devez|il faut/i);
    }
  });

  it('le nom du coach vient de sa fiche quand elle existe', () => {
    expect(libelleCoach(creneau('a', '2026-07-10T10:00:00Z', 'Marc Lemoine'))).toBe('Marc Lemoine');
  });

  /**
   * Sans fiche, on montre l'identifiant tronqué plutôt qu'un nom fabriqué :
   * un identifiant se retrouve, un faux nom ne se retrouve pas.
   */
  it('sans fiche, l’identifiant tronqué — jamais un nom inventé', () => {
    // Huit caractères de l'identifiant, puis les points de suspension.
    expect(libelleCoach(creneau('a', '2026-07-10T10:00:00Z', null))).toBe('Coach a-0000-0…');
    expect(libelleCoach(creneau('a', '2026-07-10T10:00:00Z', '   '))).toBe('Coach a-0000-0…');
  });
});
