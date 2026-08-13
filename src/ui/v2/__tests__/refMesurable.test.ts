/**
 * LA GARDE QUI TUAIT L'APPLICATION — ÉPROUVÉE EN L'EXÉCUTANT.
 *
 * ===========================================================================
 * CE QU'IL Y AVAIT AVANT, ET POURQUOI ÇA NE VALAIT RIEN
 * ===========================================================================
 *
 * `firstViewportRefAttache.guard.test.ts` « prouvait » cette protection ainsi :
 *
 *     const garde  = src.indexOf('ref.current === null');
 *     const mesure = src.indexOf('measure(ref)');
 *     expect(garde).toBeLessThan(mesure);
 *
 * Douze tests verts. Ils comparaient deux positions de chaîne dans un fichier,
 * et seraient restés verts si la condition avait dit `=== 'bleu'`. Elle disait
 * en réalité quelque chose d'aussi inopérant : `ref.current === null`, sur un
 * fil où `ref` est une fonction fléchée sans propriété `current`.
 *
 * La garde n'a jamais rendu la main une seule fois. Le commentaire du code, le
 * message de commit et le test affirmaient tous les trois qu'elle protégeait
 * du plantage du 13/08. Trois affirmations, zéro exécution.
 *
 * ===========================================================================
 * CE QUE CE FICHIER FAIT À LA PLACE
 * ===========================================================================
 *
 * Il APPELLE la décision, avec les valeurs que `AnimatedRef` rend réellement
 * sur le fil UI — relevées dans `node_modules`, pas imaginées :
 *
 *   - `null`   : `useAnimatedRef` initialise `makeMutable(null)`, et un ref
 *                jamais attaché garde cette valeur ;
 *   - `-1`     : le seul cas que `measure` teste lui-même ;
 *   - nombre   : un tag de vue exploitable.
 *
 * Un test qui exécute peut se tromper de valeur attendue ; un test qui lit du
 * texte ne peut même pas se tromper — il ne dit rien.
 */

import fs from 'fs';
import path from 'path';

import { tagMesurable } from '../refMesurable';

describe('tagMesurable — ce que measure recevrait', () => {
  /**
   * LE CAS DU 13/08/2026. `SectionBande` armait le hook puis sortait par
   * `return null` : le ref n'était jamais attaché, `sharedWrapper.value`
   * restait à `null`, et `measure` le laissait descendre en natif —
   * `shadowNodeFromValue` fait `asObject()` sur une valeur nulle, lève une
   * `JSIException` depuis un frame callback, et le processus meurt.
   */
  it('un ref JAMAIS attaché (null) est refusé', () => {
    expect(tagMesurable(null)).toBe(false);
  });

  /** Le seul cas que Reanimated attrape déjà — on ne le laisse pas passer non plus. */
  it('le tag -1 est refusé', () => {
    expect(tagMesurable(-1)).toBe(false);
  });

  /**
   * `undefined` EST LA VALEUR QUI A PIÉGÉ LA PREMIÈRE ÉCRITURE.
   *
   * La garde testait `ref.current === null`. Sur le fil UI, `ref` est la
   * fonction `() => sharedWrapper.value` : `ref.current` vaut `undefined`, et
   * `undefined === null` est faux. Toute la protection tenait à cette
   * différence, et elle tenait du mauvais côté.
   */
  it('undefined est refusé — c’est la valeur qui a rendu la garde inerte', () => {
    expect(tagMesurable(undefined)).toBe(false);
  });

  /**
   * `NaN` traverse `!== null` et `!== -1` sans broncher, et descend en natif
   * exactement comme `null`. Une garde qui ne teste que les deux premiers le
   * laisse passer.
   */
  it('NaN est refusé', () => {
    expect(tagMesurable(Number.NaN)).toBe(false);
  });

  it('l’infini est refusé', () => {
    expect(tagMesurable(Number.POSITIVE_INFINITY)).toBe(false);
    expect(tagMesurable(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  /**
   * LE CONTRE-TEST, ET IL N'EST PAS DÉCORATIF. Une garde qui refuserait TOUT
   * passerait les cinq cas ci-dessus sans rien protéger — et les animations
   * d'apparition ne se déclencheraient plus jamais, en silence.
   */
  it('un vrai tag de vue est accepté', () => {
    expect(tagMesurable(1)).toBe(true);
    expect(tagMesurable(42)).toBe(true);
    expect(tagMesurable(123456)).toBe(true);
  });

  /**
   * Zéro est un tag valide. Le refuser au motif qu'il est falsy serait le
   * classique `if (!tag)` — qui condamnerait une vue réelle sans le dire.
   */
  it('le tag 0 est accepté : falsy n’est pas invalide', () => {
    expect(tagMesurable(0)).toBe(true);
  });
});

describe('la garde est réellement branchée dans le worklet', () => {
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'useFirstViewport.ts'), 'utf8');

  /**
   * Le CODE, sans la prose. Le commentaire du hook raconte le défaut, et cite
   * donc `ref.current` plusieurs fois — un test qui chercherait la chaîne dans
   * le fichier entier échouerait sur son propre récit. Ce genre de faux positif
   * finit toujours par faire affaiblir le test plutôt que corriger le code.
   */
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  /**
   * Ce test-ci LIT la source, et il l'assume : il ne prouve pas que la garde
   * fonctionne — c'est le rôle des cas exécutés ci-dessus — mais que le hook
   * l'emprunte. Les deux ensemble couvrent ce qu'aucun ne couvre seul.
   */
  it('le hook appelle tagMesurable avant measure', () => {
    const garde = CODE.indexOf('tagMesurable(');
    const mesure = CODE.indexOf('measure(ref)');
    expect(garde).toBeGreaterThan(-1);
    expect(mesure).toBeGreaterThan(-1);
    expect(garde).toBeLessThan(mesure);
  });

  /**
   * ET LA CONDITION MORTE NE DOIT PAS REVENIR. `ref.current` ne peut pas être
   * lu depuis le fil UI ; y revenir rétablirait exactement la garde inerte.
   */
  it('le worklet ne lit plus `ref.current` — cette propriété n’existe pas côté UI', () => {
    expect(CODE).not.toMatch(/ref\.current/);
  });

  /** Le tag s'obtient en APPELANT le ref, comme `measure` le fait lui-même. */
  it('le tag est obtenu en appelant le ref', () => {
    expect(CODE).toMatch(/\(ref as unknown as \(\) => TagDeVue\)\(\)/);
  });
});
