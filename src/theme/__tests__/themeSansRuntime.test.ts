/**
 * Le thème et les métriques ne dépendent d'AUCUN runtime natif.
 *
 * ---
 *
 * POURQUOI CETTE GARDE EXISTE
 *
 * Elle a été posée après l'avoir cassée. En donnant à `spacing.screen` sa valeur
 * par palier, j'ai écrit `Dimensions.get('window').width` dans `v2.ts`. Deux
 * suites entières sont tombées d'un coup — pas la mienne seule : **toute la
 * couche logique importe le thème**, et le banc Jest de ce dépôt est
 * volontairement dépourvu de la chaîne native (`jest.config.js` : « ts-jest pour
 * ne pas hériter du preset jest-expo »).
 *
 * L'erreur était visible immédiatement, cette fois. Elle ne l'aurait pas été si
 * le module fautif avait été importé par un seul test — d'où cette garde, qui
 * nomme la règle au lieu de compter sur le hasard d'une suite qui casse.
 *
 * La contrepartie est écrite en clair dans `v2.ts` : le palier de 24 pt au-delà
 * de 414 pt n'est pas porté par le jeton. Il est porté par `margeEcran()`, que
 * seul un composant connaissant sa largeur peut appeler.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..');

/** Retire les commentaires : un en-tête qui explique le défaut le nomme. */
function codeSeul(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Modules de thème qui doivent rester importables sans chaîne native. */
const PURS = ['v2.ts', 'metriques.ts', 'fonts.ts'];

describe('thème — aucune dépendance au runtime natif', () => {
  it.each(PURS)('%s n’importe pas react-native', (fichier) => {
    const code = codeSeul(readFileSync(join(RACINE, fichier), 'utf8'));
    expect(code).not.toMatch(/from\s+'react-native'/);
    expect(code).not.toMatch(/require\(\s*'react-native'\s*\)/);
  });

  it.each(PURS)('%s ne lit pas Dimensions', (fichier) => {
    const code = codeSeul(readFileSync(join(RACINE, fichier), 'utf8'));
    expect(code).not.toContain('Dimensions');
  });

  // Le module de métriques est le socle du calcul de gabarit : s'il devenait
  // impur, le test d'acceptation « 320 pt » ne pourrait plus tourner du tout.
  it('metriques.ts n’importe rien', () => {
    const code = codeSeul(readFileSync(join(RACINE, 'metriques.ts'), 'utf8'));
    expect(code).not.toMatch(/^\s*import\s/m);
  });
});
