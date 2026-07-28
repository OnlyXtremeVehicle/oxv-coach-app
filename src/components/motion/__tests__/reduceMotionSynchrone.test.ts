/**
 * Le hook de réduction des animations doit être SYNCHRONE.
 *
 * Jalon 2, phase 1 — « correctif obligatoire ». Le hook v1 résolvait
 * `AccessibilityInfo.isReduceMotionEnabled()`, une promesse : il répondait
 * `false` pendant les premières images. Toute l'entrée d'un écran jouait donc
 * avant de claquer à l'état final, chez un utilisateur qui avait justement
 * demandé l'absence de mouvement.
 *
 * Ce test défend le CONTRAT plutôt que le comportement : monter un hook React
 * Native ici demanderait un moteur de rendu que ce banc n'a pas. Ce qu'on peut
 * vérifier — et ce qui a réellement lâché — c'est la source de la valeur.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Retire les commentaires avant d'examiner un fichier.
 *
 * Sans cela, le test attrapait `isReduceMotionEnabled` dans le COMMENTAIRE qui
 * explique son retrait — et l'en-tête d'un correctif décrit forcément ce qu'il
 * corrige. Un test qui interdit de nommer le défaut interdirait de le
 * documenter.
 */
function codeSeul(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const V1 = codeSeul(readFileSync(join(__dirname, '..', 'useReduceMotion.ts'), 'utf8'));
const V2 = codeSeul(
  readFileSync(
    join(__dirname, '..', '..', '..', 'ui', 'v2', 'motion', 'useReduceMotion.ts'),
    'utf8'
  )
);

describe('useReduceMotion v1 — le correctif obligatoire', () => {
  it('lit la valeur de façon synchrone, via Reanimated', () => {
    expect(V1).toContain("from 'react-native-reanimated'");
    expect(V1).toContain('useReducedMotion');
  });

  // La source du défaut : une promesse résolue après les premières images.
  it('n’appelle plus AccessibilityInfo de façon asynchrone', () => {
    expect(V1).not.toContain('isReduceMotionEnabled');
    expect(V1).not.toContain('AccessibilityInfo');
  });

  it('ne repose plus sur un état différé', () => {
    expect(V1).not.toContain('useState');
    expect(V1).not.toContain('useEffect');
  });
});

describe('les deux kits ne divergent plus', () => {
  // Deux réponses possibles à la même question système était un défaut en soi :
  // un composant se comportait différemment selon le kit dont il venait.
  it('v1 et v2 emploient la MÊME source', () => {
    for (const src of [V1, V2]) {
      expect(src).toContain("from 'react-native-reanimated'");
      expect(src).toContain('useReducedMotion');
    }
  });
});
