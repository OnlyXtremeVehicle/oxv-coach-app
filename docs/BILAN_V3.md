# Bilan du programme V3

**29 juillet 2026.** Branche `migration/sdk-55`.

Livrable exigé par `docs/programme-v3/OXV_Mirror_V3_Plan_Montage.md`, section
« ACCEPTATION FINALE ».

---

## Ce que ce document est, et ce qu'il n'est pas

Le plan demande quatre choses : l'état des quatre-vingt-un écrans, le résultat
des treize vérifications sur appareil, ce qui reste bloqué par une dépendance
externe, et ce qui n'a jamais pu être testé faute de données réelles.

**Trois des quatre sont renseignées ici. La première l'est désormais en partie.**
L'inventaire avait été rendu à l'échelle du LOT, pas de l'écran. La passe dédiée
a été faite le 29/07 pour **l'arbre V1 seul** — les 71 écrans de `app/(app)`,
classés un par un dans [`J5_ARBRE_V1.md`](J5_ARBRE_V1.md). Les autres groupes
n'ont toujours pas d'inventaire écran par écran.

Et le nombre de quatre-vingt-un est à corriger : `app/` contient **205 fichiers
de route** hors layouts, répartis en neuf groupes — 71 en `(app)`, 40 en
`(app2)`, 36 en `(coach)`, 30 en `(admin)`, le reste en `(partner)`, `(pro)`,
`(auth)` et les deux onboardings. Le chiffre du plan compte les écrans SPÉCIFIÉS,
pas les fichiers existants.

Et il faut redire ce que le plan met en dernière ligne :

> **Rien n'a jamais tourné.** Toute affirmation sur le comportement réel est une
> lecture de code, jamais une observation.

---

## 1 · L'état par jalon

| | Jalon | État | Ce qui reste |
|---|---|---|---|
| 0 | Ce qui bloque tout | **Satisfait** | voir §2 — la sauvegarde n'était pas en jeu |
| 1 | Technique | **Fait** sauf T2 | ThumbHash proposé, non appliqué |
| 2 | Socle produit | **Fait** | SEC-3 et l'option B appliqués en production |
| 3 | Le jour J | **Logiciel fait** | terrain non vérifié — aucun build n'existe |
| 4 | La restitution | **Largement fait** | voir §3 |
| 5 | Les espaces | **Non commencé** | sept arbitrages fondateur en tête de chaîne |
| 6 | Coach | **Non commencé** | préalable `L27bis` non signé |
| 7 | Admin et partenaires | **Non commencé** | — |
| 8 | Innovations et serveur | **Non commencé** | le plan le dit lui-même : « peut attendre » |

---

## 2 · Le jalon 0, et une correction au plan

Le plan place `git push` en tête du graphe de dépendances : *« absolument
tout »* en dépend, et le qualifie de « absolument bloquant ».

**La sauvegarde n'était pas en jeu.** `main` porte soixante-huit commits non
poussés, mais `main` est un ANCÊTRE de `migration/sdk-55`, qui est poussée chez
GitHub. Le contenu est donc à l'abri depuis longtemps.

Ce qui reste est de la tenue de dépôt : `origin/main` pointe sur un état
ancien. Avancer la branche par défaut de deux cent quarante-huit commits est
une décision de publication, pas une sauvegarde — et elle vous revient.

Le balayage de secrets exigé par le plan a été exécuté sur ces soixante-huit
commits : aucune clé, aucun jeton, aucune coordonnée bancaire. Les seules
correspondances sont des mentions du mot `service_role` dans des commentaires et
des migrations. Le `.gitignore` couvre `.env*`, `*.p8`, `*.p12` et les profils
de provisionnement.

---

## 3 · Le jalon 4 — la restitution

### Livré

| Lot | Où |
|---|---|
| Banque de calculs, neuf modules | `src/telemetry/` |
| Étiquetage [M] / [D] / [I], registre confronté par test | `src/telemetry/provenance.ts` |
| Les cinq niveaux de restitution | `src/telemetry/niveaux.ts` |
| Courbe de delta, Skia, virages nommés | `src/components/telemetry/CourbeDelta.tsx` |
| Bande — *functional boxplot* en base distance | `src/telemetry/bande.ts` + `BandeTours.tsx` |
| Bascule superposition → bande | `SectionBande.tsx` |
| Huitième ancre de la Séance | `app/(app2)/data/session/[id].tsx` |
| **Fusion hub Data → Saison** | `src/features/data/saison/SaisonSections.tsx` |

La fusion supprime `app/(app2)/data/saison.tsx` — treize cents lignes que
**aucune route du dépôt n'atteignait**. Ses quatre lectures ouvrent désormais le
hub, séparées de la liste des séances par une rupture de fond pleine largeur.
Elle solde à elle seule cinq entrées d'inventaire, comptées dans deux jalons.

### Reste

| Lot | Ce qui bloque |
|---|---|
| *Curve boxplot* pré-calculé serveur | données réelles + travail serveur |
| Énergie de freinage | masse du véhicule — proposition écrite |

### Les quatre lots « rien ne bloque » — faits le 13/08/2026

Ils portaient tous les quatre la mention « rien ne bloque ». Rien ne les
bloquait, en effet ; ils attendaient d'être écrits.

| Lot | Ce qui a été fait | Ce que la mesure a montré |
|---|---|---|
| **Bandes de saison en rampe séquentielle** | `src/features/data/saison/rampeEcarts.ts` — premier appelant de `src/render/ramp.ts` | L'histogramme peignait ses cinq seaux d'UNE seule teinte alors que l'axe porte un ordre. `ramp.ts` — interpolation Oklab écrite et testée depuis le socle T1 — n'avait **aucun appelant**, pas plus que `ribbon.ts` à côté |
| **Petits multiples / sparklines** | `petitsMultiplesLogic.ts` + `PetitsMultiples.tsx`, section « SÉANCE PAR SÉANCE » du hub Data | « Les primitives existent » était vrai et trompeur : `normalizeSparkline` échelonne **série par série**. Réutilisée telle quelle, elle aurait produit des vignettes auto-échelonnées — deux séances de rythmes éloignés y dessinent la même courbe |
| **Le carnet en section séparée** | `vous/carnet` → `data/carnet`, logique comprise ; VOUS passe de sept portes à six | Un seul lien entrant. Le déplacement tenait en une ligne de tableau depuis des semaines |
| **Strip map** | `stripMapLogic.ts` + `StripMap.tsx`, en tête de la section DELTA dont il devient la règle | « Tout est à écrire » était faux : `app_segment_analyses` portait déjà position curviligne, genre, nom et grandeurs par segment. Il manquait le développement linéaire, pas la donnée |

Trois honnêtetés posées au passage, chacune vérifiée par test plutôt
qu'affirmée en commentaire : l'échelle commune des petits multiples est
**mesurée** sur les ordonnées écrites dans le chemin ; la couverture du strip
map est l'**union** des intervalles, jamais leur somme ; le signe des G a été
**confronté aux deux écrivains** (`captureFrameMapping` et `trackviz/analysis`)
avant de dessiner une barre.

### Acceptation du jalon 4

1. **Le delta cumulé se referme à zéro — FAIT**, et depuis les trames réelles, pas seulement des séries fabriquées.
2. Centile 95 du rendu Saison — **appareil requis**.
3. Mémorisation de position au retour de feuille — **appareil requis**. Note : elle tient aujourd'hui par effet de bord, `Sheet` n'étant pas une modale native. Rien ne la protège si une lecture devient une route.
4. Six lectures sur six en `absent` — **FAIT** (`src/components/insights/disponibilite.ts`).
5. Seuil réel de bascule superposition-bande — **convention posée à 24, mesure terrain requise**.

---

## 4 · Ce qui est bloqué par une dépendance externe

| Origine | Ce qui attend |
|---|---|
| **SIRET** | encaissement coach, Tap to Pay, tunnel de paiement |
| **Site** | réservation transmise, `registrations.status`, numéro de voiture, les 43 journées |
| **Avocat** | décharge, pacte mutuel, charte coach, mandat d'encaissement |
| **Terrain** | `corners-v1` Valence et Charente, séance de télémétrie dense, **les noms officiels des virages** |
| **Build natif** | toutes les vérifications sur appareil ; aucun build n'existe |
| **Accord fondateur** | trois propositions de schéma écrites, non appliquées ; sept arbitrages sur les orphelins V1 |

---

## 5 · Ce qui n'a jamais pu être testé faute de données réelles

C'est la section la plus importante, et la plus courte à écrire.

**Production, au 29 juillet 2026 :**

- **53 trames** de télémétrie, toutes sur une séance qui ne porte aucun tour ;
- **1 ligne** de tours, sur une séance qui ne porte aucune trame — un
  `is_outlap` de **0,022 seconde à 1,39 km/h sur zéro mètre** ;
- 18 séances, dont 17 sans une seule trame ;
- **zéro** donnée cardiaque, **zéro** annotation de coach, **zéro** compte coach,
  **zéro** boîtier en flotte.

**Aucune séance ne porte à la fois des trames et un tour.** Toute la chaîne de
restitution rendra donc son absence, avec sa raison — ce qui est le
comportement voulu, et ne prouve rien sur son comportement avec de la donnée.

Les 53 trames portent une vitesse de lacet entre 0,84 et 0,90 °/s, soit une
courbure d'environ 0,0005 /m à 30 m/s : c'est une capture à l'arrêt. Le niveau
« phases du virage » s'affichera fermé sur ce jeu, **légitimement** — et non
parce que le canal serait coupé, ce qu'il était jusqu'à ce matin.

En conséquence directe : **toutes les mesures des jalons 1 et 4 portent sur des
données synthétiques.** Les 2 430 tests passent sur des séries fabriquées à la
main, dont on connaît la réponse.

---

## 6 · Le motif qui domine le dépôt

Neuf cas trouvés cette semaine, tous de la même forme : **une garde existe, elle
ne se déclenche pas, et un document affirme qu'elle le fait.**

- une garde multi-circuit montée 0 fois sur 11 ;
- un scanner d'accessibilité limité à `app/` ;
- un scanner doctrinal aveugle à `src/` ;
- un `.gitignore` ancré sur des dossiers absents ;
- une fonte nommée, jamais chargée ;
- un `DemoBanner` défini et monté nulle part ;
- le déclencheur de SEC-2, privé de sa colonne — **une escalade de privilège réelle**, corrigée le 28/07 ;
- `kinematics.origines`, rempli et lu nulle part ;
- **le gyroscope écrit en base et jeté à la lecture** — la colonne `rotation_z` n'était dans aucun `select`.

Et un dixième, le plus net : `TelemetrieSection` portait en tête
« Chargement PARESSEUX unique » au-dessus d'un effet qui partait au montage.

Quand un commentaire décrit une garde, la vérifier vaut mieux que le croire.

---

## 7 · Ce qui vous revient

**Trois propositions de schéma** restent écrites et non appliquées :

- `PROPOSITION_L21s_drop_duels.sql` — la table porte l'idée d'un vainqueur ; zéro ligne, zéro lecteur. **Destructive : tenue par la règle 0.5**, pas de suppression avant sauvegarde vérifiée ;
- `PROPOSITION_L10_purge_completude.sql` ;
- `PROPOSITION_L21_consentement_premiere_fois.sql`.

Les cinq autres ont été **appliquées en production le 29/07**, sur votre décision
« les additives, pas les destructives » : `d1_is_coach_of_exige_le_role`,
`l18_vehicules_is_primary_et_masse`, `l21j_fuseau_horaire_pilote`,
`t2_thumbhash_session_media`, `l27bis_creneau_en_attente_de_validation`.
La première fermait une faille réelle : `is_coach_of()` ne vérifiait pas
`users.role`.

**Sept arbitrages** sur l'arbre V1 : ils sont désormais posés sur pièces dans
[`J5_ARBRE_V1.md`](J5_ARBRE_V1.md), avec pour chaque écran sa taille, ses entrées
et son équivalent. Le lot 21 — **71 écrans et 35 488 lignes**, mesurés — attend
ces sept décisions. Le chiffre de 77 routes / 37 551 lignes annoncé plus haut
dans la semaine était une estimation ; celui-ci est un comptage.

Ce classement a produit **deux blocages** qui ne se règlent pas en supprimant des
fichiers : l'écriture d'intention disparaîtrait de toute l'application, et
`app/(pro)` retient l'arbre par neuf liens et cinq `AccountButton`.

**Une décision de publication** : avancer `origin/main`, ou non.

**La question de fond posée par ce bilan est tranchée** : l'inventaire écran par
écran a été produit, pour l'arbre V1. Reste à décider s'il faut le même travail
sur les huit autres groupes — 134 écrans de plus.
