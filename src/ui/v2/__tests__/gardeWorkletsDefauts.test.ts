/**
 * GARDE DE COMPILATION — aucun worklet ne lit sa fermeture avant de l'ouvrir.
 *
 * ===========================================================================
 * CE QUI EST ARRIVÉ
 * ===========================================================================
 *
 * Le build iOS n°36 (03/08/2026) s'installait, affichait le splash, et se
 * fermait au bout de ~600 ms. Pas d'écran rouge : en release il n'y en a pas.
 * Quatre builds avaient échoué avant lui pour quatre raisons différentes ;
 * celui-là compilait, se signait, s'installait — et mourait à l'exécution.
 *
 * Le rapport de plantage de l'appareil donnait la forme :
 *
 *     hermesvm    throwPendingError()
 *     RNWorklets  WorkletRuntime::runSync<>()
 *     RNWorklets  UIScheduler::triggerUI()
 *     libc++abi   __cxa_throw → std::terminate → abort()
 *
 * et Sentry le nom :
 *
 *     ReferenceError: Property 'PULL_SWEEP_DEG' doesn't exist
 *       at pullAngle (motionMath.ts)
 *       at PullToRefreshDial.tsx
 *       at styleUpdater (useAnimatedStyle)
 *
 * ===========================================================================
 * LA CAUSE, RELEVÉE DANS LA SORTIE DU COMPILATEUR
 * ===========================================================================
 *
 * Le code fautif :
 *
 *     export function pullAngle(d, t, sweep = PULL_SWEEP_DEG) { 'worklet'; … }
 *
 * Ce que le greffon `react-native-worklets` en fait — vérifié en compilant le
 * fichier, pas déduit :
 *
 *     function pullAngle(d, t, sweep = PULL_SWEEP_DEG) {
 *       const { PULL_SWEEP_DEG } = this.__closure;   // ← trop tard
 *       …
 *     }
 *
 * Le greffon CAPTURE bien la constante. Mais il ouvre la fermeture en tête du
 * CORPS, alors qu'une valeur par défaut s'évalue AVANT, dans la portée des
 * paramètres. Sur le runtime UI il n'existe aucune portée de module : le nom
 * n'est nulle part. Hermes lève, l'erreur remonte en exception C++ que personne
 * n'attrape, le processus meurt.
 *
 * La même constante lue DANS le corps fonctionne — la déstructuration a eu lieu.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE VÉRIFIE, ET COMMENT
 * ===========================================================================
 *
 * Elle ne relit pas la source à la recherche d'un motif : elle **compile**
 * chaque fichier avec la configuration Babel réelle du projet — la même que
 * Metro — puis lit le corps que le greffon destine au runtime UI, et refuse
 * toute valeur par défaut de paramètre qui lit un nom de la fermeture.
 *
 * SÉLECTION DES FICHIERS. Un worklet ne peut naître que de deux façons : une
 * directive `'worklet'`, ou un rappel passé à une API que le greffon
 * workletise d'office. Les noms de ces API sont LUS dans le greffon installé,
 * pas recopiés ici — le jour où la bibliothèque en ajoute une, la garde suit.
 * Tout fichier dont la source contient l'un de ces jetons est compilé.
 *
 * ===========================================================================
 * ELLE EST ARMÉE
 * ===========================================================================
 *
 * Deux fixtures écrites sur disque à chaque exécution :
 *   - une fautive, que l'analyseur DOIT signaler,
 *   - une saine, qu'il DOIT laisser passer.
 *
 * Sans le second, une garde cassée qui signale tout paraîtrait vigilante.
 * Sans le premier, une garde cassée qui ne signale rien paraîtrait verte.
 *
 * ===========================================================================
 * CE QU'ELLE NE PROUVE PAS
 * ===========================================================================
 *
 * Que les worklets sont corrects. Elle ne couvre QUE la fenêtre entre l'entrée
 * dans la fonction et l'ouverture de la fermeture. Un worklet peut encore
 * appeler une fonction non workletisée, ou toucher un objet non sérialisable :
 * ces fautes-là ont d'autres symptômes et ne sont pas de son ressort.
 */

// `require` délibéré : @babel/core et @babel/parser n'ont pas de déclarations de
// types dans ce projet, et un `import` échouerait au typage. La règle visée est
// bien `no-require-imports` — pas `no-var-requires`, qui ne s'applique qu'aux
// `var x = require(...)` et laisserait donc ces trois lignes signalées.
/* eslint-disable @typescript-eslint/no-require-imports */

import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const babel = require('@babel/core');
const parser = require('@babel/parser');

// src/ui/v2/__tests__ → quatre crans jusqu'à la racine (les autres gardes du
// dépôt vivent un niveau plus haut et n'en comptent que trois).
const RACINE = join(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Ce que le runtime UI fournit vraiment. Tout le reste doit venir de la
// fermeture — et la fermeture n'est pas ouverte quand un défaut s'évalue.
// ---------------------------------------------------------------------------
const GLOBAUX = new Set([
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'Symbol',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'Proxy',
  'Reflect',
  'Function',
  'Intl',
  'BigInt',
  'isNaN',
  'isFinite',
  'parseInt',
  'parseFloat',
  'Infinity',
  'NaN',
  'undefined',
  'globalThis',
  'global',
  'console',
  'performance',
  'encodeURIComponent',
  'decodeURIComponent',
  'setTimeout',
  'clearTimeout',
  'setImmediate',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  '_WORKLET',
  '__DEV__',
  '_log',
  '_toString',
]);

// ---------------------------------------------------------------------------
// Les API que le greffon workletise d'office — LUES dans le greffon installé.
// ---------------------------------------------------------------------------
function nomsDuSet(source: string, variable: string): string[] {
  // Le nom apparaît plusieurs fois : d'abord dans la ligne `exports.a = exports.b
  // = void 0;`, puis à l'affectation réelle. On ne retient que l'occurrence
  // immédiatement suivie de `new Set([` — sinon on récolte le Set du voisin.
  const motif = new RegExp(
    `${variable}\\s*=\\s*(?:/\\*[^*]*\\*/\\s*)?new Set\\(\\[([\\s\\S]*?)\\]\\)`
  );
  const trouve = motif.exec(source);
  if (!trouve) return [];
  return [...trouve[1].matchAll(/"([A-Za-z_$][\w$]*)"/g)].map((m) => m[1]);
}

function apiWorkletisantes(): string[] {
  const greffon = readFileSync(
    join(RACINE, 'node_modules', 'react-native-worklets', 'plugin', 'index.js'),
    'utf8'
  );
  const noms = new Set<string>();
  for (const variable of [
    'reanimatedFunctionHooks',
    'reanimatedObjectHooks',
    'gestureHandlerBuilderMethods',
    'gestureHandlerObjectHooks',
    'gestureHandlerGestureObjects',
  ]) {
    for (const n of nomsDuSet(greffon, variable)) noms.add(n);
  }
  return [...noms];
}

// ---------------------------------------------------------------------------
// Analyse d'un fichier : compile, lit les corps émis, cherche la faute.
// ---------------------------------------------------------------------------
export interface Constat {
  fichier: string;
  worklet: string;
  identifiant: string;
  genre: 'fermeture' | 'inconnu';
}

/** Tous les identifiants LUS dans une expression (hors clés et propriétés). */
function identifiantsLus(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return acc;
  const n = node as Record<string, unknown> & { type?: string };

  if (n.type === 'Identifier' && typeof n.name === 'string') {
    acc.add(n.name);
    return acc;
  }
  if (n.type === 'MemberExpression') {
    identifiantsLus(n.object, acc);
    if (n.computed) identifiantsLus(n.property, acc);
    return acc;
  }
  if (n.type === 'ObjectProperty' || n.type === 'ObjectMethod') {
    if (n.computed) identifiantsLus(n.key, acc);
    identifiantsLus(n.value, acc);
    return acc;
  }

  for (const clef of Object.keys(n)) {
    if (clef === 'loc' || clef === 'start' || clef === 'end' || clef === 'type') continue;
    const v = n[clef];
    if (Array.isArray(v)) v.forEach((e) => identifiantsLus(e, acc));
    else if (v && typeof v === 'object') identifiantsLus(v, acc);
  }
  return acc;
}

/** Les noms déstructurés depuis `this.__closure`, en tête de corps. */
function nomsDeLaFermeture(corps: { body?: unknown[] }): Set<string> {
  const noms = new Set<string>();
  for (const st of (corps.body ?? []) as Record<string, unknown>[]) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations as Record<string, unknown>[]) {
      const init = d.init as Record<string, unknown> | null;
      const estFermeture =
        !!init &&
        init.type === 'MemberExpression' &&
        (init.object as Record<string, unknown>)?.type === 'ThisExpression' &&
        ((init.property as Record<string, unknown>)?.name as string) === '__closure';
      if (!estFermeture) continue;
      const id = d.id as Record<string, unknown>;
      if (id.type === 'ObjectPattern') {
        for (const p of id.properties as Record<string, unknown>[]) {
          const cible = (p.type === 'RestElement' ? p.argument : p.value) as Record<
            string,
            unknown
          >;
          if (cible?.type === 'Identifier') noms.add(cible.name as string);
        }
      } else if (id.type === 'Identifier') {
        noms.add(id.name as string);
      }
    }
  }
  return noms;
}

/** Tous les couples (motif lié, expression par défaut) d'une liste de paramètres. */
function defautsDesParametres(params: Record<string, unknown>[]): {
  lies: Set<string>;
  defauts: unknown[];
} {
  const lies = new Set<string>();
  const defauts: unknown[] = [];

  const parcourir = (n: Record<string, unknown> | null | undefined): void => {
    if (!n) return;
    switch (n.type) {
      case 'Identifier':
        lies.add(n.name as string);
        return;
      case 'AssignmentPattern':
        // Le défaut d'abord : il s'évalue avec ce qui est déjà lié à sa gauche.
        defauts.push(n.right);
        parcourir(n.left as Record<string, unknown>);
        return;
      case 'ObjectPattern':
        for (const p of n.properties as Record<string, unknown>[]) {
          parcourir((p.type === 'RestElement' ? p.argument : p.value) as Record<string, unknown>);
        }
        return;
      case 'ArrayPattern':
        for (const e of n.elements as Record<string, unknown>[]) parcourir(e);
        return;
      case 'RestElement':
        parcourir(n.argument as Record<string, unknown>);
        return;
      default:
        return;
    }
  };

  for (const p of params) parcourir(p);
  return { lies, defauts };
}

/**
 * Les greffons Babel du projet, LUS dans `babel.config.js` — pas recopiés.
 * Le jour où l'un change de nom, la garde suit sans qu'on y pense.
 *
 * On n'ajoute autour que la syntaxe TypeScript. Le préréglage complet
 * (`babel-preset-expo`) fait la même analyse en 24 s au lieu de 6,6 s : il
 * transforme les modules, les JSX et le reste, dont RIEN n'entre dans la
 * décision du greffon worklets — celle-ci ne tient qu'à la directive
 * `'worklet'` et au nom de la fonction appelée, que ces transformations
 * préservent. Vérifié le 03/08/2026 : les deux chaînes signalent les mêmes
 * fautes, y compris sur un binding importé (le seul cas où la transformation
 * des modules aurait pu changer la forme de la fermeture). Une garde lente
 * finit désactivée, et une garde désactivée ne garde rien.
 */
function greffonsDuProjet(): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const fabrique = require(join(RACINE, 'babel.config.js'));
  const config = fabrique({ cache: () => undefined, env: () => 'test' });
  return (config.plugins ?? []) as unknown[];
}

const GREFFONS = greffonsDuProjet();

export function analyser(fichier: string): Constat[] {
  const code: string = babel.transformFileSync(fichier, {
    cwd: RACINE,
    root: RACINE,
    configFile: false,
    babelrc: false,
    presets: [
      ['@babel/preset-typescript', { isTSX: fichier.endsWith('.tsx'), allExtensions: true }],
    ],
    plugins: GREFFONS,
    caller: { name: 'metro', platform: 'ios', isDev: false, bundler: 'metro' },
  }).code;

  const constats: Constat[] = [];

  for (const m of code.matchAll(/code:\s*("(?:[^"\\]|\\.)*")/g)) {
    let fn: Record<string, unknown>;
    try {
      const ast = parser.parse('(' + JSON.parse(m[1]) + ')', { sourceType: 'script' });
      fn = ast.program.body[0].expression;
    } catch {
      continue; // pas un corps de fonction : ce `code:` appartient à autre chose
    }
    if (
      !fn ||
      (fn.type !== 'FunctionExpression' && fn.type !== 'ArrowFunctionExpression') ||
      !Array.isArray(fn.params)
    ) {
      continue;
    }

    const nom = ((fn.id as Record<string, unknown>)?.name as string) ?? '(anonyme)';
    const fermeture = nomsDeLaFermeture(fn.body as { body?: unknown[] });
    const { lies, defauts } = defautsDesParametres(fn.params as Record<string, unknown>[]);

    for (const defaut of defauts) {
      for (const id of identifiantsLus(defaut)) {
        if (fermeture.has(id)) {
          constats.push({ fichier, worklet: nom, identifiant: id, genre: 'fermeture' });
        } else if (!GLOBAUX.has(id) && !lies.has(id)) {
          constats.push({ fichier, worklet: nom, identifiant: id, genre: 'inconnu' });
        }
      }
    }
  }

  return constats;
}

// ---------------------------------------------------------------------------
// Énumération des fichiers à inspecter.
// ---------------------------------------------------------------------------
function sourcesDe(dossier: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (['node_modules', '.git', 'archive', '.claude', 'ios', 'android'].includes(nom)) continue;
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) sourcesDe(p, acc);
    else if (/\.tsx?$/.test(nom) && !/\.d\.ts$/.test(nom)) acc.push(p);
  }
  return acc;
}

// ---------------------------------------------------------------------------

describe('worklets — aucune valeur par défaut ne lit la fermeture', () => {
  const api = apiWorkletisantes();

  it('la liste des API workletisantes a bien été lue dans le greffon', () => {
    // Si la bibliothèque change de forme, cette garde doit tomber ICI —
    // bruyamment — plutôt que de sélectionner zéro fichier et paraître verte.
    expect(api.length).toBeGreaterThan(15);
    expect(api).toContain('useAnimatedStyle');
    expect(api).toContain('runOnUI');
    expect(api).toContain('onUpdate');
  });

  const jetons = new RegExp(`worklet|\\b(?:${api.join('|')})\\b`, 'i');
  const candidats = [...sourcesDe(join(RACINE, 'src')), ...sourcesDe(join(RACINE, 'app'))].filter(
    (f) => !/[\\/]__tests__[\\/]/.test(f) && jetons.test(readFileSync(f, 'utf8'))
  );

  it('des fichiers sont bien inspectés', () => {
    // Un filtre trop zélé rendrait la suite verte sans rien avoir regardé.
    expect(candidats.length).toBeGreaterThan(20);
  });

  it('aucun worklet du dépôt ne lit sa fermeture dans un défaut', () => {
    const constats = candidats.flatMap((f) => analyser(f));
    const lisible = constats.map(
      (c) =>
        `${c.fichier.replace(RACINE, '').replace(/\\/g, '/')} :: ${c.worklet} ` +
        `-> ${c.identifiant} (${c.genre})`
    );
    expect(lisible).toEqual([]);
  });
});

describe('la garde est armée', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'oxv-garde-worklets-'));

  it('elle SIGNALE un défaut qui lit une constante de module', () => {
    const f = join(dossier, 'fautif.ts');
    writeFileSync(
      f,
      [
        'const SEUIL = 270;',
        'export function fautif(d: number, sweep: number = SEUIL): number {',
        "  'worklet';",
        '  return d * sweep;',
        '}',
      ].join('\n')
    );
    const constats = analyser(f);
    expect(constats).toHaveLength(1);
    expect(constats[0].identifiant).toBe('SEUIL');
    expect(constats[0].genre).toBe('fermeture');
  });

  it('elle SIGNALE aussi un worklet inline passé à useAnimatedStyle', () => {
    const f = join(dossier, 'inline.ts');
    writeFileSync(
      f,
      [
        'const SEUIL = 12;',
        'declare function useAnimatedStyle(f: unknown): unknown;',
        'export function useTruc() {',
        '  return useAnimatedStyle((k: number = SEUIL) => ({ opacity: k }));',
        '}',
      ].join('\n')
    );
    expect(analyser(f).map((c) => c.identifiant)).toEqual(['SEUIL']);
  });

  it('elle LAISSE PASSER le même défaut résolu dans le corps', () => {
    // Sans ce cas, une garde cassée qui refuse tout aurait l'air vigilante.
    const f = join(dossier, 'sain.ts');
    writeFileSync(
      f,
      [
        'const SEUIL = 270;',
        'export function sain(d: number, sweep?: number): number {',
        "  'worklet';",
        '  const s = sweep ?? SEUIL;',
        '  return d * s;',
        '}',
      ].join('\n')
    );
    expect(analyser(f)).toEqual([]);
  });

  it('elle LAISSE PASSER un défaut littéral', () => {
    const f = join(dossier, 'litteral.ts');
    writeFileSync(
      f,
      [
        'export function litteral(d: number, k = 2, m = Math.PI): number {',
        "  'worklet';",
        '  return d * k * m;',
        '}',
      ].join('\n')
    );
    expect(analyser(f)).toEqual([]);
  });
});
