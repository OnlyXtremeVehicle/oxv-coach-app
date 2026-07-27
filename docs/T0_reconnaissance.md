# T0 — Reconnaissance : dimensionnement de la migration SDK 51 → 55

**26 juillet 2026** · lecture seule · aucun fichier modifié, rien installé, aucun build

Ce rapport n'établit que ce que le code montre. Chaque affirmation porte son
fichier et sa ligne. `INCONNU` est employé partout où trancher exigerait une
exécution, un build ou un appareil.

**État de départ, vérifié :** Expo SDK `~51.0.28`, React Native `0.74.5`,
React `18.2.0`, `newArchEnabled` **absent** de `app.json`, `eas.json` et de tout
`app.config.*` — le dépôt n'en contient aucun. Ni `ios/` ni `android/` ne sont
versionnés. Aucun dossier `patches/`, aucun `patch-package` dans `package.json`.

---

## 1. Verdict par inconnue

### three.js — `arbitrage requis`

**Un seul fichier importe la bibliothèque :**

| Fichier | Ligne | Import |
|---|---|---|
| `src/circuit/CircuitTrace.tsx` | 18 | `import { Canvas, useFrame } from '@react-three/fiber/native'` |
| `src/circuit/CircuitTrace.tsx` | 19 | `import * as THREE from 'three'` |

`expo-gl` n'apparaît **dans aucun import** : sa seule occurrence est un
commentaire, `src/circuit/CircuitTrace.tsx:4`. Il est tiré comme dépendance
transitive de `@react-three/fiber/native`.

**Chaîne de montage, établie :**

- `src/circuit/CircuitTraceHero.tsx:24` importe `CircuitTrace`, le monte ligne 96.
- `CircuitTraceHero` est monté par `app/(app)/circuit/[id].tsx:20` et `:103`.
- `CircuitTrace` est monté directement par `app/(app)/creer-trace.tsx:22` et
  `:129`, ainsi que par `app/(app)/debug-circuit.tsx:14` et `:33`.

**Atteignabilité : aucun de ces trois écrans n'est dans `app/(app2)/`.** Tous
vivent dans l'arbre gelé. `app/(app2)/` contient bien des symboles nommés
`CircuitTraceFallback` — `index.tsx:421`, `rec/index.tsx:104`,
`rec/preparation.tsx:539` — mais ce sont des **replis plats** locaux, définis
dans chaque écran, sans aucun rapport avec le rendu 3D. Aucun écran de l'arbre
pilote actif n'importe `three`, `@react-three/fiber` ni `expo-gl`.

**Poids installé : 30,8 Mo** — `three` 29 Mo, `@react-three/fiber` 996 Ko,
`expo-gl` 770 Ko.

**Pourquoi « arbitrage » et non « supprimable » :** le code est mort du point de
vue de l'arbre actif, mais `circuit/[id]` et `creer-trace` figurent sur la liste
des sept écrans orphelins dont le sort n'est **pas tranché** (`debug-circuit` est
`__DEV__` uniquement). Supprimer la dépendance revient à décider de leur sort.
C'est une décision produit, pas une conclusion technique.

### react-native-maps — `conservée`

| Fichier | Ligne | Import |
|---|---|---|
| `app/(app)/carte-oxv.tsx` | 47 | `MapView, { Marker, PROVIDER_DEFAULT }` |
| `app/(app)/creer-route.tsx` | 50 | import multi-lignes depuis `react-native-maps` |
| `app/(app2)/club/territoire.tsx` | 36 | `MapView, { Marker, PROVIDER_DEFAULT }` |

`src/features/club/territoireLogic.ts:25` la mentionne en commentaire seulement
(le type de région y est redéfini localement).

**Atteignabilité : `club/territoire` EST dans l'arbre pilote actif.** C'est la
seule des trois inconnues à avoir un consommateur en `(app2)`. Nuance à
connaître : cet écran n'a **aucun lien entrant** dans le dépôt — il est
inatteignable par la navigation aujourd'hui. C'est un défaut de câblage, pas une
absence d'usage : le code est vivant et destiné à l'être.

**Poids installé : 1,3 Mo.**

**Verdict : conservée.** Elle sert l'arbre actif.

### react-native-webview — `arbitrage requis`

| Fichier | Ligne | Import |
|---|---|---|
| `app/(coach)/ar.tsx` | 65 | `import { WebView } from 'react-native-webview'` |
| `app/(coach)/ar.tsx` | 70 | types depuis `react-native-webview/lib/WebViewTypes` |

Un seul écran, dans l'espace coach. Il encapsule la vue AR servie par
`https://app.oxvehicle.fr/ar-view`.

**Atteignabilité : ni `(app)` ni `(app2)` — l'espace coach.** Celui-ci est
gardé sur `role = 'coach'`, et **aucun compte de production ne porte ce rôle**.
L'écran est donc injoignable aujourd'hui pour une raison de DONNÉES, pas de code.

**Poids installé : 876 Ko.**

**Pourquoi « arbitrage » :** la dépendance est légère et le code est vivant. La
supprimer supposerait d'abandonner la vue AR, ce qui est une décision produit.

---

## 2. Tableau de risque

La colonne « version cible » n'est renseignée que lorsque le dépôt l'établit.
Ailleurs : `INCONNU` — aucun fichier du dépôt ne fixe les versions du SDK 55.

| Dépendance | Actuelle | Cible | Fichiers | API sensibles réellement utilisées | Risque Fabric |
|---|---|---|---|---|---|
| `react-native-ble-plx` | ^3.2.0 | INCONNU | 3 | `startDeviceScan`, `stopDeviceScan`, `connectToDevice`, `discoverAllServicesAndCharacteristics`, `monitorCharacteristicForService`, `.state` | **élevé** |
| `react-native-mmkv` | ^2.12.2 | INCONNU | 1 direct, 15 indirects | instance partagée `new MMKV({ id: 'oxv-coach-cache' })`, `.set`, `.getString`, `.delete` | **élevé** |
| `react-native-health` | ^1.19.0 | INCONNU | 0 statique, 1 dynamique | `require()` paresseux | INCONNU |
| `@shopify/react-native-skia` | 1.2.3 | 2.8.x | 23 | `Canvas`, `Skia`, `Path`, `Group`, `Circle`, `Rect`, `Points`, `Image` | moyen |
| `react-native-reanimated` | ~3.10.1 | 4.x | 61 | `useSharedValue` 36, `runOnJS` 17, `useDerivedValue` 3, `measure` 2, `runOnUI` 1, `useAnimatedReaction` 1, `useFrameCallback` 1, `scrollTo` 1 | **élevé** |
| `expo-av` | ~14.0.7 | `expo-audio` | 2 | `Audio` uniquement | faible |

### Ce que le détail change

**BLE — 3 fichiers, pas 1.** `src/ble/bluetoothService.ts` (le service),
`src/lib/runtime.ts` et `app/(app)/data-lab-canvas.tsx` le référencent aussi.
`bluetoothService.ts` est l'un des **quatre fichiers gelés** de la chaîne de
capture. L'API employée est étroite et stable ; le risque ne vient pas de sa
surface mais de la nature du module — natif, avec souscriptions longues. 14
occurrences de manipulation base64 dans `src/ble/` : le décodage des trames UBX
et du protocole cardiaque passe par là.

**MMKV — le rayon d'action est bien plus large que l'import.**
`src/lib/mmkv.ts:13,15` est le seul importateur du paquet, mais **15 fichiers**
consomment l'instance partagée, dont quatre écrans de capture :
`app/(app2)/rec/preparation.tsx`, `arrivee.tsx`, `entre-runs.tsx`, `fin.tsx`.
Plus `biometryCaptureRunner`, `incidentOffline`, `offlineQueue`,
`analyticsService`, `intentionsService`, `circuitsService`, `recordCelebration`,
`useMiroirHome`, `useDetailLevel`.

**Réponse à la question posée : NON, la file de synchronisation de capture ne
dépend PAS de MMKV.** `src/services/captureSyncQueue.ts:100` importe
`expo-file-system` ; la file vit dans
`${FileSystem.documentDirectory}capture-queue/`, une opération par fichier
(`:8`, `:196`, `:238`). Le commentaire d'en-tête `:5` distingue explicitement
cette file de « la file MMKV d'`offlineQueue` », qui, elle, sert aux petites
actions unitaires. **Deux mécanismes distincts.** MMKV n'est donc pas sur le
chemin critique de la capture, mais `offlineQueue` en dépend.

**Skia — aucune API avancée.** Recherche exhaustive sur les 23 fichiers
importateurs : `Vertices`, `Atlas`, `RuntimeEffect`, `Picture` et `useFont` sont
**absents, zéro occurrence**. L'usage se limite au dessin déclaratif de base.
C'est le fait qui abaisse le risque de la majeure 1.x → 2.x : ce sont les API
avancées qui bougent le plus.
Sept fichiers de `src/ui/v2/` : `BiometryStrip`, `Dial`, `HeritageBand`,
`RadarQdi`, `SpringDot`, `TraceCircuit`, `motion/GlowStroke`. Plus
`src/components/DataLabCanvas`, `PerfChart`, `src/features/vous/reserverUi`,
`app/(app2)/bilan/[sessionId]`, `app/(app2)/club/territoire`.

**Reanimated — 61 fichiers, mais peu d'API de bord.** `createWorkletRuntime`
n'est **jamais** employé. `runOnUI`, `useAnimatedReaction` et `useFrameCallback`
n'apparaissent qu'une fois chacun. L'essentiel est `useSharedValue` (36) et
`runOnJS` (17). Le risque tient au volume et au **changement de nom du plugin
Babel** (voir §5), pas à des usages exotiques.

**expo-av — audio seulement.** `src/services/coachAudioService.ts:14` importe
`{ Audio }` ; `app/(coach)/annoter.tsx:66` n'importe que le **type**. Aucun usage
vidéo. La scission du paquet dans les SDK récents implique donc **`expo-audio`
uniquement** — `expo-video` n'est pas nécessaire.

**react-native-health — le code est derrière une garde et n'a jamais été
compilé.** Zéro import statique. `src/services/v2/healthKitService.ts:42`
déclare `const HEALTH_MODULE_NAME = 'react-native-health'` et la ligne `:78` fait
`require(HEALTH_MODULE_NAME)` **paresseusement**. `src/features/rec/bio1Trigger.ts:22`
documente l'état. Conséquence pour le dimensionnement : sur tout binaire
antérieur à l'installation du paquet, le `require` échoue et tout retombe sur
« indisponible ». **Le module n'a jamais traversé un build** — son comportement
sous Fabric est donc `INCONNU`, et le restera jusqu'à une compilation.

---

## 3. Chemin critique — ce qui arrête la capture

Établi par lecture. Ces fichiers, s'ils cassent, interrompent la chaîne du
boîtier jusqu'à la base.

1. **`src/ble/bluetoothService.ts`** — scan, connexion, souscription aux
   caractéristiques, reconnexion. **Fichier gelé.** Dépend de
   `react-native-ble-plx`.
2. **`src/ubx/parser.ts`** — décodage des trames RaceBox. Pas de dépendance
   native ; risque de migration faible.
3. **`src/store/useAppStateStore.ts`** — machine à états du pilote. **Fichier
   gelé.**
4. **`src/services/captureSessionService.ts`** — orchestration de la capture.
   **Fichier gelé.**
5. **`src/services/captureSyncQueue.ts`** — file hors ligne. **Fichier gelé.**
   Dépend d'**`expo-file-system`**, pas de MMKV.
6. **`src/services/biometryCaptureRunner.ts`** — tampon cardio local. Dépend de
   **MMKV** (injecté).
7. **Les quatre écrans `app/(app2)/rec/`** — `preparation`, `arrivee`,
   `entre-runs`, `fin`. Dépendent de MMKV.

Les quatre fichiers gelés sont sous règle cardinale : toute modification demande
l'accord du fondateur. Une migration qui les touche n'est pas une opération
technique ordinaire.

---

## 4. Ce qui s'allège

### Polices — le gisement principal

Les neuf paquets sont déclarés **et tous réellement importés**, tous depuis un
fichier unique : **`src/theme/fonts.ts`**. Le chargement se fait par `useFonts`
(ligne 54).

**29 graisses chargées au démarrage**, réparties ainsi :

| Paquet | Graisses | Poids | Import |
|---|---|---|---|
| `hanken-grotesk` | 7 | 3,3 Mo | `fonts.ts:33` |
| `geist` | 5 | 3,5 Mo | `fonts.ts:8` |
| `inter` | 4 | 7,8 Mo | `fonts.ts:41` |
| `jetbrains-mono` | 4 | 3,4 Mo | `fonts.ts:21` |
| `geist-mono` | 2 | 3,6 Mo | `fonts.ts:9` |
| `instrument-serif` | 2 | 465 Ko | `fonts.ts:13` |
| `rajdhani` | 2 | 2,1 Mo | `fonts.ts:22` |
| `syncopate` | 2 | 553 Ko | `fonts.ts:42` |
| `michroma` | 1 | 247 Ko | `fonts.ts:44` |

**Total installé : 24,9 Mo.**

L'arbitrage V3 retient Syncopate, JetBrains Mono, la police système, et conserve
Inter temporairement. Les six autres — `geist`, `geist-mono`, `hanken-grotesk`,
`instrument-serif`, `michroma`, `rajdhani` — représentent **13,2 Mo**.

**Réserve à porter au chiffrage :** ces six ne sont pas des dépendances mortes.
Elles sont référencées par les jetons de thème et employées à l'écran. Les
retirer suppose de migrer les usages typographiques, pas seulement de
désinstaller. Le gain de poids est acquis ; le coût est une passe de rendu sur
l'ensemble des écrans, dont l'ampleur est **INCONNUE** sans inventaire des sites
d'usage — hors périmètre de ce rapport.

### Dépendances

| Si l'arbitrage le permet | Poids libéré |
|---|---|
| `three` + `@react-three/fiber` + `expo-gl` | **30,8 Mo** |
| `react-native-webview` | 876 Ko |

`react-native-maps` (1,3 Mo) n'est pas candidate : elle sert l'arbre actif.

### Le double moteur graphique — `react-native-svg` ne peut PAS disparaître

**79 fichiers importent `react-native-svg`** (4,4 Mo), répartis ainsi :

| Emplacement | Fichiers |
|---|---|
| `src/components/` | 25 |
| `app/(app2)/` | **25** |
| `app/(app)/` | 19 |
| `app/(coach)/` | 7 |
| `src/ui/` (ancien kit) | 4 |
| `src/ui/v2/` (kit Instrument) | 3 |
| `src/circuit/`, `src/features/`, `(admin)`, `(partner)`, `(pro)` | 0 |

**Réponse à la question posée : NON.** `react-native-svg` ne part pas avec
l'ancien kit. Trois raisons, chacune suffisante :

1. **25 fichiers de l'arbre pilote actif** l'importent directement.
2. Le kit Instrument lui-même en dépend, par trois fichiers de `src/ui/v2/`.
3. **`react-native-qrcode-svg`** (1,2 Mo) le retient, et deux de ses quatre
   consommateurs sont en V2 : `app/(app2)/club/pass.tsx:22` et
   `app/(app2)/rec/preparation.tsx:28` — les deux autres étant
   `app/(app)/pass-oxv.tsx:17` et `app/(app)/preparation.tsx:24`.

Les deux moteurs coexisteront donc après migration. Ce n'est pas une dette à
résorber au passage : c'est un état à assumer et à budgéter.

---

## 5. Vérifications de configuration

**`newArchEnabled` : ABSENT.** Recherche sur `app.json`, `eas.json`,
`app.config.js`, `app.config.ts` — aucune occurrence. Aucun `app.config.*`
n'existe dans le dépôt.

**Dossiers natifs : aucun.** Ni `ios/` ni `android/` ne sont versionnés. Le flux
est entièrement *prebuild* — ce qui simplifie la migration : aucun projet Xcode
ni Gradle à réconcilier.

**`patch-package` : absent**, et aucun dossier `patches/`. Aucun correctif de
dépendance à re-porter.

**`eas.json`** — `cli.version >= 12.0.0`, `appVersionSource: "remote"`. Trois
profils :

| Profil | Distribution | Environnement | iOS | Android |
|---|---|---|---|---|
| `development` | internal, `developmentClient` | development | `m-medium`, `simulator: false` | apk |
| `preview` | internal | preview | `m-medium`, `simulator: false` | apk |
| `production` | (store) | production | `m-medium` | app-bundle |

`preview` et `production` posent `EXPO_PUBLIC_PLAUSIBLE_DOMAIN=oxvehicle.fr`.
`autoIncrement` est actif sur les trois.

**`babel.config.js` — le point qui cassera.**

```js
plugins: ['react-native-reanimated/plugin']
```

C'est **l'unique plugin déclaré**, et c'est précisément celui qui change de nom
en Reanimated 4 (`react-native-worklets/plugin`). Le preset est
`babel-preset-expo` avec `jsxImportSource: 'react'`.

**`metro.config.js`** — la configuration passe par
`getSentryExpoConfig('@sentry/react-native/metro')` et n'est pas étendue
localement. Toute évolution du wrapper Sentry se répercutera directement ; c'est
le seul point d'attache non standard de la chaîne de build.

---

## 6. INCONNUS

Ce qui exige une exécution, un build ou un appareil, et qu'aucune lecture de code
ne peut trancher :

1. **Les versions cibles réelles** de chaque dépendance sous SDK 55. Aucun
   fichier du dépôt ne les fixe. Le tableau §2 porte `INCONNU` là où c'est le cas.
2. **Le comportement de `react-native-health` sous Fabric.** Le paquet a été
   installé le 25/07/2026 et **n'a jamais traversé un build**. Rien n'est
   observé, ni son fonctionnement actuel, ni sa compatibilité future.
3. **Le comportement de `react-native-ble-plx` sous la nouvelle
   architecture** — souscriptions longues, reconnexion, arrière-plan. Aucune
   capture réelle n'a jamais été enregistrée : la production ne contient que 53
   trames issues d'une séance abandonnée, et zéro boîtier en flotte. La chaîne
   est fortement testée en unitaire, jamais éprouvée en conditions réelles.
4. **Le rendu Skia après la majeure 1.x → 2.x.** L'absence d'API avancée est un
   bon signe, elle n'est pas une garantie.
5. **Les régressions de `react-native-svg`** sur 79 fichiers. Aucun test de rendu
   n'existe dans le dépôt ; la suite couvre la logique pure.
6. **L'ampleur réelle de la migration typographique.** Le poids libéré est
   mesuré ; le nombre de sites d'usage à reprendre ne l'est pas.
7. **Le coût des quatre fichiers gelés.** Toute migration les touchant demande
   l'accord du fondateur, et le délai de cette décision n'est pas un paramètre
   technique.

---

*Rapport produit en lecture seule. Aucun fichier du dépôt n'a été modifié hors la
création de celui-ci. Aucune installation, aucun build.*
