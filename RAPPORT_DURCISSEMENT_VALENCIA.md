# RAPPORT — DURCISSEMENT CAPTURE (JALON VALENCIA)

> Lot « rendre la chaîne de capture survivante hors-ligne de bout en bout ».
> Aucune fonctionnalité ni écran nouveau, aucun contact QDI/IA. Six chantiers de
> l'audit `ETAT_APP_OXV_MIRROR.md` §4. Arbre propre en entrée (précondition
> respectée). Commits atomiques `feat(valencia): …`.

## Commits livrés

| # | Chantier | Commit |
|---|---|---|
| 1-3 | Démarrage local-first + requeue des lots + clôture rejouable/orphelines | `dabfbe8` |
| 5 | Coupure BLE sans clôture forcée (reconnexion illimitée armée) | `3e91df8` |
| 6 | Idempotence des trames + chronos de tours monotones | `0a201d7` |
| 4 | Keep-awake pendant la capture + cohérence app.json | `f3699b1` |
| — | **Vérif adversariale** → 2 critiques (séance détruite, marge fabriquée) | `b6c1ee2` |
| — | **Vérif adversariale** → critique 2 (clé d'unicité destructrice) | `5cb86ba` |
| — | **Vérif adversariale** → 6 findings concurrence & cycle de vie | `3c89996` |

**Gates finaux** : `tsc --noEmit` 0 · `eslint` 0 · `jest` **718 passés / 0 échec**
(~95 nouveaux : file de sync, politique de reconnexion, horloge monotone,
idempotence, classification des erreurs, honnêteté de la marge, concurrence).

## Vérif adversariale — 17 findings confirmés, tous corrigés

Le lot a été soumis à une **vérif adversariale contre-vérifiée** (5 lentilles :
perte de données, races, idempotence/ordre, régression du nominal, ressources).
Résultat : **17 findings confirmés, dont 3 CRITIQUES** — tous corrigés avant
terrain. Les trois critiques auraient frappé le jour J :

1. **Séance entière détruite par une erreur passagère.** `isPermanentFailure`
   droppait toute erreur portant un code. À l'application de la migration,
   PostgREST répond `503 PGRST002` quelques secondes : un pilote resynchronisant
   à cet instant voyait sa `create_session` supprimée, puis toutes ses trames et
   tours tomber en **cascade FK** — séance perdue, sans alerte. Idem `53300`
   (« too many clients ») quand tous les pilotes synchronisent en fin de roulage.
   → classification en **liste blanche**, défaut = transitoire, garde dure sur
   `create_session`, **quarantaine** au lieu de suppression.
2. **La contrainte d'unicité aurait détruit des trames réelles.** `elapsed_ms`
   était monotone **non strict** et le RaceBox livre plusieurs trames par
   notification BLE dans le même tick → trames distinctes au même `elapsed_ms`,
   **silencieusement jetées** par `DO NOTHING`. → `elapsed_ms` rendu
   **strictement** croissant à la source ; clé conservée sur `(session_id,
   elapsed_ms)` et **non** `itow_ms` (unicité non maîtrisée : répétable avant fix
   GPS, réenroulement hebdo, colonne nullable). L'iTOW reste l'**identité
   physique** qui apparie le réimport `.ubx`.
3. **Marge de 100 % fabriquée, affichée et persistée.** Un `max_g_lateral` absent
   était lu « 0 g observé donc 100 % de marge » — donnée absente devenue chiffre
   faux et définitif. → une entrée absente rend `null` (« — »), un 0 g
   réellement observé rend toujours 100 ; rien n'est persisté sans marge résolue.

Chaque test ajouté a été **vérifié en échec contre le comportement d'avant le
fix** (aucun test complaisant).

*Note d'outillage : `node` n'était pas sur le PATH du shell (perdu au rechargement
de session) ; gates exécutés via l'install node du Bureau. Sans effet sur le code.*

---

## Chantiers et choix techniques

### 1. Démarrage hors-ligne — session locale différée
`startCaptureSession` génère l'`id` de session **côté client** (`newUuid()`, UUID
v4 sur `crypto.getRandomValues`, garanti présent via `react-native-url-polyfill`
— pas `crypto.randomUUID`, non fiable en RN). La création de la ligne serveur est
**persistée dans la file de synchro** (op `create_session`) puis un drain part en
arrière-plan (insert immédiat si réseau, sinon rejeu ultérieur). `startCaptureSession`
**ne retourne jamais d'échec réseau** — l'enregistrement démarre immédiatement.
`placement.tsx` ne gatait déjà pas sur le réseau : aucune retouche nécessaire.

### 2. Requeue des lots de trames
**Choix : file dédiée sur FICHIER**, pas la file MMKV existante (`offlineQueue.ts`).
Justification : 30 000 trames ≈ plusieurs Mo ; MMKV est fait pour de petites clés,
pas pour du volume. Nouveau module `captureSyncQueue.ts` : dossier
`${documentDirectory}capture-queue/`, **une op JSON par fichier**, nom horodaté
**monotone** + séquence → le tri lexicographique **est** l'ordre FIFO
d'insertion, robuste au redémarrage. Un lot d'insert en échec est requeué (op
`frames`) au lieu d'être perdu. `total_frames` est **réconcilié sur le compte réel
en base** à la clôture (les ops `frames` précèdent `complete` en FIFO) : honnête
même si un lot a été droppé.

### 3. Clôture hors-ligne et récupération des orphelines
Les tours (`laps`), l'update `complete` et l'upload `.ubx` passent par la **file**
(enqueue), plus par des appels directs best-effort perdus si hors-ligne. La session
n'est **jamais laissée en `recording` fantôme** : `complete` part tout de suite ou
attend et sera rejoué ; `abortCaptureSession` enqueue aussi un `complete` en statut
`aborted` (sinon un `create_session` drainé plus tard ressusciterait une séance
`recording`). **Reprise** : `resumeUnsyncedCaptures()` au boot (`app/_layout.tsx`,
silencieux/non bloquant) + `processQueue()` accroché au **retour réseau**
(`src/lib/netinfo.ts`). **Réimport `.ubx` → `telemetry_frames`** :
`reimportUbxToFrames(sessionId, userId, fileUri)` parse le `.ubx` local (réutilise
le parser UBX existant) et **comble** les trames manquantes — filet ultime testé.
Il **apparie sur `itow_ms`** (l'identité physique de la trame, écrite à
l'identique par le live et par le fichier) : les trames déjà en base sont sautées,
seules les absentes sont réinsérées, avec un `elapsed_ms` **recalé sur l'échelle
de temps des trames live** et garanti libre. Utilisable sur une séance
**partiellement** synchronisée — sa raison d'être. Refuse explicitement une
séance portant des trames héritées sans `itow_ms` (appariement impossible) plutôt
que de la dupliquer en silence.

### 4. Écran et arrière-plan — premier plan assumé
`expo-keep-awake` (tag `oxv-capture`) activé à l'armement, libéré aux **4 points de
désarmement** (stop / abort / finalize / timeout long), best-effort et idempotent :
l'auto-verrouillage ne coupe plus la radio sur un relais de 20 min. **`app.json` mis
en cohérence** : `UIBackgroundModes: ["bluetooth-central"]` **retiré** (il
contredisait le plugin `react-native-ble-plx` `isBackgroundEnabled:false`). BLE
arrière-plan = entitlements iOS d'un lot ultérieur. Comportement documenté dans
`docs/SMOKE_TEST_DEVICE.md`.

### 5. Coupure BLE sans clôture forcée
Module pur `src/ble/reconnectPolicy.ts` : `nextReconnectDelayMs(attempt)` = backoff
**progressif plafonné** (2→4→8→16→**30 s max**) ; `shouldGiveUpReconnect` = jamais
en mode illimité. `bluetoothService` gagne un flag `unlimitedReconnect` + méthode
`setUnlimitedReconnect(on)` : en mode illimité, **jamais** de bascule `'lost'`. La
capture **arme** l'illimité au démarrage et le **désarme partout**. Pendant les
tentatives, la session **reste ouverte**, le trou de liaison est **horodaté**
(`console.warn` factuel — silence en piste, aucun HUD). Clôture **uniquement** par
le pilote (stop/abort) ou un **timeout long** `LONG_INTERRUPT_TIMEOUT_MS = 15 min`
(constante nommée, timer nettoyé partout). `'lost'` conservé en garde défensive de
dernier recours.

### 6. Idempotence en base
**DEUX migrations** (**créées, NON exécutées** — à appliquer en prod par Gabin) :
`20260715120000_valencia_telemetry_frames_unique.sql` (trames) et
`20260716120000_valencia_laps_unique.sql` (tours). Même structure : dédoublonnage
préalable (plus petit `ctid` par couple), puis `ADD CONSTRAINT … UNIQUE` posée
idempotemment (bloc `DO/IF NOT EXISTS` sur `pg_constraint`).

**Clé retenue pour les trames : `(session_id, elapsed_ms)`**, et non `itow_ms`.
`itow_ms` est pourtant identique par construction sur le live et le réimport,
mais son unicité est une propriété du **boîtier** (iTOW répétable/nul avant fix
GPS, réenroulement hebdomadaire) et la colonne est **nullable** (les NULL sont
distincts en Postgres) : sous `ON CONFLICT DO NOTHING`, toute répétition ferait
détruire en silence une trame réelle. `elapsed_ms` offre une garantie **sous
notre contrôle**. **Prérequis**, sans quoi la contrainte détruit au lieu de
protéger : `elapsed_ms` est désormais **STRICTEMENT croissant** à la source
(`captureFrameMapping.nextElapsedMs`) — l'ancien `Math.max(now - start, last)`
n'était que monotone, et le RaceBox livre plusieurs trames par notification BLE
dans le même tick (même `Date.now()`). Ne pas appliquer la migration trames à un
parc encore sur une version antérieure.

**Client** : trames ET tours passent par un `upsert … ignoreDuplicates: true`
(`onConflict: 'session_id,elapsed_ms'` / `'session_id,lap_number'`) avec la même
**garde anti-casse** : tant que la contrainte n'existe pas en prod, l'upsert
renvoie `42P10` → **repli `insert`** (bascule sticky + log unique) ; un `23505`
en mode repli prouve que la migration est passée → **ré-armement** et rejeu en
upsert (jamais de lot abandonné pour une collision d'unicité). Sûr avec ou sans
contrainte, dans les deux ordres d'application.

**Chronos de tours monotones** : `src/utils/monotonicClock.ts`
(`nextMonotonic = Math.max(wallNow, lastMono)`) — monotonie **non stricte**,
volontairement : c'est une base de **durées**, pas une clé d'unicité (contrairement
à l'`elapsed_ms` des trames, qui exige la stricte croissance).
`lapDetectionRunner` sépare l'instant **mural** (dates d'affichage) et la **durée
mesurée** (delta monotone, jamais négative si l'horloge recule).

---

## Définition de « terminé » — validation manuelle requise

Le lot est **logiciellement complet et testé**, mais sa validation finale est un
**parcours device réel** (RaceBox + iPhone) documenté pas-à-pas dans
`docs/SMOKE_TEST_DEVICE.md` (section « survie hors-ligne ») : mode avion → verrouillage
20 min → coupure BLE 90 s → arrêt hors réseau → retour réseau, avec vérif en base
(zéro doublon, `total_frames` exact, tours détectés). **Tant que ce parcours n'est
pas passé sur device, le durcissement n'est pas validé.**

## La fluidité est devenue réelle — décision fondateur prise et appliquée (`c409dcc`)

> **Tranché** : voie (1), « on écrit la donnée à la capture ». La colonne
> `laps.max_g_lateral` existait déjà → **zéro migration**. Depuis `c409dcc`, la
> capture accumule et écrit les maxima **par tour** (`max_g_lateral`,
> `max_g_braking`, `max_g_accel`, `max_speed_kmh`, `avg_speed_kmh`), dans la
> convention d'axes verrouillée (gForceY = latéral ; gForceX > 0 = freinage).
> L'outlap est exclu du tour 1 ; le dernier tour est figé à l'arrêt ; un tour sans
> trame reste `null` (jamais 0), tandis qu'un tour mesuré sans freinage porte
> honnêtement 0 (« il n'a jamais freiné » est une observation, pas un trou).
> `computeSmoothness` écarte désormais les tours non mesurés au lieu de les lire
> 0 g. **Conséquence assumée** : les séances déjà captées (colonne NULL) voient
> leur marge se taire (« — ») au lieu d'afficher un 100 fabriqué — silence honnête,
> sans rattrapage. Le diagnostic d'origine est conservé ci-dessous.

Découvert en corrigeant la critique 3 :

- `buildLapRows` (`captureSessionService.ts`) n'écrit **jamais** `laps.max_g_lateral`,
  et aucun trigger ne le calcule côté base.
- `computeSmoothness` (`marginCalculator.ts`) lit donc
  `Number(l.max_g_lateral ?? 0)` → **que des zéros** → écart-type 0 → **fluidité = 100
  fabriquée**, sur **100 % des séances réelles captées par l'app**.
- La fluidité pèse ~24 % de la marge globale : c'est la même violation « donnée
  absente → 100 » que la critique 3, **un cran plus bas**.

**Pourquoi elle ne pouvait pas être corrigée sans arbitrage** : rendre la fluidité
honnêtement `null` **nullifie la marge globale de toutes les séances captées
jusqu'ici** (la pondération n'est calculée que si ses termes existent). Trois voies
étaient sur la table — (1) écrire la donnée à la capture, (2) retirer la fluidité de
la marge, (3) assumer le `null`. **Voie (1) retenue** : la donnée existe dans le flux,
c'est du write-path, et c'est la seule où la fluidité devient *vraie* plutôt que
supprimée ou tue. Appliquée en `c409dcc`.

**`fetchSpeedSamples`** (même classe de bug, code mort à zéro appelant) :
**SUPPRIMÉ** (DROP net, décision fondateur 2026-07-16).

---

## Base de production — TOUT EST APPLIQUÉ (2026-07-16, accords explicites fondateur)

| Action | État |
|---|---|
| Migration idempotence **trames** (`UNIQUE (session_id, elapsed_ms)`) | ✅ appliquée (0 doublon constaté avant pose ; l'upsert client s'active seul) |
| Migration idempotence **tours** (`UNIQUE (session_id, lap_number)`) | ✅ appliquée |
| **Haute Saintonge** — ligne officielle 45.240578/-0.094391, demi-largeur 15 m, cap 298,5° | ✅ appliquée (l'ancienne ligne était à 231 m, sur un sommet du tracé, rayon 40 m) |
| **Ricardo Tormo** — ligne officielle 39.483568/-0.631076, demi-largeur **10 m**, cap 55,2°, 4,000 km | ✅ créée (`06876cce`) |
| 3 sessions fantômes `recording` (pré-durcissement) | ✅ passées `aborted` |

**Détection par PORTE** (`e64c37e`) : les deux circuits ont un `finish_line_heading`
→ le rayon sert de **demi-largeur de porte** (franchissement + sens obligatoire),
plus de rayon de proximité. Calibration Valence (relevé fondateur + imagerie du pit
wall) : la ligne est côté opposé aux stands ; fenêtre latérale mesurée **[8,0 ;
12,5] m** (bord piste côté stands à 8 m, pit wall 8→12,5 m, fast lane au-delà) —
10 m retenus. Détail : `docs/SQL_CALIBRATION_RICARDO_TORMO.sql` et
`docs/SQL_CALIBRATION_HAUTE_SAINTONGE.sql`.

## Ce qui reste manuel le jour J

- [ ] **Test de la porte** (les deux circuits) : remonter la voie des stands SANS
      franchir la ligne → **0 tour attendu**. Si un tour apparaît à Valence,
      réduire la demi-largeur vers 9 m, jamais sous 8.
- [ ] **Vérifier ≥ 20 Hz à l'armement** (débit de trames au démarrage ; RaceBox
      Mini S = 25 Hz nominal).
- [ ] **Garder le téléphone déverrouillé / écran allumé** (keep-awake couvre
      l'auto-verrouillage ; pas de capture écran éteint en v1).
- [ ] Contrôler qu'aucune séance locale n'est restée en file après synchro (retour
      réseau → file vidée).
- [ ] Parcours complet « survie hors-ligne » de `docs/SMOKE_TEST_DEVICE.md`.

— Claude Code, lot durcissement Valencia
