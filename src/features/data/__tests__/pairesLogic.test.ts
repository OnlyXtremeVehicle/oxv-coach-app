/**
 * La paire circuit-véhicule — ce que deux filtres indépendants auraient menti.
 *
 * Le plan : « filtre par paire réellement roulée, jamais deux filtres
 * indépendants », et « le filtre par paire s'applique, sinon la comparaison
 * ment ». Ces tests tiennent la dérivation, l'honnêteté de la paire
 * incomplète, et la ligne qui dit toujours ce que l'écran montre.
 */

import {
  CIRCUIT_ABSENT,
  CLE_GENERALE,
  VEHICULE_ABSENT,
  libelleSelection,
  memePaire,
  notePaire,
  pairesRoulees,
  seancesDeLaPaire,
  selecteurUtile,
  type SeanceAppariable,
} from '../pairesLogic';

const s = (circuitId: string | null, vehicleId: string | null, circuitName = 'Haute Saintonge') =>
  ({ circuitId, circuitName, vehicleId }) as SeanceAppariable;

const GARAGE: Record<string, string> = { v1: '911 GT3', v2: 'A110' };
const nom = (id: string): string | null => GARAGE[id] ?? null;

describe('les paires sont dérivées, jamais combinées', () => {
  /**
   * LE DÉFAUT ÉVITÉ. Deux menus séparés offrent le PRODUIT — deux circuits par
   * deux voitures font quatre choix, dont deux n'ont jamais eu lieu. Le pilote
   * choisit, l'écran répond « aucune donnée », et il lui reste à deviner si
   * c'est une panne ou un fait.
   */
  it('deux circuits et deux véhicules ne font pas quatre paires', () => {
    const paires = pairesRoulees([s('c1', 'v1'), s('c2', 'v2', 'Charente'), s('c1', 'v1')], nom);
    expect(paires).toHaveLength(2);
    expect(paires.map((p) => p.cle)).not.toContain('c1::v2');
  });

  it('l’effectif est celui des séances, pas celui des paires', () => {
    const paires = pairesRoulees([s('c1', 'v1'), s('c1', 'v1'), s('c1', 'v2')], nom);
    expect(paires.find((p) => p.vehicleId === 'v1')?.seances).toBe(2);
    expect(paires.find((p) => p.vehicleId === 'v2')?.seances).toBe(1);
  });

  it('la plus roulée vient en tête — ordre d’usage, pas de mérite', () => {
    const paires = pairesRoulees([s('c1', 'v2'), s('c1', 'v1'), s('c1', 'v1')], nom);
    expect(paires[0].vehicleId).toBe('v1');
  });

  it('à effectif égal l’ordre est stable d’un chargement à l’autre', () => {
    const a = pairesRoulees([s('c1', 'v1'), s('c1', 'v2')], nom).map((p) => p.cle);
    const b = pairesRoulees([s('c1', 'v2'), s('c1', 'v1')], nom).map((p) => p.cle);
    expect(a).toEqual(b);
  });

  it('aucune séance, aucune paire — et rien d’inventé', () => {
    expect(pairesRoulees([], nom)).toEqual([]);
  });
});

describe('la paire incomplète — l’historique ne disparaît pas', () => {
  /**
   * Les dix séances de production portent `vehicle_id = null` : l'écran
   * d'armement n'attachait aucun véhicule avant le 12/08/2026. Les exclure
   * ferait disparaître tout l'historique du sélecteur.
   */
  it('une séance sans véhicule forme sa propre paire', () => {
    const paires = pairesRoulees([s('c1', null)], nom);
    expect(paires).toHaveLength(1);
    expect(paires[0].incomplete).toBe(true);
    // Le libellé, lui, dépend du reste du jeu — voir les deux cas plus bas.
    expect(paires[0].circuitId).toBe('c1');
  });

  it('les séances sans véhicule d’un même circuit se regroupent', () => {
    const paires = pairesRoulees([s('c1', null), s('c1', null)], nom);
    expect(paires).toHaveLength(1);
    expect(paires[0].seances).toBe(2);
  });

  /**
   * L'ÉTAT DE TOUTE LA PRODUCTION D'AVANT LE 12/08/2026. Répéter « Véhicule
   * non renseigné » sur chaque puce n'informe de rien : une mention constante
   * est du bruit, et elle double la longueur de chaque libellé.
   */
  it('quand AUCUNE séance ne porte de véhicule, la paire se réduit au circuit', () => {
    const paires = pairesRoulees([s('c1', null), s('c2', null, 'Charente')], nom);
    expect(paires.map((p) => p.libelle).sort()).toEqual(['Charente', 'Haute Saintonge']);
  });

  it('dès qu’UNE séance porte un véhicule, la mention reprend sa place', () => {
    const paires = pairesRoulees([s('c1', null), s('c1', 'v1')], nom);
    const sans = paires.find((p) => p.incomplete);
    expect(sans?.libelle).toContain(VEHICULE_ABSENT);
    expect(paires.find((p) => !p.incomplete)?.libelle).toContain('911 GT3');
  });

  it('un circuit non renseigné se dit aussi, il ne devient pas « inconnu »', () => {
    const paires = pairesRoulees([{ circuitId: null, circuitName: null, vehicleId: 'v1' }], nom);
    expect(paires[0].libelle).toContain(CIRCUIT_ABSENT);
    expect(paires[0].libelle).toContain('911 GT3');
  });

  it('un véhicule illisible a bien roulé — la paire reste, nommée sans cause', () => {
    const paires = pairesRoulees([s('c1', 'disparu')], nom);
    expect(paires[0].libelle).toContain('non rattaché');
    // On ne nomme JAMAIS la cause : effacé et invisible rendent le même vide.
    expect(paires[0].libelle).not.toContain('retiré');
    // Jamais un UUID brut à l'écran.
    expect(paires[0].libelle).not.toContain('disparu');
    // Ce n'est PAS une paire incomplète : le véhicule est connu de la séance.
    expect(paires[0].incomplete).toBe(false);
  });
});

describe('la sélection', () => {
  const seances = [s('c1', 'v1'), s('c1', 'v1'), s('c2', 'v2', 'Charente')];

  it('la générale rend tout', () => {
    expect(seancesDeLaPaire(seances, CLE_GENERALE)).toHaveLength(3);
  });

  it('une paire ne rend qu’elle-même', () => {
    expect(seancesDeLaPaire(seances, 'c1::v1')).toHaveLength(2);
  });

  /**
   * Une clé périmée — un véhicule supprimé entre deux chargements — ne doit
   * pas produire un écran vide qui se lirait comme « vous n'avez rien roulé ».
   */
  it('une clé périmée retombe sur la générale, jamais sur le vide', () => {
    expect(seancesDeLaPaire(seances, 'c9::v9')).toHaveLength(3);
  });
});

describe('la ligne qui dit ce que l’écran montre', () => {
  const paires = pairesRoulees([s('c1', 'v1'), s('c1', 'v1'), s('c2', 'v2', 'Charente')], nom);

  it('la générale annonce le total, pas le nombre de paires', () => {
    expect(libelleSelection(paires, CLE_GENERALE)).toBe('Signature générale · 3 séances');
  });

  it('une paire annonce son circuit, son véhicule et son effectif', () => {
    expect(libelleSelection(paires, 'c1::v1')).toBe('Haute Saintonge · 911 GT3 · 2 séances');
  });

  it('le singulier se dit', () => {
    expect(libelleSelection(paires, 'c2::v2')).toContain('1 séance');
    expect(libelleSelection(paires, 'c2::v2')).not.toContain('1 séances');
  });

  it('sans séance, la ligne s’absente — elle n’annonce jamais zéro', () => {
    expect(libelleSelection([], CLE_GENERALE)).toBeNull();
    expect(libelleSelection(paires, 'c9::v9')).toBeNull();
  });
});

describe('la note de comparaison — elle nomme, elle n’interdit pas', () => {
  /**
   * « Le filtre par paire s'applique, sinon la comparaison ment. » Deux
   * chronos posés côte à côte AFFIRMENT se rapporter à la même chose. Quand
   * c'est faux, il faut le dire — sans pour autant empêcher le pilote de
   * regarder deux voitures côte à côte s'il le veut.
   */
  it('même paire, rien à dire', () => {
    expect(notePaire(s('c1', 'v1'), s('c1', 'v1'))).toBeNull();
  });

  it('deux séances sans véhicule sur un même circuit restent comparables', () => {
    // Tout l'historique d'avant le 12/08/2026 est dans ce cas : le déclarer
    // incomparable rendrait chaque comparaison suspecte sans raison.
    expect(notePaire(s('c1', null), s('c1', null))).toBeNull();
    expect(memePaire(s('c1', null), s('c1', null))).toBe(true);
  });

  it('circuits différents : le tracé se dit', () => {
    expect(notePaire(s('c1', 'v1'), s('c2', 'v1', 'Charente'))).toContain('même circuit');
  });

  it('véhicules différents sur le même circuit : la voiture se dit', () => {
    expect(notePaire(s('c1', 'v1'), s('c1', 'v2'))).toContain('même véhicule');
  });

  it('un véhicule manquant d’un seul côté se dit comme tel', () => {
    expect(notePaire(s('c1', 'v1'), s('c1', null))).toContain('aucun véhicule');
  });

  it('les deux à la fois se disent ensemble, pas deux fois', () => {
    const n = notePaire(s('c1', 'v1'), s('c2', 'v2', 'Charente'));
    expect(n).toContain('ni du même circuit ni du même véhicule');
  });

  it('elle ne conclut ni ne conseille jamais', () => {
    const toutes = [
      notePaire(s('c1', 'v1'), s('c2', 'v1', 'Charente')),
      notePaire(s('c1', 'v1'), s('c1', 'v2')),
      notePaire(s('c1', 'v1'), s('c1', null)),
      notePaire(s('c1', 'v1'), s('c2', 'v2', 'Charente')),
    ];
    for (const n of toutes) {
      expect(n).not.toBeNull();
      expect(n).not.toMatch(/donc|devriez|évitez|préférez|impossible|invalide|faux/i);
      expect(n).not.toMatch(/meilleur|gagnant|plus rapide/i);
      expect(n).not.toMatch(/\blimite/i);
      expect(n).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('le sélecteur ne s’affiche que s’il sert', () => {
  it('une seule paire ne se filtre pas', () => {
    expect(selecteurUtile(pairesRoulees([s('c1', 'v1'), s('c1', 'v1')], nom))).toBe(false);
    expect(selecteurUtile([])).toBe(false);
  });

  it('deux paires, un choix réel', () => {
    expect(selecteurUtile(pairesRoulees([s('c1', 'v1'), s('c1', 'v2')], nom))).toBe(true);
  });
});

describe('ton OXV', () => {
  const libelles = [
    ...pairesRoulees([s('c1', 'v1'), s('c1', null), s('c1', 'parti')], nom).map((p) => p.libelle),
    libelleSelection(pairesRoulees([s('c1', 'v1')], nom), CLE_GENERALE) ?? '',
  ];

  it('aucun jugement, aucun classement', () => {
    for (const l of libelles) {
      expect(l).not.toMatch(/meilleur|record|top|classement|plus rapide/i);
    }
  });

  it('aucun mot proscrit, aucun emoji', () => {
    for (const l of libelles) {
      expect(l).not.toMatch(/\blimite/i);
      expect(l).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
