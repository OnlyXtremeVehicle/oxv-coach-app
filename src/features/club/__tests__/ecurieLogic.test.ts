import {
  ANNUAIRE_VIDE,
  estCapitaine,
  libelleMembres,
  NOM_MAX,
  NOM_MIN,
  SEUIL_ANNUAIRE,
  trierAnnuaire,
  validerNomEcurie,
  type LigneAnnuaire,
} from '../ecurieLogic';

describe('validerNomEcurie', () => {
  it('accepte un nom ordinaire', () => {
    expect(validerNomEcurie('Les Pistards')).toBeNull();
  });

  it('refuse le vide et les espaces seuls', () => {
    expect(validerNomEcurie('')).toMatch(/ne peut pas être vide/);
    expect(validerNomEcurie('   ')).toMatch(/ne peut pas être vide/);
  });

  it('applique les bornes du serveur', () => {
    expect(validerNomEcurie('ab')).toMatch(new RegExp(`${NOM_MIN} caractères`));
    expect(validerNomEcurie('a'.repeat(NOM_MIN))).toBeNull();
    expect(validerNomEcurie('a'.repeat(NOM_MAX))).toBeNull();
    expect(validerNomEcurie('a'.repeat(NOM_MAX + 1))).toMatch(new RegExp(`${NOM_MAX} caractères`));
  });

  /** Le serveur compte après trim : la validation locale doit compter pareil. */
  it('compte APRÈS avoir retiré les espaces de bord', () => {
    expect(validerNomEcurie('  ab  ')).toMatch(new RegExp(`${NOM_MIN} caractères`));
    expect(validerNomEcurie(`  ${'a'.repeat(NOM_MAX)}  `)).toBeNull();
  });
});

describe('estCapitaine', () => {
  const membres = [
    { userId: 'u1', role: 'captain' },
    { userId: 'u2', role: 'member' },
  ];

  it('reconnaît le capitaine', () => {
    expect(estCapitaine(membres, 'u1')).toBe(true);
  });

  it('refuse un membre ordinaire', () => {
    expect(estCapitaine(membres, 'u2')).toBe(false);
  });

  /** Fail-closed : sans identité, aucun pouvoir de capitaine. */
  it('refuse quand l’identité est inconnue', () => {
    expect(estCapitaine(membres, null)).toBe(false);
    expect(estCapitaine(membres, 'inconnu')).toBe(false);
  });
});

describe('trierAnnuaire', () => {
  const l = (name: string, n: number, created_at: string): LigneAnnuaire => ({
    name,
    validated_members: n,
    created_at,
  });

  it('la plus grande écurie d’abord', () => {
    const tri = trierAnnuaire([l('B', 21, '2026-01-02'), l('A', 40, '2026-01-01')]);
    expect(tri.map((x) => x.name)).toEqual(['A', 'B']);
  });

  /**
   * LE CŒUR DOCTRINAL. « L'ordre porte l'information, le numéro déclarerait un
   * verdict. » La fonction rend les lignes du serveur, telles quelles : si un
   * rang était ajouté ici, il traverserait jusqu'à l'écran.
   */
  it('n’ajoute AUCUN rang aux lignes', () => {
    const entree = l('A', 40, '2026-01-01');
    const [sortie] = trierAnnuaire([entree]);
    expect(Object.keys(sortie).sort()).toEqual(['created_at', 'name', 'validated_members']);
  });

  it('à égalité, la plus ancienne d’abord — l’ordre ne bouge pas d’une lecture à l’autre', () => {
    const tri = trierAnnuaire([l('Z', 25, '2026-03-01'), l('A', 25, '2026-01-01')]);
    expect(tri.map((x) => x.name)).toEqual(['A', 'Z']);
  });

  it('à égalité parfaite, le nom départage — le tri reste déterministe', () => {
    const tri = trierAnnuaire([l('Zèbre', 25, '2026-01-01'), l('Alpha', 25, '2026-01-01')]);
    expect(tri.map((x) => x.name)).toEqual(['Alpha', 'Zèbre']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const entree = [l('B', 21, '2026-01-02'), l('A', 40, '2026-01-01')];
    trierAnnuaire(entree);
    expect(entree.map((x) => x.name)).toEqual(['B', 'A']);
  });

  it('une liste vide reste vide', () => {
    expect(trierAnnuaire([])).toEqual([]);
  });
});

describe('libelleMembres', () => {
  it('accorde le pluriel', () => {
    expect(libelleMembres(1)).toBe('1 pilote');
    expect(libelleMembres(4)).toBe('4 pilotes');
  });

  it('borne les valeurs aberrantes plutôt que de les afficher', () => {
    expect(libelleMembres(-3)).toBe('0 pilote');
    expect(libelleMembres(2.7)).toBe('2 pilotes');
  });
});

describe('l’absence de l’annuaire est expliquée', () => {
  /**
   * Une liste vide sans phrase se lit comme une panne. Le dossier de travail
   * prévoit que l'annuaire reste vide TOUTE la première saison : c'est un état
   * normal, il doit se dire.
   */
  it('la phrase nomme le seuil', () => {
    expect(ANNUAIRE_VIDE).toContain(String(SEUIL_ANNUAIRE));
  });

  it('elle vouvoie et ne porte aucun emoji', () => {
    expect(ANNUAIRE_VIDE).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    expect(ANNUAIRE_VIDE).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
