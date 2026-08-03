# T0 — Migration Expo SDK 51 → 55

**Branche `migration/sdk-55`** · ouverte le 27 juillet 2026 · **document tenu au fil du lot**

Point de retour : étiquette `pre-migration-sdk55` (`2788a4e`), poussée.

> **Ce document est en cours.** Une étape non traitée est écrite comme telle,
> jamais comme un succès implicite. Ce qui n'a pas pu être vérifié porte la
> mention de ce qui manquerait pour le vérifier.

---

## État de départ, constaté

|              | Départ                                                                                          | Cible    | Saut             |
| ------------ | ----------------------------------------------------------------------------------------------- | -------- | ---------------- |
| Expo SDK     | **51.0.28**                                                                                     | 55.0.28  | **4 majeures**   |
| React Native | 0.74.5                                                                                          | 0.83     | 9 mineures       |
| React        | 18.2.0                                                                                          | 19.2     | 1 majeure        |
| Skia         | 1.2.3                                                                                           | 2.8.x    | 1 majeure        |
| Reanimated   | 3.10.1                                                                                          | 4.x      | 1 majeure        |
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

| Fichier                                                        | Lignes | Motif                                               |
| -------------------------------------------------------------- | ------ | --------------------------------------------------- |
| `src/circuit/CircuitTrace.tsx`                                 | 393    | seul importateur de `three` et `@react-three/fiber` |
| `src/circuit/layers.ts`                                        | 245    | aucun autre consommateur                            |
| `src/circuit/CircuitTraceHero.tsx`                             | 120    | enveloppe de `CircuitTrace`                         |
| `app/(app)/debug-circuit.tsx`                                  | 81     | son unique objet était de prévisualiser ce tracé    |
| `src/circuit/cornerFacts.ts`                                   | 47     | aucun autre consommateur                            |
| `src/circuit/__tests__/layers.test.ts` · `cornerFacts.test.ts` | —      | tests des modules supprimés                         |

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

## Étape 2 — 51 → 52 → 53 → 54 → 55 · **FAIT**

> Ce titre a porté « EN COURS » jusqu'au 03/08/2026, alors que les paliers
> étaient franchis depuis des jours et que les étapes 4 à 8 de ce même
> document parlaient déjà du SDK 55. Un document qui se contredit sur son
> propre état est pire qu'un document absent : on le croit.

Une majeure à la fois, comme le plan l'impose.

### Palier 51 → 52 · **FAIT**

`npm install expo@^52.0.0` puis `npx expo install --fix`. Les deux rendent 0.
**43 lignes de `package.json` changées.**

|                              | Avant   | Après                               |
| ---------------------------- | ------- | ----------------------------------- |
| expo                         | 51.0.28 | **52.0.49**                         |
| react                        | 18.2.0  | 18.3.1                              |
| react-native                 | 0.74.5  | 0.76.9                              |
| **expo-router**              | 3.5.23  | **4.0.22** — une majeure au passage |
| @sentry/react-native         | 5.24.3  | 6.10.0                              |
| react-native-gesture-handler | 2.16.1  | 2.20.2                              |
| react-native-svg             | 15.2.0  | 15.8.0                              |
| Reanimated                   | 3.10.1  | **3.16.1** — reste en v3, voulu     |
| Skia                         | 1.2.3   | **1.5.0** — reste en v1, voulu      |
| react-native-mmkv            | 2.12.2  | inchangé — hors gestion Expo        |

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

### Palier 52 → 53 · **FAIT**, après un accident

C'est le palier de React 19. Il n'est pas passé du premier coup, et le détail
compte plus que le résultat.

#### L'accident : un dépôt à moitié migré, et vert

`npx expo install --fix` a rendu **1** sur un conflit de résolution npm autour de
`@react-native-community/datetimepicker`, dans la fenêtre où React passe de 18 à
19 et React Native de 0.76 à 0.79.

**L'état laissé est le vrai enseignement.** `package.json` déclarait le SDK 53
pendant que `node_modules` était resté au 52 :

|              | Demandé | Installé   |
| ------------ | ------- | ---------- |
| react        | 19.0.0  | **18.3.1** |
| react-native | 0.79.6  | **0.76.9** |
| expo-router  | 5.1.11  | **4.0.22** |

**Neuf paquets sur onze étaient en arrière.** Un `tsc` lancé dans cette fenêtre
aurait typé l'ancien arbre en croyant valider le nouveau, et rendu vert.

La confrontation explicite entre ce que `package.json` demande et ce que
`node_modules` porte devient donc une vérification obligatoire de chaque palier.

#### La remise en état

`npm install` seul échoue aussi : npm lit l'arbre existant, y trouve les versions
du 52, et n'arrive plus à en sortir. **`--legacy-peer-deps` a été écarté** — cette
option fait accepter une résolution que npm lui-même qualifie de potentiellement
cassée, ce qui sur quatre majeures avec du natif Bluetooth et HealthKit derrière
produirait un build vert et une application qui ne démarre pas.

Installation propre : `node_modules` et `package-lock.json` retirés — état dérivé,
verrou suivi par git, aucun dossier `patches/` — puis `npm install`. **1 173
paquets, zéro erreur, toutes les versions alignées.**

#### Un incident d'environnement, à connaître

`ENOSPC` en pleine installation : le disque C: était **plein à 100 %**, 216 Go
utilisés, zéro disponible. Ce n'est pas le projet — `node_modules` pèse 968 Mo.
Le cache npm (4,5 Go) a été vidé pour continuer. **Le disque reste à 99 %**, ce
qui est étroit pour une migration qui reconstruit l'arbre à chaque palier.

#### Quatre paquets ont bougé au-delà de leur épingle précédente

Effet de la régénération du verrou, tous dans leur plage semver :

|                            | Avant   | Après            |
| -------------------------- | ------- | ---------------- |
| @shopify/react-native-skia | 1.5.0   | **2.0.0-next.4** |
| react-native-maps          | 1.18.0  | 1.20.1           |
| react-native-svg           | 15.8.0  | 15.11.2          |
| react-native-webview       | 13.12.5 | 13.13.5          |

**Skia entre en v2 dès le SDK 53, et sur une préversion.** Le plan prévoyait cette
majeure à l'étape 6 : elle est déjà là. `react-native-ble-plx` n'a pas bougé — il
était déjà en 3.5.1.

#### Les cinq erreurs de typage, et ce qu'elles étaient vraiment

**TypeScript 5.3.3 ne comprenait plus le tsconfig du SDK.** `expo/tsconfig.base.json`
emploie `"module": "preserve"`, inconnu de la 5.3. Porté en **5.8.3**.

**React 19 a changé `useRef`.** `useRef<T>(null)` rend désormais
`RefObject<T | null>`. Quatre déclarations affirmaient `RefObject<View>` —
`HeroMorph.tsx:83` et trois signatures de `data/comparer.tsx`. Le type suit
maintenant le réel : la ref EST nulle avant montage.

**`expo-notifications` a scindé l'alerte, et cela touchait le Principe 3.**
Depuis la 0.29, `shouldShowAlert` est déprécié au profit de `shouldShowBanner` et
`shouldShowList`, tous deux **obligatoires**. Les trois suivent désormais le même
interrupteur : en laisser un seul à `true` en piste aurait rouvert le silence par
la porte de derrière — la notification ne se serait plus affichée en bannière,
mais aurait atterri dans le centre de notifications.

`shouldShowAlert` est **conservé** bien que déprécié : il reste lu par les
runtimes plus anciens, et l'ôter rendrait le silence moins étanche là-bas.

Le test a été étendu, et porte en plus un garde-fou générique : **toute clé
commençant par `shouldShow` doit être fausse pendant le roulage.** Une surface
d'affichage ajoutée plus tard et laissée à `true` sera attrapée.

#### Deux décisions de version, consignées

**Prettier épinglé en `~3.8.3`.** La 3.9.6, résolue par l'installation propre,
reformate les types union : 45 erreurs `prettier/prettier` d'un coup sur
15 fichiers, sans qu'une ligne de code ait bougé. Un lot de migration ne charrie
pas une passe de mise en forme. Voir `docs/DETTE.md`, D-7.

**`eslint-config-expo` porté en `~9.2.0`**, exigé par le SDK 53. Zéro erreur, mais
les avertissements passent de 5 à 17 : la version 9 ajoute des règles.

### Portes du palier 53

`tsc` **0** · `jest` **1 852 passés**, 141 suites — un de plus, le garde-fou de
silence · `eslint` **0 erreur**, 17 avertissements · doctrine 0 · accessibilité 0
· prettier 0 · `expo-doctor` **15/18**.

Les trois échecs restants de `expo-doctor` sont connus et documentés :
`@expo/config-plugins` périmé par `react-native-health` (D-8), `expo-av` non
maintenu (étape 7), `buffer` sans métadonnées.

### Paliers 54 et 55 · **franchis**

Constaté le 03/08/2026 dans `package.json` : `expo ^55.0.28`,
`react-native 0.83.6`, `react 19.2.0`, `expo-router ~55.0.17`.
`npx tsc --noEmit` ne rend rien. Et surtout : les builds iOS 32 à 37 ont
compilé le natif sur ce socle, le 37 s'installe et se lance.

Réserve qui vaut plus que le reste : rien EN AVAL de l'accueil pilote n'a
tourné sur un appareil depuis la migration. Voir `docs/DETTE.md` D-36.

---

## Étape 3 — Nouvelle architecture · **FAITE**, et mesurée

`newArchEnabled: true` posé explicitement dans `app.json`.

**Le défaut n'a pas été supposé, il a été mesuré.** `npx expo config --type introspect`
avant et après :

|       | `newArchEnabled` résolu     |
| ----- | --------------------------- |
| avant | **ABSENT du config résolu** |
| après | `true`                      |

Le drapeau était donc réellement absent, laissé au défaut implicite de l'outillage
natif. Savoir si ce défaut aurait valu `true` de toute façon est **INCONNU depuis
ce poste** — et sans importance : sur une migration de quatre majeures, un drapeau
qui définit le build ne se laisse pas implicite.

React Native 0.83.6 livre **les deux moteurs** — Fabric et Paper sont tous deux
présents dans `node_modules`. Leur seule présence ne dit pas lequel s'applique ;
c'est la déclaration qui tranche.

**Ce qui ne peut pas être vérifié ici.** La bascule est le point de rupture du lot :
c'est là que les bibliothèques natives incompatibles échouent. Cela se produit au
`prebuild` et à la compilation native, qui demandent EAS et une chaîne macOS. Le
projet ne porte ni `ios/` ni `android/` — le natif est généré au build.

**Le candidat désigné reste `react-native-health`**, toujours déclaré comme plugin
et toujours marqué « non testé sur la nouvelle architecture » par React Native
Directory. Voir `docs/DETTE.md`, D-8.

## Étape 4 — Reanimated 3 → 4 · **FAITE** au palier 54

Le nom canonique `react-native-worklets/plugin` est posé dans `babel.config.js`.

**Le piège annoncé par le plan n'existe pas dans cette version**, et c'est vérifié
à l'identité : `react-native-reanimated/plugin` en 4.1.7 puis 4.2.1 est un relais
de quatre lignes qui réexporte `react-native-worklets/plugin`, et les deux noms
rendent le **même objet fonction**. C'était vrai en 4.0, ce ne l'est plus.

Le nom canonique est posé quand même : un relais de compatibilité peut disparaître,
et le jour où il partira, rien ne le dira.

## Étape 5 — MMKV 2 → 3 · **FAITE** — après une erreur de ma part

**J'avais d'abord conclu que cette étape était inutile**, au motif que le SDK 55
n'épingle pas MMKV et qu'aucune porte ne tombait. C'était faux, et la vérification
statique le montre sans ambiguïté.

### Ce que la lecture du natif a établi

`react-native-mmkv@2.12.2` installe son HostObject **par l'ancien pont**.
`ios/MmkvModule.mm` porte, lignes 32 à 41 :

```objc
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install : (nullable NSString*)storageDirectory)
RCTCxxBridge* cxxBridge = (RCTCxxBridge*)_bridge;
auto jsiRuntime = (jsi::Runtime*)cxxBridge.runtime;
```

Un export synchrone bloquant de l'ancien pont, un cast vers `RCTCxxBridge`, et un
accès au runtime JSI **à travers ce pont**. En mode **sans pont** — le défaut de la
nouvelle architecture — cette référence est nulle : l'installation échoue, et MMKV
ne s'initialise pas.

Aucune porte statique ne pouvait attraper cela : `tsc` et `jest` ne lisent pas
l'Objective-C. **Le plan avait raison, mon arbitrage était faux.**

### Ce qui a été fait

`react-native-mmkv` porté en **3.3.3**, avec `react-native-nitro-modules` 0.36.1
qu'il exige. La v3 ne référence plus le pont nulle part — vérifié : aucun fichier
de `ios/` ne mentionne `RCTBridge` ni `RCT_EXPORT_BLOCKING`.

**Zéro ligne de code de production modifiée.** `src/lib/mmkv.ts` n'emploie que
`new MMKV({ id })`, `set`, `getString`, `delete` et `clearAll` — identiques en v3.
`tsc` passe sans un changement.

### Un effet de bord, traité

La v3 exige son module natif : `new MMKV()` échoue sous Jest, qui tourne en
environnement node. La v2 le tolérait. Deux suites sont tombées d'un coup, **sans
qu'aucune ligne de production ait bougé**.

Un simulacre en mémoire est posé dans `__mocks__/react-native-mmkv.ts`. Jest le
charge seul, ce dossier étant adjacent à `node_modules`. Il reproduit le contrat
réellement utilisé, et rien de plus.

## Étape 6 — Skia 1.2 → 2.8 · **FAITE**, mais pas où le plan l'attendait

**Le piège est confirmé et localisé.** `babel.config.js` contient aujourd'hui,
en son unique entrée de `plugins` :

```js
plugins: ['react-native-reanimated/plugin'],
```

En version 4 ce plugin devient `react-native-worklets/plugin`. **L'ancien nom ne
produit aucune erreur** — les animations cessent simplement de fonctionner.

Skia est passé de **1.2.3 à 2.4.18**, mais la majeure v1 → v2 est arrivée dès le
**SDK 53**, sur une préversion `2.0.0-next.4`, et non à cette étape. Elle s'est
stabilisée en 2.2.12 au SDK 54 puis 2.4.18 au SDK 55.

Aucune reprise de code n'a été nécessaire : le relevé confirmait `Vertices`,
`Atlas`, `RuntimeEffect`, `Picture` et `useFont` à zéro occurrence. Tout reste à
écrire en T1.

**Réserve établie par le relevé.** Trois composants passent des `SharedValue`
Reanimated **directement** à Skia — `Dial.tsx`, `BiometryStrip.tsx`,
`GlowStroke.tsx`. Cette passerelle est couplée aux internes de Reanimated. Si elle
rompt, les valeurs restent figées à leur état initial : cadran vide, tracé jamais
dessiné, pulsation immobile. **Aucune erreur ne serait levée.** À regarder au
premier build.

## Étape 7 — `expo-av` → `expo-audio` · **FAITE**, et pas triviale

**`expo-av` a disparu du SDK 55** : il n'y est plus épinglé du tout. L'étape
cesse d'être optionnelle.

Le plan avait raison sur le périmètre — deux fichiers, `Audio` seulement, aucun
usage vidéo — et se trompait sur la difficulté. `expo-audio` **n'est pas un
renommage** :

| expo-av                                           | expo-audio                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `Audio.requestPermissionsAsync`                   | `requestRecordingPermissionsAsync`                                |
| `Audio.setAudioModeAsync({ allowsRecordingIOS })` | `setAudioModeAsync({ allowsRecording })` — le suffixe `IOS` tombe |
| `Audio.Recording.createAsync`                     | `prepareToRecordAsync()` puis `record()`                          |
| `recording.stopAndUnloadAsync`                    | `stop()`                                                          |
| `recording.getURI()`                              | propriété `.uri`                                                  |

**Le point dur n'est pas dans ce tableau.** `expo-audio` n'expose **aucune fabrique
d'enregistreur hors React** : `AudioRecorder` est un TYPE, `useAudioRecorder` est un
hook. Un service ne peut donc plus créer l'enregistreur. `annoter.tsx` le tient
désormais, et `coachAudioService` **opère dessus**. L'inversion est imposée par la
bibliothèque, pas choisie.

**Réserve honnête.** Ce chemin n'a **jamais tourné** : il exigeait déjà un build
natif qui n'a pas eu lieu, et aucun compte coach n'existe en production. La
réécriture n'a donc pas pu être confrontée à un comportement observé — elle suit
l'interface déclarée, rien de plus.

## Étape 8 — `expo-updates` · **FAITE**, en réglage délibérément conservateur

Ajouté en `~55.0.26`, avec `runtimeVersion` suivant `appVersion`.

**Pas en réglage par défaut** : `checkAutomatically: "ON_ERROR_RECOVERY"` et
`fallbackToCacheTimeout: 0`. Un contrôle de mise à jour au lancement ajouterait une
latence réseau **au paddock**, là où la connectivité est mauvaise et le pilote
pressé. L'application ne bloquera jamais son démarrage pour aller voir s'il existe
une version plus récente.

C'est un arbitrage de ma part, réversible en une ligne si vous préférez la
livraison immédiate.

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
