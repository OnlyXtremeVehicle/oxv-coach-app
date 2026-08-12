/**
 * Le second facteur — et les deux façons de se tirer une balle dans le pied.
 *
 * La première serait de BARRER un administrateur sans facteur : les trois
 * comptes de production n'en ont aucun, la garde fermerait l'espace admin à
 * tout le monde, et personne ne pourrait plus atteindre l'écran depuis lequel
 * on en pose un.
 *
 * La seconde serait de barrer sur une PANNE RÉSEAU. C'est exactement le défaut
 * que le garde de profil de cet espace a déjà connu : un administrateur éjecté
 * en plein pointage, sur la 4G du circuit, sans un mot. On ne fabrique pas une
 * seconde porte qui se ferme de la même manière.
 */

import { doitPresenterFacteur, sansSecondFacteur } from '../mfaLogic';

describe('quand exiger le second facteur', () => {
  it('le compte a un facteur et la session ne l’a pas présenté → on l’exige', () => {
    expect(doitPresenterFacteur({ courant: 'aal1', requis: 'aal2' })).toBe(true);
  });

  it('la session l’a déjà présenté → on ne redemande rien', () => {
    expect(doitPresenterFacteur({ courant: 'aal2', requis: 'aal2' })).toBe(false);
  });

  it('le compte n’a aucun facteur → rien à exiger', () => {
    expect(doitPresenterFacteur({ courant: 'aal1', requis: 'aal1' })).toBe(false);
  });
});

describe('la panne réseau n’est pas un refus', () => {
  /**
   * `lireNiveauAssurance` rend `null` quand la lecture échoue. Traiter ce
   * `null` comme « facteur exigé » enfermerait dehors un administrateur au
   * bord de la piste, au moment précis où il a besoin de l'espace.
   */
  it('un niveau illisible ne barre pas l’accès', () => {
    expect(doitPresenterFacteur({ courant: null, requis: null })).toBe(false);
    expect(doitPresenterFacteur({ courant: null, requis: 'aal2' })).toBe(false);
    expect(doitPresenterFacteur({ courant: 'aal1', requis: null })).toBe(false);
  });
});

describe('l’avertissement — il informe, il ne ferme pas', () => {
  it('un compte sans facteur est signalé', () => {
    expect(sansSecondFacteur({ courant: 'aal1', requis: 'aal1' })).toBe(true);
  });

  it('un compte qui en a un n’est pas signalé', () => {
    expect(sansSecondFacteur({ courant: 'aal1', requis: 'aal2' })).toBe(false);
    expect(sansSecondFacteur({ courant: 'aal2', requis: 'aal2' })).toBe(false);
  });

  /**
   * LE POINT QUI COMPTE : les deux fonctions ne sont JAMAIS vraies ensemble.
   * Un compte est soit à avertir, soit à faire s'élever — jamais les deux, ce
   * qui produirait un écran qui demande un code qu'aucun facteur ne peut
   * produire.
   */
  it('avertir et exiger s’excluent, dans tous les cas', () => {
    const niveaux = ['aal1', 'aal2', null] as const;
    for (const courant of niveaux) {
      for (const requis of niveaux) {
        const n = { courant, requis };
        expect(doitPresenterFacteur(n) && sansSecondFacteur(n)).toBe(false);
      }
    }
  });
});
