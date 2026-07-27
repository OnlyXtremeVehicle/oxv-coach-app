# T0 — Migration Expo SDK 51 → 55

**Branche `migration/sdk-55`** · ouverte le 27 juillet 2026 · **document tenu au fil du lot**

Point de retour : étiquette `pre-migration-sdk55` (`2788a4e`), poussée.

> **Ce document est en cours.** Une étape non traitée est écrite comme telle,
> jamais comme un succès implicite. Ce qui n'a pas pu être vérifié porte la
> mention de ce qui manquerait pour le vérifier.

---

## État de départ, constaté

| | Départ | Cible | Saut |
|---|---|---|---|
| Expo SDK | **51.0.28** | 55.0.28 | **4 majeures** |
| React Native | 0.74.5 | 0.83 | 9 mineures |
| React | 18.2.0 | 19.2 | 1 majeure |
| Skia | 1.2.3 | 2.8.x | 1 majeure |
| Reanimated | 3.10.1 | 4.x | 1 majeure |
| Architecture | **ancienne** — `newArchEnabled` absent de `app.json`, à la racine comme sous `ios` et `android` | nouvelle | bascule complète |

Autres faits relevés dans `app.json` avant toute modification : `updates` **absent**,
`runtimeVersion` **absent**, `associatedDomains` **absent**, `UIBackgroundModes`
**absent**. Huit plugins déclarés : `expo-router`, `expo-apple-authentication`,
`react-native-ble-plx`, `expo-image-picker`, `expo-camera`, `react-native-health`,
`expo-secure-store`, `expo-notifications`.

Deux paquets enveloppent la chaîne de build et devront suivre :
`@sentry/react-native ~5.24.3` (il fournit la configuration Metro via
`getSentryExpoConfig`) et `typescript ~5.3.3`.

---

## Étape 1 — Nettoyage : le troisième moteur de rendu · **FAITE** (`d4222f3`)

### Ce qui est parti

`three` (29 Mo), `@react-three/fiber`, `expo-gl`, `@types/three`.
`npm install` a retiré **18 paquets** au total, transitifs compris.

Fichiers supprimés — **1 065 lignes**, 26 ajoutées :

| Fichier | Lignes | Motif |
|---|---|---|
| `src/circuit/CircuitTrace.tsx` | 393 | seul importateur de `three` et `@react-three/fiber` |
| `src/circuit/layers.ts` | 245 | aucun autre consommateur |
| `src/circuit/CircuitTraceHero.tsx` | 120 | enveloppe de `CircuitTrace` |
| `app/(app)/debug-circuit.tsx` | 81 | son unique objet était de prévisualiser ce tracé |
| `src/circuit/cornerFacts.ts` | 47 | aucun autre consommateur |
| `src/circuit/__tests__/layers.test.ts` · `cornerFacts.test.ts` | — | tests des modules supprimés |

`circuitGenerator`, `circuitCorners`, `hauteSaintonge` et `sessionInsights` ont
d'autres consommateurs, vérifiés un par un : **ils restent**.

### La porte du plan, et ce qu'elle ne voyait pas

Le plan imposait de vérifier avant de retirer, et de s'arrêter si un import
apparaissait dans un arbre actif. **Aucun n'y apparaissait** : `(app2)` et
`(coach)` n'importaient rien de cette chaîne.

Le contrôle d'imports ne pouvait cependant pas voir ceci : **l'arbre pilote actif
atteignait la 3D par une route.** `app/(app2)/club/territoire.tsx:629` pousse vers
`/(app)/creer-trace`, écran de l'arbre gelé dont la prévisualisation est
fonctionnellement porteuse — on prévisualise, puis on enregistre. Supprimer le
rendu aurait cassé un flux vivant.

Un piège de nommage a failli fausser la lecture : `(app2)` définit localement un
composant `CircuitTraceFallback`, sans aucun rapport avec `CircuitTrace`.

### La substitution retenue

`creer-trace` et `circuit/[id]` passent à **`TraceCircuit`**, le rendu Skia maison,
déjà monté à quatre endroits de l'arbre actif — `bilan/[sessionId]`,
`data/session/[id]`, `rec/placement`, `dev-galerie` — et sur lequel T1 va bâtir.

La substitution est directe : `Circuit.centerline` est un `Point[]`, exactement la
forme attendue par le composant. Sur `circuit/[id]`, l'écran retient désormais les
**points** de la centerline au lieu d'un booléen — l'ancien composant les
rechargeait lui-même par identifiant. Sans géométrie réelle en base, la section
disparaît entièrement : aucune silhouette inventée.

**Écart assumé au plan.** Le plan dit « aucun écran n'est modifié : T0 est une
migration, pas une refonte ». Trois écrans ont été touchés, et c'est délibéré :
l'étape 1 retire un moteur de rendu, ce qui ne peut pas laisser intacts les
écrans qui l'affichaient. L'alternative — supprimer les tracés — aurait dégradé un
flux atteignable depuis l'arbre actif.

### Portes passées

`tsc` 0 · `jest` 1 851 passés sur 141 suites (deux de moins : celles des modules
supprimés) · doctrine 0 · accessibilité 0 · prettier 0.

### Ce qui reste à prouver

Le **gain de poids réel du binaire** ne sera mesuré qu'au premier build. Les 29 Mo
sont la taille du paquet npm, pas celle qu'il ajoutait à l'application.

---

## Étape 2 — 51 → 52 → 53 → 54 → 55 · **EN COURS**

Une majeure à la fois, comme le plan l'impose.

### Palier 51 → 52 · **FAIT**

`npm install expo@^52.0.0` puis `npx expo install --fix`. Les deux rendent 0.
**43 lignes de `package.json` changées.**

| | Avant | Après |
|---|---|---|
| expo | 51.0.28 | **52.0.49** |
| react | 18.2.0 | 18.3.1 |
| react-native | 0.74.5 | 0.76.9 |
| **expo-router** | 3.5.23 | **4.0.22** — une majeure au passage |
| @sentry/react-native | 5.24.3 | 6.10.0 |
| react-native-gesture-handler | 2.16.1 | 2.20.2 |
| react-native-svg | 15.2.0 | 15.8.0 |
| Reanimated | 3.10.1 | **3.16.1** — reste en v3, voulu |
| Skia | 1.2.3 | **1.5.0** — reste en v1, voulu |
| react-native-mmkv | 2.12.2 | inchangé — hors gestion Expo |

### Ce que `expo-doctor` a révélé, et ce qui en a été fait

**Une dépendance morte, supprimée.** `react-native-keyboard-aware-scroll-view` :
non maintenue, non testée sur la nouvelle architecture, et **zéro usage** dans
`src/` comme dans `app/` — elle ne survivait que dans des worktrees périmés et
dans `package.json.v1`. Retirée : 2 paquets de moins.

**Trois versions désalignées, forcées** — `expo install` les listait sans les
écrire : `@types/react` 18.2.79 → 18.3.12, `eslint-config-expo` 7.1.2 → 8.0.1,
`@react-navigation/native` 6.1.18 → **7.3.14**. Ce dernier est une majeure, mais
**aucun fichier n'importe `@react-navigation` directement** — c'est `expo-router`
qui le consomme.

**Un `catch` délibérément vide, dans un fichier protégé.** `eslint-config-expo` 8
tire typescript-eslint v8, où `caughtErrors` bascule de `none` à `all` :
`src/services/captureSessionService.ts:597` remonte alors en erreur. Le code est
juste — le binding est volontairement ignoré, la file fichier étant le filet — et
le fichier est sous règle cardinale. `caughtErrors: "none"` a été posé dans
`.eslintrc.json`, ce qui **restaure exactement** la strictesse d'avant la
migration : T0 est une migration, pas une passe de durcissement. L'option plus
stricte demande votre arbitrage — voir `docs/DETTE.md`, D-6.

### Les deux constats qui restent au 52

**`react-native-health` est le candidat blocage de l'étape 3.** Il est signalé
« non testé sur la nouvelle architecture », et il est **la source unique** du
second échec de `expo-doctor` : il épingle `@expo/config-plugins@^7.2.2` là où le
SDK 52 attend `~9.0.0`. **1.19.0 est sa version la plus récente** — aucune mise à
jour ne réglera cela.

**`expo-av` est déclaré non maintenu.** C'est l'objet de l'étape 7.

### Portes du palier 52

`tsc` **0** · `jest` **1 851 passés**, 141 suites · `eslint` **0 erreur**,
5 avertissements · doctrine 0 · accessibilité 0 · `expo-doctor` **15/18**.

**Ce que ces portes ne prouvent pas.** `expo-router` vient de sauter une majeure
et `tsc` rend zéro — mais le dépôt casse volontairement le typage des routes par
des `as never`. **Le compilateur ne valide donc aucune cible de navigation.** Et
`jest.config.js` tourne en `ts-jest`, environnement `node`, ne matchant que
`*.test.ts` : **la suite ne monte aucun composant React Native.** Les 1 851 tests
valident de la logique pure ; ils ne sont pas un filet pour cette migration.

### Paliers 53, 54, 55 · non commencés

---

## Étape 3 — Nouvelle architecture · non commencée

## Étape 4 — Reanimated 3 → 4 · non commencée

**Le piège est confirmé et localisé.** `babel.config.js` contient aujourd'hui,
en son unique entrée de `plugins` :

```js
plugins: ['react-native-reanimated/plugin'],
```

En version 4 ce plugin devient `react-native-worklets/plugin`. **L'ancien nom ne
produit aucune erreur** — les animations cessent simplement de fonctionner.

## Étape 5 — MMKV 2 → 3 · non commencée

## Étape 6 — Skia 1.2 → 2.8 · non commencée

## Étape 7 — `expo-av` → `expo-audio` · non commencée

## Étape 8 — `expo-updates` · non commencée

---

## Hors périmètre, assumé

`react-native-svg` — la plus grande surface du dépôt. Lot séparé.

---

## Ce qui ne pourra pas être vérifié ici

**Le lancement sur appareil réel.** Le plan l'exige à chaque fin de lot, et un
simulateur ne révèle ni la performance, ni le Bluetooth, ni HealthKit, ni la
lisibilité au soleil. Cette vérification passe par un build EAS et un appareil :
elle n'appartient pas à ce poste.

**Le test visuel d'une animation par famille d'usage Reanimated** en dépend
directement : c'est le seul moyen de détecter le piège du plugin, qui ne casse
rien à la compilation.
