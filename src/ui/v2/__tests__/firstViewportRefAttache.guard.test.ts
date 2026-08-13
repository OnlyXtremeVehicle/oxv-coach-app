/**
 * GARDE — un composant qui ARME `useFirstViewport` doit ATTACHER son `ref`.
 *
 * ===========================================================================
 * LE CRASH QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * Nuit du 13/08/2026, premier essai terrain. Le pilote ouvre sa séance dans
 * Data : l'écran se peint, puis **l'application meurt**. À chaque fois.
 *
 * `SectionBande` armait `useFirstViewport(!reduce)` en tête de composant, puis
 * sortait par `return null` — plus bas — tant que la séance ne portait pas plus
 * de 24 tours chronométrés. Le `ref` n'était donc jamais attaché à une vue, et
 * il ne l'était pour AUCUNE séance réelle.
 *
 * Le hook lance un `useFrameCallback` sur le fil UI qui appelle `measure(ref)`
 * toutes les 120 ms. Sur un ref jamais monté, `animatedRef()` rend `null` ; le
 * garde-fou JS de Reanimated ne teste que `viewTag === -1` et laisse passer ;
 * l'appel descend en natif, `shadowNodeFromValue` fait `asObject()` sur une
 * valeur nulle et lève une `JSIException`. Émise depuis un frame callback du
 * fil UI, elle n'est rattrapée par personne : elle est FATALE.
 *
 * ===========================================================================
 * POURQUOI UNE GARDE LEXICALE ICI, ALORS QUE LE DÉPÔT S'EN MÉFIE
 * ===========================================================================
 *
 * Ce dépôt a appris à se méfier des tests qui lisent au lieu d'exécuter. Celui-ci
 * en est un, et c'est assumé — parce que **l'exécution est hors de portée** :
 * `jest.config.js` tourne en `testEnvironment: 'node'` et ne ramasse aucun
 * composant. Rien, dans la chaîne de tests, ne monte une vue React Native.
 * C'est précisément ce qui a laissé ce crash arriver jusqu'au circuit.
 *
 * On vérifie donc ce qui EST vérifiable sans rendu : tout fichier qui appelle
 * `useFirstViewport` doit aussi écrire un `ref={…}` quelque part. C'est plus
 * faible qu'un rendu — cela ne voit pas un attachement CONDITIONNEL — et c'est
 * dit plutôt que sous-entendu, ici comme au-dessus de la vérification.
 *
 * ===========================================================================
 * ET LA PHRASE QUI CONCLUAIT CE COMMENTAIRE ÉTAIT FAUSSE
 * ===========================================================================
 *
 * On lisait ici : « La vraie parade est ailleurs, et elle est posée :
 * `useFirstViewport` refuse désormais de mesurer un ref nul. »
 *
 * Elle ne l'était pas. La garde testait `ref.current === null`, une condition
 * qui ne peut pas être vraie sur le fil UI : `AnimatedRef` y est une fonction
 * fléchée sans propriété `current`, donc `undefined`, donc jamais `null`. Et
 * le test qui la « couvrait » — dans CE fichier — comparait deux positions de
 * chaîne : il serait resté vert si la condition avait dit `=== 'bleu'`.
 *
 * Trois affirmations concordantes — code, commit, test — et zéro exécution.
 *
 * La parade est maintenant dans `refMesurable.ts`, sortie du worklet pour
 * qu'un test puisse l'APPELER : `refMesurable.test.ts` l'éprouve avec les
 * valeurs que Reanimated rend réellement (`null`, `-1`, `NaN`, un vrai tag).
 * Ce fichier-ci garde son rôle plus faible et le dit : vérifier que chaque
 * appelant écrit un `ref={…}`.
 */

import fs from 'fs';
import path from 'path';

const RACINE = path.join(__dirname, '..', '..', '..');

/** Parcourt `src/` et `app/` à la recherche des fichiers .ts/.tsx. */
function fichiersSources(dir: string, acc: string[] = []): string[] {
  for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entree.name);
    if (entree.isDirectory()) {
      if (entree.name === 'node_modules' || entree.name === '__tests__') continue;
      fichiersSources(p, acc);
    } else if (/\.tsx?$/.test(entree.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const SOURCES = [...fichiersSources(RACINE), ...fichiersSources(path.join(RACINE, '..', 'app'))];

/** Les fichiers qui APPELLENT le hook (et non ceux qui le définissent). */
const APPELANTS = SOURCES.filter((f) => {
  const src = fs.readFileSync(f, 'utf8');
  if (f.endsWith('useFirstViewport.ts')) return false;
  return /useFirstViewport\s*\(/.test(src);
});

describe('useFirstViewport — le ref doit être attaché par tout appelant', () => {
  it('il y a bien des appelants à contrôler (la garde ne doit pas être vide)', () => {
    // Une garde qui ne trouve rien passe toujours. On fige donc le fait qu'elle
    // a du travail : si un jour la liste tombe à zéro, c'est que le chemin de
    // recherche a cassé, pas que le défaut a disparu.
    expect(APPELANTS.length).toBeGreaterThan(0);
  });

  /**
   * CE QUE CETTE VÉRIFICATION ATTRAPE, ET CE QU'ELLE LAISSE PASSER.
   *
   * Elle attrape le cas le plus grossier — armer le hook sans écrire un seul
   * `ref=` dans le fichier. C'est ce qu'était `SectionBande`.
   *
   * Elle NE VOIT PAS l'attachement CONDITIONNEL : un `ref={fv.ref}` posé dans
   * une branche qui ne se rend pas la satisfait. Ce cas existait aussi —
   * `FounderGaugeCard` n'attachait son ref que si le compteur de fondateurs
   * était lisible — et c'est la garde à l'exécution, dans `useFirstViewport`,
   * qui le couvre. Le dire ici plutôt que de laisser croire que cette liste
   * suffit.
   */
  it.each(APPELANTS.map((f) => [path.relative(RACINE, f), f]))(
    '%s attache un ref quelque part',
    (_nom, fichier) => {
      const src = fs.readFileSync(fichier as string, 'utf8');
      expect(src).toMatch(/\bref=\{/);
    }
  );

  /**
   * LE POINT PRÉCIS QUI A CRASHÉ. `SectionBande` peut rendre `null` ; il ne
   * doit alors pas avoir armé le hook. On vérifie que la condition de forme
   * entre bien dans l'argument.
   */
  it('SectionBande n’arme le hook que lorsque la bande sera rendue', () => {
    const src = fs.readFileSync(
      path.join(RACINE, 'components', 'telemetry', 'SectionBande.tsx'),
      'utf8'
    );
    expect(src).toMatch(/useFirstViewport\(\s*!reduce\s*&&\s*forme === 'bande'\s*\)/);
  });

  /**
   * LA PARADE GÉNÉRIQUE A DÉMÉNAGÉ, ET CE TEST NE PRÉTEND PLUS LA PROUVER.
   *
   * Il vivait ici et comparait `indexOf('ref.current === null')` à
   * `indexOf('measure(ref)')` — un test qui ne pouvait pas échouer sur une
   * condition FAUSSE, seulement sur une condition absente. Elle était fausse.
   *
   * La décision est maintenant une fonction pure, et `refMesurable.test.ts`
   * l'APPELLE avec `null`, `-1`, `NaN` et un vrai tag. On ne vérifie plus ici
   * que le point de raccord, ce qui est tout ce qu'un test lexical sait faire.
   */
  it('la parade générique est éprouvée ailleurs, en l’exécutant', () => {
    const suite = fs.readFileSync(path.join(__dirname, 'refMesurable.test.ts'), 'utf8');
    expect(suite).toMatch(/import \{ tagMesurable \} from '\.\.\/refMesurable'/);
    expect(suite).toMatch(/expect\(tagMesurable\(null\)\)\.toBe\(false\)/);
  });
});
