# Bilan du programme V3

**29 juillet 2026.** Branche `migration/sdk-55`.

> ## ⚠ CE DOCUMENT ÉTAIT FAUX SUR QUATRE POINTS — CORRIGÉ LE 14/08/2026
>
> Il est le livrable d'ACCEPTATION FINALE : c'est sur lui que le fondateur
> arbitre. Il portait, depuis le 29 juillet, quatre affirmations que le terrain
> a démenties — et sa seule retouche depuis (13/08) n'avait rouvert aucune des
> sections concernées.
>
> | Ce qu'il disait | Ce qui est vrai |
> |---|---|
> | « aucun build n'existe » | le build 36 a tourné sur iPhone le **03/08** |
> | « Aucune séance ne porte à la fois des trames et un tour » | **une** en porte, avec 27 052 trames, depuis le **13/08** |
> | jalons 5, 6, 7 « Non commencé » | le 5 est **clos**, le 6 fait aux trois quarts, le 7 largement monté |
> | « trois propositions de schéma » | il y en a **cinq** |
>
> Les chiffres du 29/07 sont CONSERVÉS ci-dessous, datés : ils sont le constat
> d'avant l'essai terrain, et c'est leur valeur. Ce qui a changé est marqué.
>
> **Provenance des chiffres du 14/08** : relevé adversarial de soixante-huit
> agents sur le dépôt et les migrations, chaque verdict soumis à un réfutateur.
> L'accès SQL à la production m'étant refusé ce jour-là, les nombres de
> production sont ceux du **13/08**, mesurés en base, et attribués comme tels.

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

Et le nombre de quatre-vingt-un est à corriger : `app/` contenait **205 fichiers
de route** hors layouts, répartis en neuf groupes — 71 en `(app)`, 40 en
`(app2)`, 36 en `(coach)`, 30 en `(admin)`, le reste en `(partner)`, `(pro)`,
`(auth)` et les deux onboardings. Le chiffre du plan compte les écrans SPÉCIFIÉS,
pas les fichiers existants.

> **RECOMPTÉ LE 14/08 : 138 fichiers de route.** L'arbre V1 est parti — 71
> écrans, 35 488 lignes, commit `2e52f26`. Le reste : 44 en `(app2)`, 35 en
> `(coach)`, 31 en `(admin)`, 8 en `(partner)`, 7 en `(pro)`, 6 en
> `(onboarding)`, 2 en `(auth)`.
>
> Le renvoi à `J5_ARBRE_V1.md` ci-dessus décrit donc un inventaire d'écrans qui
> n'existent plus. Il garde sa valeur d'archive, pas d'état.

Et il faut redire ce que le plan mettait en dernière ligne :

> **Rien n'a jamais tourné.** Toute affirmation sur le comportement réel est une
> lecture de code, jamais une observation.

> **CETTE PHRASE A CESSÉ D'ÊTRE VRAIE LE 3 AOÛT**, et c'est le fait le plus
> important de ce document. Un build a tourné sur un iPhone ; une séance a été
> captée sur un circuit le 13. La vérification terrain a produit **treize
> défauts** que quatre semaines de lecture de code n'avaient pas vus — dont un
> qui empêchait TOUTE séance captée par l'application de se clore, et un autre
> qui tuait l'application à chaque ouverture de l'écran Data.
>
> Ce qui reste non observé est désormais nommé, et court : la capture écran
> verrouillé, le seuil de bascule superposition → bande, et les treize
> vérifications d'ergonomie sur appareil, dont **une seule** porte un résultat.

---

## 1 · L'état par jalon

| | Jalon | État | Ce qui reste |
|---|---|---|---|
| 0 | Ce qui bloque tout | **Satisfait** | voir §2 — la sauvegarde n'était pas en jeu |
| 1 | Technique | **Fait**, T2 compris | ThumbHash : migration appliquée, fonction Edge ACTIVE depuis le 03/08, quatre écrans passent la prop. Ce qui manque n'est pas le code — c'est une image : `session_media` compte zéro ligne |
| 2 | Socle produit | **Fait** | SEC-3 et l'option B appliqués en production |
| 3 | Le jour J | **éprouvé au terrain** | build 36 sur iPhone le 03/08, séance captée à Bouteville le 13/08. Treize défauts trouvés et réparés — plus que quatre semaines de lecture |
| 4 | La restitution | **Largement fait** | voir §3 |
| 5 | Les espaces | **FAIT le 14/08** | l'arbre V1 est supprimé (`2e52f26`) ; le dernier verrou, le vocabulaire technique, est tombé aujourd'hui |
| 6 | Coach | **fait aux trois quarts** | onze lignes sur quatorze livrées ; voir [POINT_JALON_6](POINT_JALON_6_2026-08-14.md) |
| 7 | Admin et partenaires | **largement monté** | 31 écrans `(admin)` et 8 `(partner)` existent et sont atteignables. Ce qui manque est de la substance, pas des écrans |
| 8 | Innovations et serveur | **partiel** | « pourquoi ce chiffre est absent » est livré ; la mémoire du circuit attend des saisons ; iOS attend du Swift |

> Les mentions « sept arbitrages fondateur » et « préalable `L27bis` non signé »
> ont été retirées : le premier portait sur un arbre supprimé depuis, et le
> second se contredisait dans ce fichier même — la ligne 45 le disait non signé
> quand la ligne 202 le listait parmi les migrations appliquées le 29/07.

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
| **Build natif** | ~~aucun build n'existe~~ → le build 36 a tourné le **03/08**. Ce qui reste : le quota EAS iOS est épuisé jusqu'au 1er septembre, donc plan payant ou compilation Xcode locale |
| **Accord fondateur** | **cinq** propositions de schéma écrites, non appliquées — pas trois : purge RGPD des 55 couples, les trois énumérations partenaires, `payment_link` + `coach_testimonials`, publication realtime, `mark_attendance`. ~~sept arbitrages sur les orphelins V1~~ : sans objet, l'arbre est supprimé |
| **Compte coach** | **zéro** compte `role='coach'` en production, alors que `coach_profiles` porte une ligne depuis le 07/07. Deux critères d'acceptation du jalon 6 sur quatre restent invérifiables |
| **Déploiement Supabase** | `ritual_dispatcher` — le correctif météo du 13/08 n'est pas en ligne. Geste réservé au fondateur : la fonction écrit à de vrais clients |

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

> ### ⚠ CETTE PHRASE EST FAUSSE DEPUIS LA NUIT DU 13 AOÛT
>
> | | 29/07 | 13/08 |
> |---|---:|---:|
> | Trames de télémétrie | 53 | **27 052** |
> | Tours | 1 (un `is_outlap` de 0,022 s) | **4**, dont 3 réels |
> | Séances portant trames **et** tours | 0 | **1** |
> | Trames avec vitesse de lacet | 0 | **27 052** |
> | Trames avec les deux accélérations | 0 | **27 052** |
>
> Les trois tours de Bouteville — 5 875,5 / 5 873,7 / 5 874,7 m, mesurés par
> deux méthodes indépendantes qui concordent à 1,4 m — sont la première donnée
> réelle que cette application ait produite.
>
> **Quatre des cinq niveaux de restitution s'ouvrent** sur cette séance. Le
> cinquième reste fermé pour une raison qui vous revient : `laps.distance_meters`
> est vide sur ces trois tours, et se rattrape en une commande
> (`scripts/sql/backfill_laps_distance.sql`).

Les 53 trames portent une vitesse de lacet entre 0,84 et 0,90 °/s, soit une
courbure d'environ 0,0005 /m à 30 m/s : c'est une capture à l'arrêt. Le niveau
« phases du virage » s'affichera fermé sur ce jeu, **légitimement** — et non
parce que le canal serait coupé, ce qu'il était jusqu'à ce matin.

En conséquence directe : **toutes les mesures des jalons 1 et 4 portent sur des
données synthétiques.** Les 2 430 tests passent sur des séries fabriquées à la
main, dont on connaît la réponse.

> **Plus vrai depuis le 13/08.** Plusieurs tests rejouent désormais les vrais
> tours de Bouteville, chiffres en dur, et c'est ainsi qu'on a trouvé qu'une
> même grandeur — la constance — vivait en DEUX formules, l'une rendant 34 et
> l'autre 0 sur les mêmes trois tours.
>
> Le compte de tests au 14/08 : **3 326**.

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

**Cinq propositions de schéma** restent écrites et non appliquées — le compte
de trois ci-dessous datait du 29/07 et deux se sont ajoutées depuis (les trois
énumérations partenaires, `payment_link` + `coach_testimonials`). Toutes sont à
zéro perte : les tables visées portent zéro ligne, et la fenêtre pour trancher
est maintenant, avant qu'un vrai pilote n'y écrive.

Les trois du 29/07 :

- `PROPOSITION_L21s_drop_duels.sql` — la table porte l'idée d'un vainqueur ; zéro ligne, zéro lecteur. **Destructive : tenue par la règle 0.5**, pas de suppression avant sauvegarde vérifiée ;
- `PROPOSITION_L10_purge_completude.sql` ;
- `PROPOSITION_L21_consentement_premiere_fois.sql`.

Les cinq autres ont été **appliquées en production le 29/07**, sur votre décision
« les additives, pas les destructives » : `d1_is_coach_of_exige_le_role`,
`l18_vehicules_is_primary_et_masse`, `l21j_fuseau_horaire_pilote`,
`t2_thumbhash_session_media`, `l27bis_creneau_en_attente_de_validation`.
La première fermait une faille réelle : `is_coach_of()` ne vérifiait pas
`users.role`.

~~**Sept arbitrages** sur l'arbre V1~~ — **SANS OBJET DEPUIS LE 29/07.**

L'arbre a été supprimé : commit `2e52f26`, *« l'arbre V1 quitte
l'application »*. Les 71 écrans et 35 488 lignes n'existent plus, et les deux
blocages que ce classement avait produits ont été traités avant la suppression :
l'écriture d'intention a été réhébergée dans `rec/fin` (`dbad829`), et les liens
de `app/(pro)` recâblés.

> Cette ligne a coûté cher : le 13 août, j'ai annoncé au fondateur que le jalon 5
> attendait « sept arbitrages » et « un lot de 71 écrans », en relisant ce
> document au lieu de lancer `ls app/`. **C'est le défaut que ce dépôt corrige,
> appliqué à celui qui le corrige.**

**Une décision de publication** : avancer `origin/main`, ou non.

**La question de fond posée par ce bilan est tranchée** : l'inventaire écran par
écran a été produit, pour l'arbre V1. Reste à décider s'il faut le même travail
sur les huit autres groupes — 134 écrans de plus.

> **Recompté le 14/08 : 138 fichiers de route au total**, l'arbre V1 étant parti.
> L'inventaire restant porterait donc sur ces 138, pas sur 134 « de plus ».

---

## 8 · Ce que le 14 août a corrigé dans ce document

Quatre affirmations, listées en tête. Elles avaient toutes la même forme : un
document relu au lieu d'être remesuré.

C'est le motif décrit au §6 — *la garde posée, non armée* — dans sa variante
documentaire. Le code affirme quelque chose que la production dément ; ici, le
bilan affirmait quelque chose que le dépôt démentait, et la vérification tenait
à chaque fois en une commande.

**La règle qui en sort, et qui vaut pour la suite : aucun état ne se recopie
d'un document à l'autre. Il se remesure, ou il se date.**
