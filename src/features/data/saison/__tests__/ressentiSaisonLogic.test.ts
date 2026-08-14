import { MINIMUM_REPONSES, ressentiSaison } from '../ressentiSaisonLogic';

/** n fois le thème `t`. */
const fois = (t: string, n: number): string[] => Array.from({ length: n }, () => t);

describe('ressentiSaison', () => {
  it('aucune réponse : pas de phrase, et la raison est dite', () => {
    const r = ressentiSaison([]);
    expect(r.total).toBe(0);
    expect(r.phrase).toBeNull();
    expect(r.raison).toMatch(new RegExp(`${MINIMUM_REPONSES} retours`));
  });

  /**
   * LE CŒUR. Deux notes ne font pas une tendance. Un pourcentage sur trois
   * réponses donnerait à un hasard l'allure d'un constat.
   */
  it('sous le seuil : rien n’est affirmé', () => {
    const r = ressentiSaison([...fois('freinage', 3), ...fois('rythme', 2)]);
    expect(r.total).toBe(5);
    expect(r.phrase).toBeNull();
    expect(r.raison).toContain('5');
  });

  it('au seuil exact : la phrase apparaît', () => {
    const r = ressentiSaison([...fois('freinage', 5), ...fois('rythme', 3)]);
    expect(r.total).toBe(MINIMUM_REPONSES);
    expect(r.phrase).toMatch(/le freinage/);
    expect(r.phrase).toMatch(/5 fois/);
    expect(r.raison).toBeNull();
  });

  /**
   * L'égalité est DITE, pas tranchée : désigner un premier entre deux thèmes à
   * égalité fabriquerait une dominance que le comptage ne montre pas.
   */
  it('deux thèmes à égalité : aucun n’est déclaré premier', () => {
    const r = ressentiSaison([...fois('freinage', 5), ...fois('rythme', 5)]);
    expect(r.phrase).toMatch(/autant l'un que l'autre/);
    expect(r.phrase).toContain('le freinage');
    expect(r.phrase).toContain('le rythme');
  });

  it('les notes sans thème ne gonflent pas le dénominateur', () => {
    const r = ressentiSaison([...fois('freinage', 8), null, null, null]);
    expect(r.total).toBe(8);
    expect(r.phrase).toMatch(/Sur 8 retours/);
  });

  it('un thème inconnu est ignoré plutôt que compté', () => {
    // La contrainte Postgres borne les valeurs ; si une nouvelle apparaissait,
    // mieux vaut l'ignorer que de l'afficher sans libellé.
    const r = ressentiSaison([...fois('freinage', 8), ...fois('inconnu', 4)]);
    expect(r.total).toBe(8);
    expect(r.comptes.map((c) => c.cle)).toEqual(['freinage']);
  });

  it('le tri est déterministe à égalité', () => {
    const a = ressentiSaison([...fois('rythme', 4), ...fois('placement', 4)]);
    const b = ressentiSaison([...fois('placement', 4), ...fois('rythme', 4)]);
    expect(a.comptes.map((c) => c.cle)).toEqual(b.comptes.map((c) => c.cle));
  });

  /**
   * ON COMPTE, ON N'INTERPRÈTE PAS. Aucun mot de jugement, aucune consigne :
   * un thème revenu souvent est un thème qui occupe le pilote, et le sens lui
   * appartient.
   */
  it('la phrase ne juge pas et ne prescrit pas', () => {
    const r = ressentiSaison(fois('freinage', 12));
    const p = r.phrase as string;
    expect(p).not.toMatch(/faiblesse|point faible|à travailler|devriez|il faut|améliorer/i);
    expect(p).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
