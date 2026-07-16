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

**Gates finaux** : `tsc --noEmit` 0 · `eslint` 0 · `jest` **654 passés / 0 échec**
(dont ~30 nouveaux : file de sync, politique de reconnexion, horloge monotone,
idempotence).

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

## Ce qui reste manuel le jour J

- [ ] **Appliquer les DEUX migrations d'idempotence** en prod — trames
      (`20260715120000_…_telemetry_frames_unique.sql`) **et** tours
      (`20260716120000_valencia_laps_unique.sql`). Sinon repli `insert`, pas
      d'idempotence stricte — l'étape « zéro doublon » n'est garantie qu'après.
      Prérequis pour les trames : parc à jour (`elapsed_ms` strictement
      croissant). Auditer avant si les tables ne sont plus vides (les requêtes
      sont en tête de chaque migration) : le dédoublonnage supprime des lignes.
- [ ] **Renseigner la ligne d'arrivée de Valencia** en base `circuits` (requête
      ci-dessous) — sans elle, **0 tour détecté** (repli piégé volontaire).
- [ ] **Vérifier ≥ 20 Hz à l'armement** (débit de trames au démarrage ; RaceBox
      Mini S = 25 Hz nominal).
- [ ] **Garder le téléphone déverrouillé / écran allumé** (keep-awake couvre
      l'auto-verrouillage ; pas de capture écran éteint en v1).
- [ ] Contrôler qu'aucune séance locale n'est restée en file après synchro (retour
      réseau → file vidée).

---

## Requête SQL Valencia — ligne d'arrivée (PRÉPARÉE, NON EXÉCUTÉE)

La table `circuits` stocke la ligne d'arrivée dans `finish_line_lat`,
`finish_line_lon`, `finish_line_radius_m`, `finish_line_heading` (lu par
`circuitsService` → `captureFinishLineFor`). **Je ne connais pas les coordonnées
GPS réelles de la ligne d'arrivée de Valencia** : elles doivent venir d'un relevé
terrain (un point RaceBox posé sur la ligne start/finish, ou la donnée officielle
du circuit). Les placeholders `<…>` ci-dessous sont à remplacer par ces valeurs
réelles **avant** exécution. Ne pas inventer de coordonnées.

```sql
-- Valencia — ligne d'arrivée pour la détection de tours (jalon Valencia).
-- Remplacer les placeholders <…> par le relevé RÉEL de la ligne start/finish.
-- Ricardo Tormo (Cheste) ≈ 39.4589 N, -0.6317 E — À VÉRIFIER/RELEVER PRÉCISÉMENT.
insert into public.circuits (
  id, name, is_official, is_default,
  finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading,
  length_km, turns_count
) values (
  gen_random_uuid(),
  'Circuit Ricardo Tormo (Valencia)',
  true,
  false,
  <FINISH_LAT>,          -- ex. 39.48590 (latitude de la ligne, WGS84)
  <FINISH_LON>,          -- ex. -0.63170 (longitude de la ligne, WGS84)
  30,                    -- rayon de détection en mètres (30 = valeur usuelle)
  <FINISH_HEADING|null>, -- cap de franchissement en degrés, ou null
  4.005,                 -- longueur km (À CONFIRMER)
  14                     -- nombre de virages (À CONFIRMER)
)
-- Si le circuit existe déjà, mettre à jour la ligne d'arrivée au lieu d'insérer :
on conflict (id) do update set
  finish_line_lat      = excluded.finish_line_lat,
  finish_line_lon      = excluded.finish_line_lon,
  finish_line_radius_m = excluded.finish_line_radius_m,
  finish_line_heading  = excluded.finish_line_heading;
```

> Le `on conflict (id)` ne se déclenche qu'avec un `id` fixe connu ; pour un
> circuit déjà présent, préférer un `UPDATE public.circuits SET finish_line_… =
> <…> WHERE name = 'Circuit Ricardo Tormo (Valencia)';` ciblé. Vérifier au
> préalable : `select id, name, finish_line_lat, finish_line_lon from public.circuits
> where name ilike '%valencia%' or name ilike '%tormo%';`

Au lancement de la capture, `placement.tsx` doit passer `circuit.finishLine` de ce
circuit — sinon repli `BELTOISE_FINISH` (hors piste → 0 tour).

— Claude Code, lot durcissement Valencia
