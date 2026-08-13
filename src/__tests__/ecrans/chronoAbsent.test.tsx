/**
 * LE CHIFFRE ROI, QUAND IL N'Y A RIEN À MONTRER.
 *
 * ===========================================================================
 * CE QU'UN TEST DE RENDU PROUVE, ET QU'UN TEST PUR NE PEUT PAS PROUVER
 * ===========================================================================
 *
 * `msToLapLabel` est pure et testée depuis longtemps : elle rend « — » sur une
 * valeur non finie. Cette vérification-là est acquise.
 *
 * Ce qu'elle NE dit pas, c'est si ce « — » ATTEINT L'ÉCRAN. Entre la fonction et
 * le pilote il y a un composant, un compteur roulant, une découpe en chiffres,
 * une mise à l'échelle. C'est exactement l'espace où vit le défaut dominant de
 * ce dépôt : la règle est juste, elle est testée, et personne ne l'exécute au
 * bon endroit.
 *
 * Le chrono est le seul chiffre de l'écran de bilan. Un « 0:00,000 » à la place
 * d'un tiret y serait une mesure fabriquée, sur l'élément le plus lu du produit.
 *
 * ===========================================================================
 * CE TEST A DES DENTS
 * ===========================================================================
 *
 * Il échouerait si quelqu'un formatait le chrono en ligne dans le composant, si
 * le compteur roulant rendait les chiffres d'un `NaN`, ou si le repli était
 * remplacé par un zéro « plus joli ». Aucune de ces trois régressions n'est
 * visible depuis un test node.
 */

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { ChronoHero } from '@/ui/v2/ChronoHero';

describe('ChronoHero — une absence reste une absence', () => {
  it('un chrono non mesuré affiche un tiret, pas un zéro', () => {
    render(<ChronoHero chronoMs={Number.NaN} size="l" />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0:00,000')).toBeNull();
  });

  it('un chrono négatif — donnée corrompue — affiche aussi un tiret', () => {
    render(<ChronoHero chronoMs={-1} size="l" />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  /**
   * LE CONTRE-TEST, ET IL DÉCIDE. Un composant qui afficherait « — » en toutes
   * circonstances passerait les deux cas ci-dessus — et le pilote ne verrait
   * plus jamais son chrono.
   *
   * 327,542 s : le meilleur tour réel du 13/08 à Bouteville.
   */
  it('un chrono mesuré s’affiche, lui', () => {
    render(<ChronoHero chronoMs={327_542} size="l" />);
    expect(screen.queryByText('—')).toBeNull();
    /**
     * `getAllByText`, et la raison mérite d'être dite : le compteur roulant rend
     * le chrono CHIFFRE PAR CHIFFRE, chacun dans son propre nœud de texte.
     * Découvert en écrivant ce test — `getByText` échouait sur « plusieurs
     * éléments trouvés ».
     *
     * C'est exactement la couche qu'un test pur ne voit pas : `msToLapLabel`
     * rend bien « 5:27,542 », et ce qui arrive à l'écran est une suite de nœuds.
     * Entre les deux, il y a du code que rien ne vérifiait.
     */
    expect(screen.getAllByText(/\d/).length).toBeGreaterThan(0);
  });

  it('zéro milliseconde est une MESURE, pas une absence', () => {
    // 0 est fini et positif : le repli ne doit pas s'en emparer. C'est la même
    // distinction que partout ailleurs dans ce dépôt — zéro mesuré ≠ rien mesuré.
    render(<ChronoHero chronoMs={0} size="m" />);
    expect(screen.queryByText('—')).toBeNull();
  });
});
