# Politique de la donnée piste

> Quelle donnée, à qui, quand, à quelle précision, sous quelles limites.
> Réf. amont : `00_PLATEFORME_OXV.md` (phrase nord, piliers) · `01_ORGANISATION_PRODUIT.md` (Bilan = cœur) · `03_MVP_SCOPE.md` (Data Lab V1).
> Ce document débloque le **Data Lab**, la **matrice RLS** (`05_ROLES_PERMISSIONS.md`) et l'espace **Coach Notes**.
> **Statut : cadrage.** Toute table ou colonne marquée « nécessite accord » est **à soumettre à Gabin** — rien n'est acquis.

---

## 0. Principe directeur

> Le pilote voit l'essentiel. Le coach voit la profondeur. L'admin voit le système. Le partenaire voit les opportunités.

Une même donnée brute traverse quatre regards. La donnée ne change pas ; **ce qui change, c'est le droit de la voir, la formulation, et le grain de précision**. La granularité décroît à mesure qu'on s'éloigne du pilote : pilote (sa session entière) → coach (selon consentement) → admin (qualité et agrégé) → partenaire (jamais de télémétrie individuelle).

Quatre interdits transversaux, valables pour tous les regards :

1. **Aucune donnée pendant le roulage.** Silence total en piste — aucun écran, aucun son, aucune notification (cf. `01 §Session`). La donnée n'existe pour l'œil **qu'après** le retour aux stands.
2. **L'estimation reste estimation.** Tout ce qui est calculé (marge, freinage estimé, dispersion) est une **lecture**, jamais un verdict.
3. **Pas de note de performance, pas de classement.** Aucune donnée n'est mise en compétition non consentie.
4. **Côté pilote : zéro verbe prescriptif.** « à observer », « était-ce volontaire ? » — jamais « freinez », « corrigez », « erreur », « mauvais ».

---

## 1. Données capturées (brutes)

Source unique en V1 : le boîtier **RaceBox Mini** via BLE, parsé localement (`src/ubx/parser.ts`), puis persisté. Deux niveaux de stockage existent **déjà** en production : la trame haute fréquence (`telemetry_frames`) et la session agrégée (`telemetry_sessions`, `laps`).

### 1.1 Trame brute — `telemetry_frames` (existe, ne pas modifier)

Échantillon haute fréquence (~5–25 Hz selon config RaceBox). Colonnes réelles (cf. `database.types.ts` L4202 et `05_SCHEMA §telemetry_frames`) :

| Donnée | Colonne(s) | Nature |
|---|---|---|
| Position GPS | `latitude`, `longitude`, `altitude_m` | trajectoire absolue |
| Vitesse | `speed_kmh`, `speed_ms` | instantanée |
| Accélérations (G) | `g_force_x`, `g_force_y`, `g_force_z` | latéral / longitudinal / vertical |
| Rotation (gyro) | `rotation_x/y/z` | inertiel |
| Cap | `heading`, `heading_accuracy` | orientation |
| Temps | `elapsed_ms`, `itow_ms` | horloge relative + GPS Time-Of-Week |
| Qualité GPS | `gps_fix`, `fix_valid`, `gps_accuracy_m`, `satellites`, `pdop`, `speed_accuracy` | fiabilité du point |
| Équipement | `battery_level` | état du boîtier au moment de la trame |

La trame brute n'est **jamais** affichée telle quelle au pilote. Elle est la matière première de l'analyse (`fetchSamplesFromFrames`, `analyzeSessionService.ts` L334). La fonction de purge `cleanup_old_telemetry_frames` existe déjà côté base — la rétention des trames brutes est donc déjà un sujet traité côté infra.

### 1.2 Session et tours — `telemetry_sessions`, `laps` (existent)

Agrégats dérivés par le pipeline, lisibles par le pilote :

| Donnée | Table.colonne | Sert |
|---|---|---|
| Vitesse max / moyenne session | `telemetry_sessions.max_speed_kmh`, `avg_speed_kmh` | Bilan, stats globales |
| G max latéral / longitudinal | `telemetry_sessions.max_g_lateral`, `max_g_longitudinal` | Bilan, évolution |
| Meilleur tour | `telemetry_sessions.best_lap_seconds` | Bilan, comparateur perso |
| Tours valides | `telemetry_sessions.n_valid_laps`, `lap_count` | comptage |
| Distance / durée | `distance_km`, `duration_seconds` | stats globales |
| Tour par tour | `laps.*` (`lap_number`, `duration_seconds`, `avg_speed_kmh`, `max_speed_kmh`, `is_outlap`, `is_inlap`) | vue Tours, échantillons vitesse (`fetchSpeedSamples`) |
| Météo session | `weather_snapshots` (existe) | contexte du Bilan |

Concepts capturés mais **dérivés**, pas stockés en colonne dédiée : **virages** (segmentation calculée, cf. §2), **moments marqués** (un marquage volontaire du pilote — fonctionnalité de marquage à câbler, table dédiée **nécessite accord**).

---

## 2. Données calculées (analyse)

Calculées après session par le pipeline `analyzeAndPersistSession` (`analyzeSessionService.ts`), best-effort et **jamais bloquant** : si l'analyse échoue, le Bilan s'ouvre quand même sur un fallback. Source des échantillons par ordre de priorité : `.ubx` local → `telemetry_frames` → (storage distant, V1.1). Downsample à 600 points pour l'analyse.

### 2.1 Par segment (virage) — `app_segment_analyses` (existe)

Produit par `analyzeTrackVizSession()`, persisté par `upsertSegmentAnalyses` (max ~14 segments/session, `algo_version = trackviz-v1.0`). Champs (cf. `segmentAnalysesService.ts` L18) :

| Famille | Champs |
|---|---|
| Identité segment | `segment_index`, `segment_name`, `kind`, `start_progress`, `end_progress`, `sample_count`, `duration_seconds` |
| Vitesses par virage | `entry_speed_kmh`, `apex_speed_kmh`, `exit_speed_kmh`, `min_speed_kmh`, `max_speed_kmh`, `avg_speed_kmh` |
| Sollicitations estimées | `max_g_lateral`, `max_g_braking` (freinage estimé), `max_g_accel` (accélération estimée) |
| Dispersion trajectoire | `avg_lateral_error_m`, `max_lateral_error_m` (écart à la trajectoire de référence) |
| Lecture | `margin_percent`, `margin_zone` (`green` / `yellow` / `red`) |

`aggregateSegmentStats()` agrège par virage la marge moyenne et la **distribution de zones** sur plusieurs sessions — usage pilote (soi vs soi) ou admin (`userId` omis → tous pilotes, réservé admin).

### 2.2 Session globale — `app_session_analyses` (existe)

Une ligne par session (`computeMargin` + `upsertAnalysis`) : **marge globale** (`margin_percent`, 0–100), marge véhicule, marge pilote, `debrief_text` (récit J+1). C'est le **chiffre dominant** du Bilan.

### 2.3 Lectures qualitatives — `session_insights` (existe)

Calculées **côté serveur** uniquement (edge function `compute-session-insights`) car la table est en écriture `service_role` (RLS). Champs vus : `n_laps`, `reference_laps`. Notions dérivées du dataset (constance, régularité, zones variables, dispersion) : ce sont des **lectures**, formulées sans jugement. La **régularité** alimente l'« indice de constance » de Progression (cf. `01 §Progression`).

### 2.4 Lexique de précision (à employer partout)

| Calcul | Statut | Mot juste |
|---|---|---|
| Freinage / accélération (`max_g_braking`, `max_g_accel`) | **estimé** depuis l'IMU | « freinage estimé », jamais « freinage mesuré » |
| Dispersion trajectoire (`*_lateral_error_m`) | écart à une **référence dérivée** | « dispersion », « régularité de trajectoire » |
| Marge (`margin_percent`) | indice composite | « marge », jamais « note », jamais « score de pilotage » |
| Zone (`margin_zone`) | seuil sur la marge | « à observer » (yellow/red côté pilote), « à conserver » (green) |

---

## 3. Le pilote — après session, neutre, un seul chiffre

**Quand.** Jamais en piste (§0). La donnée apparaît au retour aux stands : `pilotage-fini` → `bilan-pret` → `bilan`.

**Quoi.** Sa propre session, entière et détaillée. Le pilote est le seul à voir **toute** sa donnée brute lisible (Data Lab) et toutes ses analyses.

**Comment.**
- **Un seul chiffre dominant** par écran (la marge globale au Bilan ; au Data Lab, le chiffre central est celui de la sous-vue ouverte).
- **Divulgation progressive** : retenir → où regarder → pourquoi → détails techniques sur demande (`01 §Bilan`). Les sous-vues (Carte, Virages, Tours, Heatmap, Insights, Replay, Telemetry brute) sont **rangées** sous Data Lab, jamais en entrées parallèles (cf. `02_AUDIT_ROUTES`).
- **Formulation neutre, zéro conseil.** Deux constats max : « une zone à observer » / « une zone à conserver ». Questions ouvertes (« était-ce volontaire ? »). La **seule** zone prescriptive de l'écran est la bande coach (rouge), si et seulement si un coach affilié a annoté (§4).
- **Couleur.** L'or = la donnée (jauge, chiffres, barres). Le rouge = coach. Aucune couleur ne signifie « bien » ou « mal » en soi — `green`/`yellow`/`red` se lisent « à conserver » / « à observer », pas « réussi » / « raté ».

**Fallback data incomplète.** GPS dégradé (`gps_accuracy_m`, `fix_valid`, `satellites` faibles) ou analyse échouée : le Bilan reste ouvrable et indique calmement ce qui est préservé et ce qui manque — sans alarme, sans blâme.

**Ce que le pilote ne voit jamais :** la donnée d'un autre pilote (sauf comparaison **consentie** entre amis, cf. `cote-a-cote/[friendId]`), un classement, une note de performance.

---

## 4. Le coach — selon consentement, annotation, affiliés uniquement

**Quand.** Après session, comme le pilote. Jamais en temps réel.

**À qui.** Un coach ne lit **que** les sessions des pilotes qui lui sont **affiliés et consentants**. L'affiliation + consentement **BINAIRE existe déjà** : table `coach_pilots` + `pilot_consent_at`, gardés par `is_coach_of()` (cf. `05 §1.2`, `17 §0`). Seule la **granularité** (niveaux aucun / résumé / détaillé / complet — modèle binaire aujourd'hui, cf. `17 §2`) **nécessite accord**. Tant que le pilote n'a pas consenti, le coach ne voit rien de sa donnée piste.

**Quoi (selon le niveau accordé).** Lecture des analyses du pilote (marge globale, segments, tours), pour annoter. L'**annotation coach** s'appuie sur la table **`coach_annotations` qui EXISTE déjà** (cf. `17 §0`) et produit le contenu de la **bande coach** rouge du Bilan pilote. Reste à faire = l'**overlay UI** des notes sur la data (pas la table) ; toute extension de `coach_annotations` **nécessite accord**.

**Limites doctrinales propres au coach.**
- La bande coach est le **seul** espace où une formulation peut orienter — et même là, on privilégie la **question ouverte** (`04_DESIGN_CANON §Bande coach` : citation Instrument Serif, eyebrow « DE VOTRE COACH »).
- **Pas de coaching live.** Aucune donnée n'est poussée au coach pendant que le pilote roule.
- Le coach ne voit **aucun** pilote hors de son périmètre affilié — pas de vue « tous les pilotes du circuit ».

---

## 5. L'admin — qualité data, équipement, agrégé

**Quoi.** L'admin voit le **système**, pas l'intime du pilotage. Trois objets :

1. **Qualité de la donnée.** Indicateurs de fiabilité issus des trames : `gps_fix`/`fix_valid`, `gps_accuracy_m`, `satellites`, `pdop`, complétude (frames manquantes), proportion de sessions analysables. Sert l'écran admin **`qualite-data`** (net-neuf, cf. `02_AUDIT §Admin`).
2. **État équipement.** `battery_level`, présence/absence de signal, sessions sans trames — pour le suivi des boîtiers RaceBox. Un registre d'équipements **nécessite accord** s'il faut une table dédiée.
3. **Agrégé.** `aggregateSegmentStats()` **sans `userId`** (tous pilotes) pour inspecter la richesse des données par virage sur un circuit, sans descendre au pilote nommé dès que la granularité fine n'est pas nécessaire.

**Limite.** L'admin n'a pas vocation à lire la donnée d'un pilote **comme un coach** (pas d'annotation, pas de lecture intime), sauf nécessité opérationnelle explicite (support, incident) — la portée exacte des droits admin sur la télémétrie nominative **nécessite accord** et sera fixée dans `05_ROLES_PERMISSIONS.md`.

---

## 6. Le partenaire — jamais de télémétrie individuelle

**Règle absolue.** Un partenaire ne voit **jamais** la donnée piste d'un pilote identifiable. Ni trajectoire, ni vitesse, ni marge, ni tour, ni virage — aucune ligne de `telemetry_frames` / `telemetry_sessions` / `app_*_analyses` nominative.

**Ce qu'un partenaire peut voir (V1.5, espace net-neuf `app/(partner)`) :** des **statistiques anonymisées et agrégées** autour des événements — volume de pilotes présents, fréquentation, tendances de participation, performance de ses offres/leads. Jamais une donnée ré-identifiable (seuils d'agrégation minimaux à fixer). Tout schéma partenaire **nécessite accord**.

---

## 7. Limites doctrinales (récapitulatif opposable)

| # | Limite | Conséquence concrète |
|---|---|---|
| 1 | Pas de donnée en piste | Aucun rendu pendant `roulage` ; analyse et affichage **après** seulement |
| 2 | L'estimation reste estimation | `max_g_braking`/`max_g_accel` = « freinage/accélération **estimé** » ; `margin_percent` = lecture, pas verdict |
| 3 | Pas de note de performance | `margin_percent` n'est jamais présenté comme un score ; pas de note /20, pas d'étoiles |
| 4 | Pas de classement | Aucun leaderboard ; comparaison uniquement **soi vs soi** ou **consentie** entre amis |
| 5 | Zéro prescriptif côté pilote | Sous-vues Data Lab et Bilan : « à observer », « était-ce volontaire ? » — jamais « corrigez/freinez/erreur » |
| 6 | Coach borné | Lecture **selon consentement**, **affiliés seulement**, pas de live, bande coach = seul espace orientant |
| 7 | Partenaire aveugle à l'individuel | Uniquement stats anonymisées agrégées |
| 8 | Couleur sémantique | Or = donnée · rouge = coach/REC · `green/yellow/red` = « à conserver / à observer », pas « bien / mal » |
| 9 | Schéma sous accord | Toute table nouvelle (consentement coach, notes coach, équipements, partenaire, marquage de moments) est **à soumettre à Gabin** |

---

## 8. Tables — état réel et ce qui reste à arbitrer

| Table | Statut | Rôle |
|---|---|---|
| `telemetry_frames` | **existe** | trame brute haute fréquence (non affichée brute au pilote) |
| `telemetry_sessions` | **existe** | session agrégée |
| `laps` | **existe** | tour par tour |
| `weather_snapshots` | **existe** | contexte météo session |
| `app_segment_analyses` | **existe** | analyse par virage (vitesses, G estimés, dispersion, marge/zone) |
| `app_session_analyses` | **existe** | marge globale + debrief J+1 |
| `session_insights` | **existe** | lectures qualitatives (écriture serveur seule) |
| Affiliation + consentement coach↔pilote (binaire) | **existe** (`coach_pilots` + `pilot_consent_at`) | seuls les **niveaux** granulaires du §4 nécessitent accord |
| Table d'annotations coach | **existe** (`coach_annotations`) | reste : l'overlay UI ; toute extension nécessite accord |
| Registre équipements RaceBox | **nécessite accord** | suivi état boîtiers (§5) |
| Marquage de « moments » par le pilote | **nécessite accord** | §1.2 |
| Schéma partenaire (stats agrégées) | **nécessite accord** | §6 |

Les droits ligne-à-ligne (RLS) qui matérialisent les §3–6 sont spécifiés dans `05_ROLES_PERMISSIONS.md` ; les RLS déjà en place sont dans `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`. **Aucune** policy ni migration n'est créée sans accord explicite de Gabin.
