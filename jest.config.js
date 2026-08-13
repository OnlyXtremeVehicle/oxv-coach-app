/**
 * DEUX PROJETS : la logique pure, et les ÉCRANS.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER A CHANGÉ
 * ===========================================================================
 *
 * Il portait ceci, et c'était faux :
 *
 *     - composants React Native (testés manuellement en build dev)
 *
 * La nuit du 13/08/2026, l'application est morte à l'ouverture de l'écran Data,
 * dans un build qui avait passé toutes les portes — tsc 0, lint 0, 3 078 tests
 * verts. Le « test manuel en build dev » n'avait rien vu, et ne pouvait rien
 * voir : le plantage se produisait 120 ms après le premier rendu, sur le fil UI,
 * dans un `measure()` que rien de ce dépôt n'exécutait jamais.
 *
 * La cause racine était ici, sur une ligne, et elle était invisible :
 *
 *     testMatch: ['** /__tests__/** /*.test.ts']
 *
 * Micromatch exige que le chemin FINISSE par `.test.ts`. Un fichier `.test.tsx`
 * ne finit pas par `.test.ts` : il n'était pas ignoré, il n'était pas CHERCHÉ.
 * 148 fichiers `.tsx` dans `app/`, zéro test de composant, et jest n'annonce
 * jamais les fichiers qu'il n'a pas cherchés.
 *
 * ===========================================================================
 * CE QUE `projects` PRÉSERVE, ET POURQUOI ON NE FUSIONNE PAS
 * ===========================================================================
 *
 * Les deux mondes ne peuvent pas partager une configuration :
 *
 *   - la logique pure tourne en `testEnvironment: 'node'` avec ts-jest, et
 *     beaucoup de ses gardes lisent le disque avec `fs` ;
 *   - les écrans exigent l'environnement React Native, le transformeur babel du
 *     projet, et les faux natifs d'Expo.
 *
 * Jest isole totalement les projets : transform, environnement et resolver ne se
 * croisent jamais. Les deux `testMatch` sont disjoints PAR CONSTRUCTION —
 * `.test.ts` d'un côté, `.test.tsx` de l'autre — donc aucune suite ne peut
 * tomber dans les deux, ni changer de monde par accident.
 *
 * `collectCoverageFrom` et `coverageThreshold` RESTENT à la racine : jest les
 * place dans la configuration globale, et les descendre dans un projet les
 * rendrait silencieusement inertes. Le seuil de 70 % existerait encore dans le
 * fichier sans plus jamais rien refuser — le motif même que ce dépôt combat.
 */

const presetExpo = require('jest-expo/jest-preset');

/** Chemins jamais explorés, quel que soit le projet. */
const IGNORES = [
  '/node_modules/',
  // Copies éphémères créées par les agents en arrière-plan : sans cela, jest
  // exécute les mêmes suites en double.
  '/\\.claude/worktrees/',
  // `archive/` : l'arbre V1 y dort depuis le lot J5. Ni construit, ni typé, ni
  // testé — le ramasser ferait échouer des suites sur du code retiré.
  '/archive/',
];

/**
 * LA LOGIQUE PURE — configuration historique, reprise à l'identique.
 *
 * Périmètre : parser UBX, utilitaires (géo, validation, détection de tours),
 * machine d'état, helpers métier, services et gardes de dépôt.
 */
const PROJET_LOGIQUE = {
  displayName: 'logique',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: IGNORES,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

/**
 * LES ÉCRANS — ce qui manquait.
 *
 * Les fichiers vivent dans `src/__tests__/ecrans/`, JAMAIS sous `app/` : le
 * `require.context` d'expo-router capture TOUT `.tsx` sous `app/`, et un fichier
 * de test y deviendrait une ROUTE dans le bundle de production. La garde
 * `orphelinsApp2` échouerait de surcroît, chaque `.tsx` de `app/(app2)` devant
 * avoir un lien entrant.
 */
const PROJET_ECRANS = {
  displayName: 'écrans',
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: IGNORES,
  /**
   * Les worktrees éphémères contiennent un `node_modules/react-native` COMPLET,
   * avec son `package.json`. Le haste map du preset RN parcourrait alors un
   * second arbre React Native entier et signalerait des collisions de noms.
   */
  modulePathIgnorePatterns: ['/\\.claude/worktrees/'],
  setupFiles: ['<rootDir>/jest/setup.ecrans.js'],
  setupFilesAfterEnv: ['<rootDir>/jest/setupAfterEnv.ecrans.js'],
  /**
   * ATTENTION — CETTE LISTE ÉCRASE CELLE DU PRESET, ELLE NE LA COMPLÈTE PAS.
   *
   * `jest-config` fusionne `moduleNameMapper`, `transform` et `setupFiles`,
   * mais applique `{...preset, ...options}` pour le reste. Écrire ici la seule
   * ligne `@shopify` en croyant AJOUTER supprimerait toute la liste d'Expo et
   * casserait expo-router, expo-* et reanimated d'un coup.
   *
   * On recopie donc la liste du preset, et on y ajoute :
   *   - `@shopify` : Skia et FlashList sont en ESM (`main: lib/module/...`) et
   *     ne sont pas des paquets Expo — rien dans la doc ne le mentionne ;
   *   - `react-native-worklets/plugin` : `babel.config.js` charge CE greffon
   *     (et non `react-native-reanimated/plugin`, que le preset exclut déjà).
   *     Il tombe sous le préfixe `react-native` de la liste, donc un babel qui
   *     le charge lui-même le transformerait — greffon réentrant.
   */
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|@shopify))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/react-native-worklets/plugin/',
  ],
  moduleNameMapper: {
    ...presetExpo.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

module.exports = {
  projects: [PROJET_LOGIQUE, PROJET_ECRANS],

  /**
   * GLOBAL, et cela compte. Descendre ces deux clés dans un projet les rendrait
   * inertes sans le dire.
   *
   * Le périmètre de couverture reste celui de la logique pure : un test d'écran
   * passe par babel, donc SANS typage, et ne prouve rien sur les types. `tsc
   * --noEmit` demeure la seule garde de types sur les 148 `.tsx`.
   */
  collectCoverageFrom: [
    'src/ubx/**/*.ts',
    'src/utils/**/*.ts',
    'src/types/state.ts',
    'src/types/domain.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      statements: 70,
      branches: 60,
      functions: 70,
    },
  },
};
