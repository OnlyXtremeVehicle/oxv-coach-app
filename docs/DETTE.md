# Dette — défauts constatés hors du périmètre du lot en cours

Règle de travail V3 : _« Ne jamais élargir le périmètre d'un lot. Si un défaut apparaît hors périmètre, le consigner ici et continuer. »_

Chaque entrée porte son fichier, sa ligne, et le lot qui la traitera. Rien n'est corrigé ici.

---

## D-1 · Un coach rétrogradé conserve l'accès aux données — **côté app CLOS, RLS en attente d'accord**

**Mis à jour le 27/07/2026.** Deux corrections à ce qui suit.

**La cause n'était pas celle décrite.** La fiche affirmait que `is_coach_of()` ne
vérifie pas `active`. C'est faux : elle le vérifie, ainsi que `pilot_consent_at`.
Le seul chaînon manquant est **`users.role`**. Le trou venait de l'autre bout —
`demoteToPilot` n'écrivait que le rôle, laissant les affiliations `active = true`,
que `is_coach_of` acceptait donc sans broncher.

**Le vrai coupable était un commentaire.** `demoteToPilot` affirmait que « les
assignations deviennent dormantes […] la double-protection RLS tient ». Rien ne
mettait `active` à false. Le code décrivait une protection inexistante : qui le
relisait repartait rassuré. C'est ainsi que le défaut a survécu à ses relectures.

**Fait** : `demoteToPilot` coupe désormais les affiliations **avant** de changer
le rôle, et refuse de rétrograder si cette coupure échoue — sans transaction
depuis le client, l'état intermédiaire doit échouer FERMÉ. Trois tests fixent le
comportement, l'ordre et le refus.

**Reste** : la RLS. Tant que `is_coach_of` ignore `users.role`, la sécurité
repose sur la discipline de chaque écrivain du rôle — un `UPDATE` depuis le SQL
Editor rouvrirait le trou. La migration est écrite et **non appliquée** :
`supabase/migrations/PROPOSITION_D1_is_coach_of_role.sql`. Elle touche le schéma
de production, donc elle attend votre accord. Elle contient aussi la requête de
comptage des lignes déjà désaccordées, et le rattrapage à décider séparément.

---

## D-1 (constat d'origine, conservé)

**Constaté le 27/07/2026, jalon 0.1.**

`demoteToPilot` n'écrit pas `active = false` sur `coach_pilots` : zéro occurrence de `active` dans son corps. L'affiliation survit à la rétrogradation, et `is_coach_of()` ne vérifie pas non plus `users.role`.

**Portée** : un compte passé de `coach` à `pilot` continue de lire les séances, les tours et les bilans de ses anciens pilotes au niveau de la base. La RLS ne s'y oppose pas.

**Aggravation depuis le 27/07** : `docs/ETAT_COMPLET_APP_2026-07-26.md:5420` décrit ce défaut, et le dépôt est **public**. La description est en ligne, le défaut est ouvert.

**Traité par** : phase 2, lot 9 — « coach rétrogradé, rétrogradation par validation, suspension sans effet ».

---

## D-2 · `.gitignore` — les gardes existaient, ancrées à des chemins inexistants — **CLOS**

**Mis à jour le 27/07/2026.** Correction à ce qui suit : les quatre gardes
dites « absentes » ÉTAIENT présentes, mais écrites `ios/*.mobileprovision`,
`android/app/google-services.json`, `android/app/*.keystore`. Or ce projet ne
contient NI `ios/` NI `android/` — le natif est généré au build par prebuild.
Elles ne couvraient donc rien.

Éprouvé plutôt que déduit : avant correction, `git check-ignore` laissait passer
les quatre déposés à la racine. Après, huit chemins d'épreuve sont couverts, y
compris profonds.

**Aucune fuite, ni maintenant ni jamais** — vérifié sur l'index ET sur tout
l'historique (`git log --all --diff-filter=A`). Les motifs sont désormais GLOBAUX,
et `*.jks` a été ajouté au passage.

---

## D-2 (constat d'origine, conservé)

**Constaté le 27/07/2026, jalon 0.1, étape 3.**

Couverts : `.env`, `.env.local`, `*.p8`, `*.p12`.
**Non couverts** : `google-services.json`, `GoogleService-Info.plist`, `*.mobileprovision`, `*.keystore`.

**Aucun fichier de ce type n'est suivi aujourd'hui.** Il n'y a pas de fuite — seul `.env.example` est suivi, ce qui est sa fonction. Mais la garde n'existe pas : sur un dépôt public, un fichier de signature déposé dans l'arbre partirait au prochain `git add` sans que rien ne l'arrête.

**Traité par** : à rattacher au premier lot qui touche la configuration de projet. Correctif d'une ligne.

---

## D-3 · Deux documents publiés affirment un état de sécurité périmé — **CLOS**

**Corrigé le 27/07/2026**, après avoir VÉRIFIÉ que SEC-2 est bien appliqué :
`supabase/migrations/20260726152049_sec2_guard_is_admin.sql` est dans les
migrations appliquées et `migrations_a_valider/` est vide. Sans cette
vérification, j'aurais pu transformer un avertissement juste en fausse
assurance — le sens le plus dangereux de l'erreur.

`ETAT_COMPLET_APP_2026-07-26.md` porte un encadré de correction, le texte
d'origine conservé au passé : effacer un constat efface la mémoire de ce qui a
été corrigé. `BILAN_COMPLET_OXV.md` (à la RACINE, pas dans docs/) porte une note
expliquant que le hit existe, qu'il s'agit de la clé anon publique, et que ce
qui est corrigé est l'affirmation, pas un risque.

---

## D-3 (constat d'origine, conservé)

**Constaté le 27/07/2026, jalon 0.1, étape 3.**

`BILAN_COMPLET_OXV.md` affirme « JWT anon en dur repo entier | Aucun (`eyJhbGciOi` : 0 hit) ». Vrai à la rédaction, **faux depuis la reconstitution des 94 migrations** : `supabase/migrations/20260718133742_fix_relay_validate_inscription_jwt.sql:35` en porte un. Il s'agit de la clé anon, publique par construction — l'affirmation est fausse, la situation reste saine.

~~`docs/ETAT_COMPLET_APP_2026-07-26.md:18` et `:1369` décrivent l'élévation de privilège `is_admin` comme **ouverte en production**, avec le détail de son exploitabilité. **Elle a été fermée par SEC-2 le 26/07.** Le document n'a pas suivi.~~

> **RECTIFIÉ LE 28/07/2026. Le paragraphe barré ci-dessus était faux, et c'est moi qui l'ai écrit.**
>
> La faille est **toujours ouverte**. Le document d'état avait raison ; c'est ma rectification du 27/07 qui se trompait.
>
> Mon raisonnement d'alors : la migration `20260726152049_sec2_guard_is_admin.sql` figure dans les migrations appliquées, donc le correctif est en place. **J'ai confondu « appliquée » et « effective ».**
>
> La migration exécute `create or replace function guard_users_privileged_columns()` — le corps couvre bien `is_admin`. Mais elle ne recrée jamais le DÉCLENCHEUR, qui date du 20/06 et se lit encore `BEFORE UPDATE OF role, kyc_status`. `is_admin` n'y figure pas, et `UPDATE OF <liste>` ne déclenche que si une colonne de la liste est au `SET`. La garde est inerte depuis le jour de sa pose.
>
> Le protocole de SEC-2 prévoyait deux contrôles. Le premier, sur la définition de la fonction, passe et ne prouve rien. Le second — tenter l'écriture depuis une session pilote — l'aurait attrapé. C'est celui qui n'a pas été fait, et c'est le seul qui prouvait quelque chose.
>
> **C'est le même motif que tout ce que ce dépôt m'a appris ce mois-ci** : une garde présente et non armée, doublée d'un document qui affirme un accord rompu. Cette fois le document était le mien.
>
> Atténuation factuelle : le déclencheur d'audit de la même migration est, lui, correctement armé (`after update on public.users`, sans liste). `admin_audit` ne porte **aucune** ligne `user_is_admin_change` depuis le 26/07, et un seul compte a `is_admin = true` — `administration@oxvehicle.fr`, depuis le 17/06, légitimement. Rien n'indique une exploitation. Avant le 26/07 il n'y avait pas d'audit : rien ne peut en être dit.
>
> **CORRIGÉ le 28/07/2026** — migration `20260728161300_sec3_garde_is_admin_et_l8_role_autorite.sql`, appliquée sur accord explicite du fondateur. Le déclencheur est recréé **sans clause `OF`** : aucune colonne privilégiée ne pourra plus lui échapper par omission. Et `is_admin()` ne consulte plus la colonne, désormais annotée INERTE.
>
> **Ce qui reste à faire, et qui seul prouve quelque chose** : depuis une session pilote réelle, `update public.users set is_admin = true where id = auth.uid()` doit échouer avec 42501. La console SQL tourne en `postgres`, exemptée — elle ne prouverait rien. C'est le contrôle que SEC-2 avait omis, et je ne le referai pas omettre.

Le JWT anon reste, lui, exact : clé publique par construction, situation saine.

**Traité par** : décision fondateur sur SEC-3. Les deux documents sont corrigés.

---

## D-4 · `main` est en avance de 68 commits sur `origin/main`, délibérément non poussé

**Constaté le 27/07/2026, jalon 0.1, étape 4.**

Ces 68 commits ne sont **pas du travail en danger** : ils sont tous atteignables depuis d'autres références distantes (`git log main --not --remotes` retourne zéro). Ils sont sauvegardés.

Pousser `main` ferait avancer la **branche par défaut publique** du dépôt pour y intégrer du travail de branches de fonctionnalité. **C'est une décision de publication, pas une sauvegarde** — et le jalon 0.1 interdit explicitement de fusionner quoi que ce soit.

**Traité par** : arbitrage du fondateur, hors programme V3.

---

## D-6 · Un `catch` délibérément vide, dans un fichier protégé — arbitrage à rendre

**Constaté le 27/07/2026, T0 palier 52.**

`eslint-config-expo` passe de 7 à 8, ce qui tire typescript-eslint v8, où
`@typescript-eslint/no-unused-vars` bascule `caughtErrors` de `none` à `all`.
`src/services/captureSessionService.ts:597` porte alors une erreur :

```ts
} catch (e) {
  // Insert direct KO […] : on NE PERD PAS le lot. On le REQUEUE sur fichier […]
```

Le binding est **délibérément inutilisé** : le commentaire dit que le filet est la
file fichier, pas l'erreur. Le code est juste ; c'est la règle qui a changé.

**Ce qui a été fait** : `caughtErrors: "none"` posé dans `.eslintrc.json`, ce qui
**restaure exactement** la strictesse d'avant la migration. T0 est une migration,
pas une passe de durcissement.

**Ce qui reste à trancher.** L'option plus stricte est `caughtErrors: "all"` avec
`caughtErrorsIgnorePattern: "^_"` — déjà posé en prévision — et le renommage de
`e` en `_e`. **Un seul caractère**, mais dans
`src/services/captureSessionService.ts`, qui est sous règle cardinale : aucune
modification sans votre accord.

**Traité par** : votre arbitrage. Aucun blocage : la porte ESLint est verte en l'état.

---

## D-9 · Séparateur décimal — la source canonique est faite, 77 sites la contournent

**Constaté le 27/07/2026, jalon 2 phase 1.**

Le dossier impose la VIRGULE : `1:41,203`, jamais `1:41.203`. `src/utils/format.ts`
est corrigé — sept formateurs, un helper `virgule()`, et des tests qui exigent
qu'aucun rendu ne laisse un point entre deux chiffres.

**Mais 174 `toFixed` vivent hors de ce fichier**, et un remplacement massif serait
FAUX. Le décompte, fait plutôt que supposé :

| Nature                                                    | Compte | Conduite                                                       |
| --------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| **Géométrie SVG** — chemins, transformations, coordonnées | **30** | **NE PAS convertir** — une virgule dans un `d=` casse le tracé |
| Texte affiché                                             | 77     | à convertir, écran par écran                                   |
| Interne / indéterminé                                     | 67     | à trancher au cas par cas                                      |

**Le vrai défaut n'est pas la ponctuation, c'est la duplication.**
`src/components/DebriefMirror.tsx:192` réimplémente le formateur canonique —
un découpage minutes/secondes suivi de `toFixed(3).padStart(6)`, qui est
`formatLapTimeMs` récrit sur place.

Convertir ce site en virgule le rendrait juste et laisserait la duplication —
**donc le prochain écart**. La correction est de PASSER PAR le formateur, pas de
le recopier correctement.

**Traité par** : un lot dédié, écran par écran, qui remplace les
réimplémentations par des appels à `format.ts`. La conversion de ponctuation en
découle alors gratuitement, et ne peut plus diverger.

---

## D-7 · Prettier épinglé en 3.8 — une passe de mise en forme reste à faire

**Constaté le 27/07/2026, T0 palier 53.**

L'installation propre a résolu `prettier@^3.3.3` en **3.9.6**, alors que le verrou
précédent portait **3.8.3**. La 3.9 change le formatage des **types union** :
45 erreurs `prettier/prettier` sont apparues d'un coup, sur **15 fichiers**, sans
qu'une seule ligne de code ait été touchée. Aucun fichier protégé n'était concerné.

**Ce qui a été fait** : `prettier` épinglé en `~3.8.3` (résolu 3.8.5). Le lint
revient à sa ligne de base — 0 erreur.

**Le motif** : un lot de migration ne doit pas charrier une passe de mise en
forme. Le dépôt porte déjà la trace d'un reformatage accidentel — la remise
`stash@{0}`, voir D-5. Mêler 15 fichiers reformatés au diff d'une migration de
quatre majeures rendrait la relecture impossible.

**Traité par** : un lot dédié, après T0. Passer en `prettier@^3.9`, lancer
`prettier --write`, un commit qui ne contient que cela.

---

## D-8 · `@expo/config-plugins` restera périmé tant que `react-native-health` vivra

**Constaté le 27/07/2026, T0 paliers 52 et 53.**

`expo-doctor` échoue à chaque palier sur le même point : `@expo/config-plugins@7.9.2`
là où le SDK 53 attend `~10.1.1`. `npm why` désigne **une source unique** —
`react-native-health@1.19.0`, qui l'épingle en `^7.2.2`.

**1.19.0 est la version la plus récente publiée.** Aucune mise à jour ne réglera
cela. La même bibliothèque est par ailleurs signalée **« non testée sur la
nouvelle architecture »**.

C'est le candidat blocage de l'étape 3. Trois issues existent, aucune n'est
gratuite : `overrides` npm pour forcer la version du plugin, remplacement de la
bibliothèque, ou abandon de HealthKit — ce qui viderait la branche Intensité.

**Traité par** : à l'étape 3 de T0, quand la bascule d'architecture le rendra
concret. Voir `docs/T0_MIGRATION.md`.

---

## D-5 · La remise `stash@{0}` est sauvegardée mais toujours en place

**Constaté le 27/07/2026, jalon 0.1, étape 2.**

Le plan prescrit de la vider. Son contenu — « SEC-1 : reformatage prettier accidentel des docs historiques (récupérable) » — a été **poussé sur `origin/wip/sec1-remise-prettier`** plutôt que supprimé : une suppression ne se reprend pas, une branche se supprime quand on veut.

`git stash drop` reste à faire, quand vous aurez confirmé que la branche vous suffit.

**Traité par** : geste manuel du fondateur.

---

## D-10 · Le palier de marge à 24 pt n'est pas porté par le jeton

**Constaté le 28/07/2026, jalon 2 phase 1.**

Le dossier de conception §IV.1 fixe deux paliers de marge latérale : **20 pt de
320 à 414 pt, 24 pt au-delà**. Le jeton `spacing.screen` ne porte que le premier.

La raison est mesurée, pas supposée : la première version lisait
`Dimensions.get('window').width` dans `src/theme/v2.ts`. **Deux suites de tests
sont tombées d'un coup** — le banc Jest de ce dépôt est volontairement dépourvu
de la chaîne native (`jest.config.js` : « ts-jest pour ne pas hériter du preset
jest-expo »), et toute la couche logique importe le thème. Une dépendance native
dans les jetons rend la logique pure intestable.

**Conséquence exacte** : 4 pt de marge en moins sur iPhone Plus et Pro Max.
Jamais l'inverse — le sens de l'écart est sûr. Les composants qui connaissent
leur largeur obtiennent, eux, la bonne valeur par `margeEcran()` ; c'est ce que
fait `KingNumber` pour son budget, qui reste donc conservateur sur grand écran.

**Traité par** : la refonte écran par écran (jalons 3 à 8), où un
`useWindowDimensions()` par écran est de toute façon nécessaire. Le test
`src/theme/__tests__/themeSansRuntime.test.ts` garde la porte d'ici là.

---

## D-11 · 37 écrans sur 157 n'ont pas basculé sur la marge d'écran

**Constaté le 28/07/2026, jalon 2 phase 1.**

Le balayage a converti **120 écrans** dont le corps suit l'idiome
`paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl`. Les 37 autres ont
une structure différente : carte plein cadre (`carte-oxv`, `galerie`,
`carte-trophee`), écran de direct, conversation, ou marge posée ailleurs qu'à la
racine.

Les convertir demande de **lire chaque écran** pour distinguer la marge de
racine d'un remplissage intérieur — un remplacement mécanique aurait élargi des
cartes internes. Ce n'est pas un travail de jeton, c'est un travail d'écran.

Liste : `(admin)/b2b-rapport`, `(admin)/evenements/nouveau`, `(app)/belle-route`,
`bilan-pret`, `carte-oxv`, `carte-trophee`, `catalogue`, `creer-route`,
`debrief-presentiel`, `entre-runs`, `galerie`, `mon-coach`, `objectifs`,
`partenaire/[id]`, `pilotage-fini`, `preservation`, `support/index`, `trace`,
`virage`, `(auth)/lier`, `(auth)/login`, `(coach)/annoter`, `comparer-pilotes`,
`comparer`, `contexte`, `cycles/[id]`, `cycles`, `en-direct/[sessionId]`,
`facturation-identite`, `gabarits`, `lecture`, `messages/[coachPilotId]`,
`priorites`, `profil`, `rapport`, `repere/[index]`, `+not-found`.

**Conséquence** : ces écrans gardent 16 pt de marge au lieu de 20.

**Traité par** : la refonte écran par écran (jalons 3 à 8).

---

## D-12 · Le « zéro non pointé » n'est pas atteignable en style

**Constaté le 28/07/2026, jalon 2 phase 1.**

Le dossier demande « JetBrains Mono ligatures désactivées **et zéro non
pointé** ». La première moitié est faite : la table de la fonte a été lue, `calt`
est présent, `no-contextual` le coupe (`monoVariant` dans `src/theme/v2.ts`).

La seconde ne l'est pas. La fonte expose bien un tag `zero`, mais **`fontVariant`
de React Native est une énumération fermée** qui ne le contient pas, et RN
n'offre pas de `fontFeatureSettings`. Le paquet `@expo-google-fonts/jetbrains-mono`
ne livre pas non plus de variante alternative — pas de « NL », pas de `ss01`.

Deux issues, toutes deux à votre main : changer de fonte de chiffres, ou
construire un sous-ensemble de JetBrains Mono avec la fonctionnalité appliquée
au build.

**À rapprocher du même arbitrage** : le dossier nomme le trio « Söhne Breit,
SF Pro, JetBrains Mono ». Le système V3 adopté est Hanken Grotesk + JetBrains
Mono. Söhne est une fonte commerciale (Klim), SF Pro est réservée à Apple. **Je
n'ai rien changé** — un changement de fonte est une décision de doctrine, et
celle-ci a un prix.

**Traité par** : décision fondateur.

---

## D-13 · `total_frames` se trompe dans les deux sens

**Constaté le 29/07/2026, jalon 4, phase 4septies.**

La colonne dénormalisée `telemetry_sessions.total_frames` ne correspond à rien
de vérifiable aujourd'hui :

- **dix séances** en statut `completed` annoncent des trames qu'elles n'ont pas
  (par exemple `f13545a1` : `total_frames = 223`, zéro ligne dans
  `telemetry_frames`) ;
- la **seule** séance qui porte de vraies trames (`7f40d5ad`, 53 lignes)
  affiche `total_frames = 0`.

La réconciliation ne tourne qu'au statut `completed` (`captureSyncQueue.ts`,
`execComplete`), donc jamais pour une séance interrompue — d'où le second cas.

**Conséquence** : tout portillon posé sur `total_frames` ouvrirait un niveau
vide ou fermerait un niveau qui a de quoi s'ouvrir. `etatDepuisSeance` compte
les trames reçues et **ne lit jamais cette colonne** ; sa signature l'impose.

**Traité par** : hors lot. La réconciliation vit dans `captureSyncQueue.ts`,
fichier sous votre garde — je n'y touche pas sans votre accord.

---

## D-14 · La détection de tours a produit un tour de 22 millisecondes

**Constaté le 29/07/2026, jalon 4, phase 4septies.**

L'unique ligne de `laps` en production : `duration_seconds = 0,022`,
`max_speed_kmh = 1,39`, `distance_meters = 0`, `start_lat = 0,0000000`,
`is_outlap = true`.

Une latitude nulle et une distance nulle ne décrivent pas un franchissement de
ligne : c'est un artefact de détection, sur une séance de test à l'arrêt.

**Conséquence** : contenue pour l'affichage — `estTourChronometre` écarte les
tours de sortie et de rentrée, et le chrono ne s'ouvre donc pas sur cette
ligne. Mais **le drapeau `is_outlap` est ce qui sauve** ; un artefact du même
genre sans ce drapeau passerait.

**Traité par** : à revoir avec la première capture réelle en roulage. Un seuil
de plausibilité serait une invention tant qu'aucune séance vraie n'existe.

---

## D-15 · Le delta ne lit que le repli, pas la source primaire

**Constaté le 29/07/2026, jalon 4, phase 4septies.**

`analyzeSessionService` pose une priorité explicite : source 1 = fichier `.ubx`
local, source 2 = `telemetry_frames` en base (`AnalyzeSourceKind`).

`deltaService` et `etatDepuisSeance` ne lisent que la base. Un appareil qui
porte un fichier UBX local alimenterait donc les niveaux avec zéro ligne, et
tout s'afficherait fermé alors que la donnée existe sur le téléphone.

**Conséquence** : sous-estimation de ce qui est disponible. Jamais une valeur
fausse — l'absence s'affiche comme telle.

**Traité par** : hors lot. Demande d'unifier les deux sources derrière une
seule façade, ce qui touche à la chaîne de capture.

---

## D-16 · La Séance sort vers le Bilan, ce que la spec interdit

**Constaté le 29/07/2026, jalon 4, rendu de la restitution.**

`app/(app2)/data/session/[id].tsx` porte en pied un lien « Ouvrir le bilan »
vers `/(app2)/bilan/{id}`.

Or les deux documents versionnés disent l'inverse, et dans les deux sens :
`OXV_Mirror_V3_Plan_Montage.md` — « Le Bilan […] **une seule sortie : la
Séance** » et « La Séance […] **aucune sortie vers le Bilan** ».

La circulation voulue est à sens unique : on entre par le Bilan, lu debout au
paddock, et on descend vers la Séance, lue assise. Le lien de retour rend la
boucle fermée et efface cette intention.

**Traité par** : décision fondateur. Retirer un chemin de navigation existant
n'est pas une micro-décision d'interface — je n'y touche pas seul.

---

## D-17 · Le rail d'ancres coûte 18 % de hauteur, la spec en veut 10 %

**Constaté le 29/07/2026.**

`Plan_Montage` exige des ancres collantes « sous 10 % de la hauteur d'écran ».

Le rail seul fait 44 pt, soit 5,2 % d'un écran de 844 pt — conforme. Mais il
est posé sous un bandeau fixe de `insets.top + 48` : l'ensemble immobilise
151 pt, soit **17,9 %**. Arithmétique tirée des constantes, non mesurée sur
appareil.

L'ajout de la huitième ancre ne change rien à ce chiffre — le rail défile
horizontalement, il ne grandit pas.

**Traité par** : à mesurer sur appareil avant de trancher. Si le budget vise
l'ensemble bandeau + rail, c'est le bandeau condensé qu'il faut revoir, pas le
rail.

---

## D-18 · La Télémétrie charge au montage, et la séance lit cinq fois les mêmes trames

**Constaté le 29/07/2026.**

`TelemetrieSection` est montée sans condition et son effet n'a que `sessionId`
en dépendance : ses quatre requêtes partent dès l'ouverture de l'écran, que le
pilote descende jusqu'à elle ou non.

Conséquence chiffrée : `loadSessionFrames` — lecture paginée jusqu'à soixante
mille lignes, **sans cache** — est atteinte **cinq fois** sur un seul montage,
par `loadGGPoints` (deux fois), `loadSessionFlow`, `loadSpeedTracePoints` et
`loadThrottleBrakePoints`. `loadSessionTrajectory` part deux fois de plus.

**Le rendu différé est réputé obligatoire** par le plan, et n'existe nulle part
dans ce fichier.

**Contourné, pas résolu** : la nouvelle section Delta n'ajoute rien au montage
— elle attend `useFirstViewport`, primitive qui existait déjà dans le kit et ne
servait qu'aux animations. Le reste demande de toucher aux sections existantes.

---

## D-19 · La Saison est un écran que personne ne peut atteindre

**Constaté le 29/07/2026.**

Aucun fichier de `app/` ne navigue vers `/(app2)/data/saison`. Les seules
occurrences du chemin sont son propre en-tête et un commentaire de
`app/(app2)/signature.tsx` dont le `onPress` réel pointe ailleurs.

Mille trois cents lignes d'écran, quatre sections, inatteignables.

**Traité par** : le plan tranche déjà — « le hub Data devient la Saison,
`data/saison` fusionne et disparaît ». C'est un lot à part entière du jalon 4.

---

## D-20 · Le bilan V2 est un bilan de SOI, et son record le prouve

**Constaté le 29/07/2026**, en tentant de recâbler
`app/(coach)/pilote/[id].tsx:759` vers l'arbre V2 (étape 2 du lot J5).

`useBilan` sait charger la séance d'autrui : quand l'id n'est pas dans les
séances de l'utilisateur, il retombe sur `fetchSessionById`, dont le commentaire
dit « même chemin que le bilan v1 (RLS arbitre l'accès) ». Le chargement
fonctionne donc pour un coach.

**Le calcul qui suit, non.**

```
useBilan.ts:277   isPersonalRecord(bestLapMs, session.id, allSessions)
useBilan.ts:189   allSessions = fetchAllSessions(userId)   ← MON id, pas celui du pilote
```

Un coach ouvrant la séance d'un pilote la verrait comparée à **ses propres**
séances. Et `bilanLogic.ts:91` renvoie `true` quand la liste des autres séances
est vide : **un coach sans séance verrait la séance du pilote marquée RECORD**,
en or, sans qu'aucune donnée ne le justifie.

Le bilan V1, lui, ne calcule aucun record — c'est une capacité ajoutée en V2,
sous l'hypothèse implicite « le lecteur est le pilote ».

**TOUJOURS PRÉSENT DANS `useBilan`, MAIS DEVENU LATENT.** Le recâblage vers le bilan a été annulé et
le lien laissé sur V1, la raison écrite en commentaire à l'endroit du geste.

**Plus aucun chemin n'y mène.** Le lien coach ne vise plus le bilan mais la
LECTURE de la séance (`/(app2)/data/session/[id]`), qui, elle, bascule son
identité de référence sur le propriétaire. Le bilan reste un miroir de soi : un
coach n'atteint que le sien, où lecteur et pilote coïncident.

Le défaut dort donc au lieu de mordre. Il se réveillerait au premier lien qui
ferait lire un bilan à quelqu'un d'autre que son pilote.

**Ce qui a été corrigé ailleurs, le même jour.** L'arbitrage 1 a tranché en
faveur de l'ancre partagée, et `app/(app2)/data/session/[id].tsx` a donc dû
apprendre à lire la séance d'autrui. Il le fait SANS reproduire ce défaut :
l'identité de référence bascule sur `session.user_id` dès que le lecteur n'est
pas le pilote, et `fetchAllSessions` comme `loadWeatherCorrelation` la prennent.
Le motif de correction est écrit là-bas ; `useBilan` reste à traiter de la même
manière.

---

## D-21 · Les virages sont affichés avec un numéro de trop

**Constaté le 29/07/2026**, en vérifiant les trouvailles de la revue J5.
**Antérieur au lot J5.**

`app_segment_analyses.segment_index` est numéroté **à partir de 1** — la chaîne
le prouve : `BELTOISE_CORNERS[].index` vaut 1..7, `hauteSaintonge.ts` pose
`order: corner.index`, `analysis.ts:137` écrit `segmentIndex: segment.order`.
C'est aussi ce qu'exige `(coach)/annoter.tsx:106`, qui refuse tout
`cornerIndex < 1`.

Mais plusieurs écrans affichent `segmentIndex + 1` :

```
src/features/data/reperesVirages.ts:54     `V${s.segmentIndex + 1}`
app/(app2)/data/session/[id].tsx           `V${c.segmentIndex + 1}`  (pastille)
app/(app2)/data/session/[id].tsx           `Virage ${corner.segmentIndex + 1}`
```

Le virage 1 s'affiche donc « V2 », et le dernier virage porte un numéro qui
n'existe pas sur le circuit. Un pilote qui dit « le V4 » et un coach qui ouvre
le virage 4 ne parlent pas du même endroit.

**Pourquoi personne ne l'a vu** : `app_segment_analyses` est VIDE en production.
Aucune donnée n'est jamais venue démentir le décalage.

**CORRIGÉ dans `data/session/[id].tsx`** — parce que le lot J5 y a créé une
COLLISION, et pas seulement hérité d'un décalage. Depuis ce lot, cette feuille
mène à `(coach)/annoter`, qui titre le virage avec l'index BRUT : le coach
lisait « Virage 5 » puis « VIRAGE 4 » dans le même parcours. Le décalage était
sans conséquence tant que l'écran ne menait nulle part.

**Reste ouvert** : `src/features/data/reperesVirages.ts:54` porte le même
`+ 1`. Hors du périmètre J5, et il faut vérifier tous les affichages de numéro
de virage d'un coup — sinon on déplace l'incohérence au lieu de la fermer.

**Garde posée** : `src/telemetry/__tests__/indexVirage.guard.test.ts` relie les
deux extrémités de la chaîne, pour que la base ne se perde plus en route.
La contrainte SQL `CHECK (segment_index >= 1 AND segment_index <= 7)` la fixe
côté base.

---

## D-22 — Le lien de partage ouvre la page d'accueil du site

> **ATTENTION — NUMÉRO PARTAGÉ.** « D-22 » désigne aussi, dans le registre des
> décisions (`docs/programme-v3/OXV_Dossier_Raccordement_Site.md:229` et
> `docs/CE_QUI_ME_MANQUE.md:101`), le choix du mécanisme `app_pairing_codes` —
> un sujet sans rapport. Dire « D-22 est fermé » sans préciser le registre est
> donc ambigu : une équipe comprendra que l'appairage est tranché, l'autre que
> les liens sont réparés. Ici, D-22 = **le registre de dette**, les liens.

> **Mesuré à nouveau le 02/08/2026, dans le DOM.** Le titre et le contenu de
> cette entrée ont été refaits : ils décrivaient des 404, ce qui était faux.

### Ce qui était écrit, et pourquoi c'était faux

L'entrée d'origine s'intitulait « Les deux liens de l'app vers le site tombent
sur un 404 » et affirmait que « toutes ses routes profondes rendent un 404
réel ». **Aucune des deux URL n'a jamais rendu de 404 au 02/08.** Elles rendent
200 — c'est plus difficile à détecter, pas moins gênant.

Un lecteur appliquant la consigne finale (« à re-tester ») aurait lu deux fois
200, conclu que le site avait livré son correctif, et clos la dette. L'un des
deux liens serait resté cassé.

### État mesuré au 02/08/2026

| Lien | Source | Ce qui se passe RÉELLEMENT |
|---|---|---|
| `www.oxvehicle.fr/compte-sessions` | `src/features/club/passLogic.ts:143` | **RÉSOLU.** La route existe. Un visiteur déconnecté voit la section `page-login` (« Bon retour en piste. / Se connecter. ») — comportement correct d'une page de compte. |
| `www.oxvehicle.fr/share/<jeton>` | `src/services/sharesService.ts` | **OUVERT.** 200, mais la section rendue est `page-home` : le destinataire voit la page commerciale (« Trois offres. Une exigence. »), pas la progression du pilote. |

### Comment vérifier — et comment NE PAS vérifier

Le site sert **un seul document contenant 64 sections `page-*`**. Chercher
`id="page-compte-sessions"` dans le HTML ne prouve donc RIEN sur cette route :
l'identifiant est présent pour les 64 pages, y compris quand la page affichée est
tout autre. Ce contrôle réussit à l'identique que la route marche ou non.

Ce qui décide : ouvrir l'URL et lire **quelle section est visible**.
`document.querySelectorAll('[id^="page-"]')` filtré sur `getClientRects().length`.
Au 02/08, `page-share` est ABSENTE des 64 — la page n'est pas déployée.

### Où en est la réparation

La page `/share` est écrite et vérifiée, sur une branche du dépôt du site non
poussée (5 commits d'avance sur `origin/main`). **Ce n'est plus du
développement, c'est un merge.** Tant qu'il n'a pas lieu, tout lien de partage
émis ouvre la page d'accueil.

### Ce qui a été fait côté application le 02/08

- Les URL visent `www` et non l'apex : mesuré, `oxvehicle.fr` répond **307**, et
  tous les clients ne suivent pas les redirections.
- Le compteur de vues n'affiche plus « 0 vue » : il ne peut pas bouger tant que
  la page n'est pas servie, et un zéro se lit comme une audience mesurée.
- La phrase « passé ce délai, le lien cesse de répondre » disait faux — le lien
  répond, avant comme après. C'est l'ACCÈS AUX DONNÉES qui expire.

**Le `.catch()` de `pass.tsx:137` ne protège de rien ici** : `Linking.openURL`
ne rejette que faute de navigateur. Une page qui répond 200 s'ouvre avec succès,
quel que soit son contenu. Aucune détection n'est possible côté application.

### Dégât

**À ce jour : nul.** Un seul lien de partage existe en production, déjà expiré.

Mais l'ancienne formulation — « personne n'a encore pu tomber sur ces 404 » —
parlait du passé en le présentant comme un état stable. Rien n'empêche un pilote
de créer un lien neuf aujourd'hui ; il tomberait sur la page d'accueil, et le
compteur ne le dirait pas.

---

## D-23 — RÉSOLUE le 01/08/2026 — canal biométrie par coach, RLS comprise

**Posé le 01/08/2026**, lot 27a-bis (jalon 6).

Le code applicatif est passé à un canal par coach,
`live:bio:<coachId>:<sessionId>`. L'émetteur ne sert que les coachs au niveau
détaillé (`destinatairesBiometrie`), et le TOUT OU RIEN est levé : un coach
détaillé ne perd plus le cardio parce qu'un confrère en lecture simple s'est
connecté.

**La barrière est posée.** Les deux policies `realtime.messages` ont été
APPLIQUÉES le 01/08/2026 sur accord du fondateur
(`20260801140838_l27_bio_par_coach_realtime_policies`). Elles autorisent le
pilote émetteur — Realtime exige une lecture pour rejoindre un canal privé — et
le coach nommé dans le topic, au niveau détaillé.

**Ce qui protège vraiment n'est pas le nom du topic.** Le deviner est facile.
Seule la policy de lecture, qui exige que l'abonné SOIT le coach nommé dans le
topic, isole les confrères les uns des autres. La nommer ici évite de prendre
l'obscurité pour une sécurité.

**Rien à rattraper** : 0 compte coach en production, aucune donnée biométrique
n'a jamais été collectée.

**La réserve trouvée par la revue est fermée elle aussi.** La policy s'appuie
sur `coach_pilots.active`, `live_sharing_at` et `level` ; jusqu'au 01/08 un
compte coach pouvait poser ces trois colonnes lui-même, pour un pilote inconnu,
en un seul INSERT — la condition « consenti » était posée par celui-là même
qu'elle filtre. Corrigé par `20260801140905_l28_...` : la policy d'insertion
impose une naissance en attente, et le garde-fou SEC-3 couvre désormais
l'insertion autant que la modification.

Le trou était ANTÉRIEUR au lot et ouvrait bien plus que la biométrie
(`is_detailed_coach_of` commande aussi les trames et les analyses de segments).

---

## D-01 — RÉSOLUE le 01/08/2026 — il n'y a jamais eu de perte

Le dossier de reprise du site posait ce point comme le plus grave et le plus
urgent : `sessions` porte **une** ligne alors qu'une sauvegarde du 19/07 en
portait **quarante-quatre**. « Personne n'a établi ce qui s'est passé. »
Il commandait le calendrier, la réservation, et tout écran qui montre une
journée.

**Mesuré le 01/08/2026 :** les deux ensembles sont TOTALEMENT DISJOINTS. Aucune
des 44 lignes de `_backup_sessions_20260719` n'existe dans la table vivante, et
l'unique ligne vivante (24/12/2026) n'existe pas dans la sauvegarde. La
sauvegarde couvre un calendrier entier, du 05/05/2026 au 06/04/2027.

**Réponse du fondateur, 01/08/2026 :**

> « Je n'ai encore aucune journée de validée, j'attends la confirmation du
> calendrier par le circuit et j'ajouterai chaque session par le compte admin. »

**Il n'y a donc pas eu de perte.** Les 44 lignes étaient un calendrier
prévisionnel, jamais validé ; la table vivante est dans l'état attendu. Ce qui
ressemblait à une suppression accidentelle était un état normal mal interprété —
de l'extérieur, et sans demander.

**Ce qui reste vrai :** aucun écran de calendrier ni de réservation ne peut être
validé sur des données réelles avant que le circuit confirme les dates. Ce n'est
plus un incident à élucider, c'est une dépendance externe à attendre.

**À transmettre au site** : leur `PROMPT_REPRISE.md` fait de D-01 un préalable
bloquant à tout. Il ne l'est plus.

**Les cinq tables `_backup_*_20260719` sont conservées** — aucune décision de
suppression n'a été prise. Le point RGPD soulevé par la proposition L10 (des
copies de données personnelles hors de tout périmètre de purge :
`_backup_registrations` 5 lignes, `_backup_payments` 2) reste ouvert, sans
urgence tant que rien n'est en production réelle.

---

## D-24 — Un `drop table` doit balayer les FONCTIONS, pas seulement le code

**Incident du 01/08/2026, réparé le jour même. Dégât réel : nul.**

La suppression de `duels` (L21s) a été précédée de trois vérifications : zéro
ligne, aucune clé étrangère entrante, aucun code applicatif ne la touche. Toutes
justes, toutes insuffisantes.

**`purge_user_data` la référençait deux fois.** La fonction du droit à
l'effacement était cassée pendant vingt minutes.

**Pourquoi cela ne s'est pas vu tout de suite** : plpgsql ne vérifie pas
l'existence d'une table à la création de la fonction. `create or replace` passe
sans broncher. La casse ne serait apparue qu'à la **première demande
d'effacement réelle** — et elle l'aurait fait échouer entièrement.

C'est la pire forme de panne : silencieuse, et qui n'éclate qu'au moment où l'on
a le plus besoin que ça marche.

**La règle, désormais** : avant tout `drop table`, balayer
`pg_get_functiondef` sur l'ensemble des fonctions du schéma. La requête tient en
cinq lignes :

```sql
select p.proname
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and pg_get_functiondef(p.oid) like '%public.<table>%';
```

**Ce qui a été fait en réparant** : les deux `delete` ajoutés sur les
sauvegardes sont gardés par `to_regclass`. Le jour où ces tables partiront, la
purge continuera de fonctionner. On ne refait pas deux fois la même erreur dans
la même journée.

---

## D-25 — L10 et L21 : arbitrées et appliquées le 01/08/2026

**L10 — les cinq sauvegardes.** Conservées. Les deux qui portent des données
personnelles (`_backup_registrations` 5 lignes, `_backup_payments` 2) entrent
dans `purge_user_data` : le droit à l'effacement redevient complet. Les trois
autres n'en portent pas. Ce n'était pas une exposition — aucune n'accorde SELECT
à `anon` ni `authenticated`, PostgREST ne les sert pas — c'était un trou
d'effacement.

**L21 — `users.biometry_asked_at` posée.** Elle date la SOLLICITATION, pas la
réponse : écrite quand la feuille s'affiche, même si le pilote la referme sans
répondre. Sans elle, un refus et une question jamais posée valaient tous deux
NULL, et l'application aurait redemandé à chaque journée à celui qui a dit non.

**Deux faits ont changé depuis la rédaction de la proposition**, vérifiés le
01/08 : le drapeau `biometry` est passé à **true** — le bloc est vivant, la
proposition affirmait le contraire — et la seconde porte non gardée de
`vous/reglages.tsx` **a été corrigée** entre-temps.

**CÂBLAGE FAIT le 01/08/2026.** La colonne est lue et écrite ; la garde est
armée.

La question s'ouvre **juste après l'appairage** — placement décidé par le
fondateur. Le flux reste à HUIT étapes : aucune vue neuve, on ouvre la feuille de
consentement qui existait déjà dans `rec/equipement`, au moment où le pilote
vient de connecter son boîtier et comprend de quoi on parle.

La décision est portée par `doitSolliciterConsentementBio` (pur, 8 tests) et la
date écrite par `markBiometryAsked`, qui n'écrase jamais une sollicitation
antérieure.

**Deux pièges fermés en chemin :**

*Une course.* Le minuteur qui mène à Placement vaut 1,4 s ; une lecture de la
base au bord d'une piste peut être plus lente. Un booléen « feuille ouverte »
aurait laissé la navigation partir pendant la requête, et la feuille se serait
ouverte sur un écran déjà quitté. L'état est donc à TROIS valeurs — inconnu,
ouverte, fermée — et seul `fermee` libère la navigation.

*Un fail-closed qui ne l'était pas.* La première rédaction écartait `null` ET
`undefined`, si bien qu'un champ ABSENT franchissait la garde et déclenchait la
question. Le test l'a montré avant le commit. Seul un `null` explicite vaut
désormais « jamais posée ».

---

## D-26 — RÉSOLUE le 02/08/2026 — le marqueur a sa forme

**Relevé le 01/08/2026** en préparant le câblage du résolveur (jalon 6, phase 5).

`src/telemetry/marqueur.ts` sait résoudre un instant en tour, virage, vitesse,
freinage et distance à la corde. **Aucun code ne lui fournit d'instant.**

Trois colonnes de `coach_annotations` existent en base et ne sont écrites nulle
part, vérifié par recherche sur tout le dépôt :

| Colonne | État |
|---|---|
| `marker_s_norm` | **zéro référence** dans `src/` et `app/` — ni lecture, ni écriture |
| `lap_index` | lue par `filSeanceService`, jamais écrite |
| `audio_url` | lue par `filSeanceService`, jamais écrite |

Le chemin d'écriture (`coachAnnotationsService`) ne pose que `corner_index` et
`body`.

**Ce n'est pas un défaut du résolveur** : il est juste, testé, et rendra des
`null` honnêtes. C'est un manque en amont — le geste « poser un marqueur » n'a
pas de surface.

**TRANCHÉ le 02/08/2026 — et la réponse du fondateur vaut mieux que mes
options.** Ni l'instant seul, ni l'abscisse seule : **l'instant, l'abscisse quand
elle sera calculable, ET le point précis où se trouvait le pilote**.

C'est la position qui décide. Elle est une MESURE directe, reprise de la trame :
elle ne dépend d'aucune géométrie de circuit. Or `app_segment_analyses` est vide
et aucune corde de référence n'existe — `virage` vaudra donc `null` sur toutes
les séances actuelles. La position, elle, est toujours là : on peut montrer le
point exact sur le tracé sans rien calculer.

L'instant fait foi. L'abscisse s'ajoutera sans rien contredire, puisqu'elle se
dérive de la position.

**Posé en base** (`20260802042524_l29_...`) : `marker_elapsed_ms`, `marker_lat`,
`marker_lon` sur `coach_annotations` — `marker_s_norm` existait déjà et reste
nullable. Le résolveur rend désormais `position`, et la banque de provenance
l'enregistre comme grandeur MESURÉE.

**RESTE : le geste.** Le plan dit où il vit — `rapport` devient l'écran où le
coach « choisit ou enregistre son audio, écrit sa phrase, RETIENT UN MARQUEUR,
envoie ». C'est la prochaine tranche.

**Rien à rattraper** : 0 annotation en production.

---

## D-27 — Les données d'un membre fondateur survivent à l'effacement de son compte

**Relevé le 01/08/2026** en préparant la phase 5bis (statut fondateur).

`founding_members` porte `prenom`, `nom`, `email` — des données personnelles — et
**n'est pas dans `purge_user_data`**. Elle ne peut pas y être : la table n'a
**aucune colonne `user_id`**, donc rien ne relie une ligne à un compte.

Conséquence : un membre fondateur qui crée un compte, puis exerce son droit à
l'effacement, voit son compte anonymisé et son nom rester ici.

**Ce n'est PAS une exposition.** Vérifié : la RLS est active sur la table et
**aucune policy n'existe** — ni `anon` ni `authenticated` n'y lisent quoi que ce
soit, malgré les GRANT présents. Seul `service_role` y accède, ce dont l'edge
function `capture-membre-fondateur` a besoin. C'est le bon état ; ne pas y
ajouter de policy sans raison.

**Dégât réel : nul aujourd'hui.** Une seule ligne, et aucune demande
d'effacement n'a jamais été exercée.

**Le correctif est dans `PROPOSITION_L29_statut_fondateur.sql`** — la colonne
`user_id` sert d'abord à cela, la propagation du statut ne vient qu'ensuite.
L'anonymisation y est préférée à la suppression : la candidature est une trace de
gestion (une demande de signature Yousign a pu être facturée sur elle), c'est
l'identité qui doit disparaître, pas l'existence de la ligne.

**Un point reste à trancher, et il n'est pas technique.** Le plan dit
« propagation au rattachement » sans dire par quoi on rattache. Le seul point
commun entre les deux tables est l'e-mail — une identification faible : une
adresse change, se partage, se réutilise. La proposition pose donc la mécanique
et LAISSE le rattachement à un geste explicite. Automatiser sur l'e-mail seul
attribuerait un statut de fondateur à quelqu'un qui ne l'a peut-être pas demandé.

---

## D-28 — Le bouton « Marquer » ne peut pas écrire : la contrainte refuse la ligne

**Introduit et constaté le 02/08/2026, dans la même journée.**

`coach_annotations.body` porte, depuis la migration 0020 :

```sql
body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000)
```

`poserMarqueur()` insère `body: ''`. **Longueur zéro : la contrainte refuse la
ligne, à tous les coups.** Le geste livré une heure plus tôt est inerte — il
affiche une erreur et n'écrit rien.

**Pourquoi rien ne l'a vu.** Le typage passe, le lint passe, les 2 605 tests
passent. Ils portent sur la DÉCISION (`decideMarqueur`, 10 tests) et jamais sur
l'ÉCRITURE. **Aucune garde du dépôt ne compare un `insert` aux contraintes de sa
table** — et les types générés ne portent pas les CHECK.

**La règle, désormais** : avant de livrer un chemin d'écriture nouveau, relire
les contraintes de la table cible.

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.<table>'::regclass;
```

C'est la sœur de D-24 (balayer les fonctions avant un `drop table`) : les deux
défauts viennent d'avoir raisonné sur le code sans regarder le schéma.

**Le correctif est dans `PROPOSITION_L30_marqueur_sans_texte.sql`** — relâcher
la contrainte, jamais remplir `body`. Écrire « Marqueur » ou un point produirait
une NOTE FABRIQUÉE qui ressortirait dans le fil à côté des faits mesurés, comme
si le coach l'avait écrite. Un marqueur n'a pas de texte, et c'est sa nature.

**Ce qui est sauf, vérifié** : le trigger de notification (`0021`) sort
immédiatement si `visibility != 'shared'`, et un marqueur naît `private`. Aucun
pilote n'est notifié d'un repère que le coach s'est posé à lui-même.

**Dégât réel : nul.** 0 annotation, 0 compte coach — le bouton n'a jamais pu
être pressé.

---

## D-29 — Ce que l'audit des liens sortants a trouvé et que je n'ai pas traité

**Relevé le 02/08/2026** par l'audit adversarial des liens app → site (107
agents, 4 sondes : URL, partage de bout en bout, affirmations des documents,
promesses d'interface). 51 constats bruts, 27 retenus après réfutation, 7 angles
morts ajoutés par le critique de complétude.

Ce qui suit est **confirmé et non corrigé**. Chaque ligne dit pourquoi.

| Constat | Où | Pourquoi c'est resté ouvert |
|---|---|---|
| Le lien App Store de l'invitation coach est invalide : `apps.apple.com/app/oxv` ne porte aucun identifiant numérique | `supabase/functions/send-coach-invitation/index.ts:61` (HTML) et `:85` (texte) | **Je ne peux pas l'inventer.** L'identifiant n'existe qu'une fois la fiche créée sur App Store Connect. Le coach reçoit un message dont l'étape 1 ne mène nulle part. À corriger au dépôt de l'application. |
| `oxv://virage?index=…&sessionId=…` ne résout sur rien : aucune route ne s'appelle « virage » | `supabase/functions/notify-pilot-coach-annotated/index.ts:120-121`, expédié sous la clé `deepLink` | Rien ne casse aujourd'hui — le tap sur la notification passe par une autre branche qui fonctionne. Mais la charge utile transporte une adresse morte. À trancher : créer la route, ou retirer la clé. |
| Aucun `associatedDomains` (iOS) ni `intentFilters` (Android) : un lien `https://www.oxvehicle.fr/share/<jeton>` ne peut pas être capté par l'application | `app.json:18` — seul `"scheme": "oxv"` est déclaré | Le destinataire qui a l'app installée ouvre quand même le navigateur. Décision produit + configuration du domaine côté site. Sans objet tant que la page `/share` n'est pas déployée. |
| `"usesAppleSignIn": true` et le plugin `expo-apple-authentication` sont déclarés, mais aucun fichier n'importe ni n'appelle Apple Sign-In | `app.json:29` et `:82` | La capacité est embarquée dans chaque build iOS et réclamée par l'App ID, sans un seul bouton pour s'en servir. À trancher : brancher, ou retirer de la configuration. Toucher à `app.json` change le build. |
| `fetchSharedProgression` n'a aucun appelant | `src/services/sharesService.ts:195` | Le lecteur sécurisé existe, personne ne l'appelle : il donne l'impression qu'un chemin de lecture existe côté app. Il n'en existe aucun. À retirer, ou à brancher le jour où l'app saura afficher un partage. |
| Le message de parrainage ne nomme aucune adresse — « Rejoignez-moi sur OXV — ABCD1234 » — et le code n'est utilisable nulle part dans l'app | `src/features/vous/vousHubLogic.ts:201`, partagé depuis `app/(app2)/vous/index.tsx:314` | Le destinataire reçoit huit caractères et un nom. Deux défauts liés : le message est muet ET `redeem` n'a aucun appelant. Corriger le texte sans brancher la saisie ne ferait que déplacer l'impasse. Décision produit. |
| Les documents d'un partenaire sont affichés en texte non pressable, et n'apparaissent sur aucun écran pilote | `app/(partner)/profil.tsx:167` et `:180` | Le partenaire saisit une adresse que personne ne peut ouvrir — ni lui, ni le pilote. Décision produit : exposer, ou retirer le champ. |

**Ce qui a été corrigé le même jour** (voir D-22 et l'historique Git) : les URL
d'apex, le compteur de vues fabriqué, la phrase d'expiration fausse, le
consentement à la mesure d'audience, la garde d'apex trop étroite, les liens
morts de la fiche pilote et des points de carte, le chemin des documents
juridiques annoncé aux CGU, l'en-tête de la carte-souvenir.

**Deux propositions attendent une décision** :
`supabase/migrations/PROPOSITION_L31_jeton_partage_par_la_base.sql` et
`docs/PROPOSITION_POLITIQUE_8_3.md`.

---

## D-30 — La cartographie de l'espace admin : 62 constats, 9 angles morts

> **ÉTAT AU 02/08/2026, FIN DE JOURNÉE — l'entrée ci-dessous décrit l'état
> AVANT correction.** Tout ce qui ne demandait pas de migration a été corrigé
> (commits `8203e53`, `a7ee182`, `8e977ed`, `aa7f1b6`, `5ed9da1`, `510317f`) :
> les quinze zéros fabriqués, les sept écritures muettes, le tableau de piste
> qui classait, les promesses de temps réel, le hub à deux modes avec ses
> familles et ses compteurs, le briefing collectif, les deux écrans qui
> décrivaient autre chose qu'eux-mêmes, le test RLS qui passait sur du vide, et
> l'affirmation de protection qui était fausse.
>
> **CE QUI RESTE OUVERT tient en trois propositions non appliquées**, chacune
> demandant une décision : `PROPOSITION_L31` (jeton de partage),
> `PROPOSITION_L32` (affiliation non acceptée — trou d'accès VIVANT, mesuré en
> production), `PROPOSITION_L33` (auteur du pointage et du consentement forcé,
> état suivi des incidents, verrou des routes certifiées).
>
> Deux chantiers restent aussi, hors migration : le TEMPS RÉEL de l'espace admin
> (aucun canal n'existe — les écrans ne le prétendent plus, mais ils ne le font
> pas), et la LISTE DES INSCRITS de l'écran Préparation, qui lit l'annuaire au
> lieu de la prochaine séance.

**Relevé le 02/08/2026** par la cartographie adversariale des 30 écrans de
`app/(admin)/` face au cahier Jalon 7 Phase 6 (150 agents, 5 sondes : accès,
deux modes, tableau de piste, gestes qui engagent, écrans morts). 72 constats
bruts, **62 retenus** après double réfutation, plus 9 angles morts.

**Traité le jour même** : la confusion entre « lecture impossible » et « droit
refusé » (voir en fin d'entrée), la cible morte du sélecteur d'espace, et les
trois corrections structurelles du Jalon 7 (commit `8203e53`).

**Ce qui suit est confirmé et NON corrigé.** Groupé par nature, parce que la
plupart de ces défauts partagent une racine.

### Le hub admin ne fait pas ce que le cahier décrit

`app/(admin)/index.tsx` est une liste figée de **22 cartes** (`VIEWS`, l. 23-134)
rendue à l'identique le jour J et un mardi de février. Aucun état, aucun hook de
donnée, aucune section. Manquent donc, tous exigés Jalon 7 Phase 6 :

- **les deux modes** — le coach en a un, `src/features/coach/hubModeLogic.ts`,
  pur et testé : il servirait de modèle ;
- **la séparation verticale** surveillance / « À faire » / plateau :
  `SectionLabel` n'est même pas importé ;
- **les compteurs** : les 22 `description` sont des chaînes littérales figées.

### Rien n'est en temps réel, et deux écrans affirment le contraire

`grep` de `.channel(`, `postgres_changes`, `.subscribe(` sur les 31 fichiers de
`app/(admin)/` : **zéro occurrence**. Or le hub annonce « État Bluetooth en temps
réel pendant la session » (`index.tsx:36`), `tour-controle.tsx:36` le répète — et
`en-cours.tsx:126` dément dans son propre pied de page : « Suivi temps réel en
V1.1. » Le motif existe déjà ailleurs (`src/services/liveSessionService.ts`).

### Le tableau de piste montre des noms, et impose un ordre

- `en-cours.tsx:51` lit `users(first_name, last_name)` et rend `session.pilotName`
  (l. 114) : de l'état civil, là où le cahier impose des NUMÉROS.
  `users.car_number` existe, et la règle d'ordre `compareCarNo`
  (`src/services/boardLogic.ts:124`) est déjà écrite ET verrouillée par test —
  branchée sur le seul roster coach.
- `en-cours.tsx:53` trie par `started_at` décroissant : le dernier parti en tête.
  C'est un ordre de passage, donc une hiérarchie, là où `BOARD_MODE = 'A'`
  l'interdit.
- `analyse-session/[id].tsx:136` montre à l'administrateur la marge globale d'une
  séance nominative — l'indicateur central du pilote.

### Des zéros fabriqués, présentés comme des mesures

Chacun transforme une lecture EN ÉCHEC en un chiffre affiché comme un fait :

| Où | Quoi |
|---|---|
| `adminControlTowerService.ts:73` puis `:85` | `const { count } = ...` sans lire `error`, puis `count ?? 0` |
| `adminAnalyticsService.ts:71-78` | six comptages `head: true`, aucun ne lit `error` |
| `en-cours.tsx:70` | `lap_count ?? 0` rendu « 0 tour » alors que la colonne est nullable |
| `partenaires.tsx:92` | compteur de leads hors du `StateWrapper`, retombe à 0 pendant le chargement |
| `attendanceService.ts:56` | `if (error || !data || length === 0) return []` — panne et journée vide confondues |
| `qualite-data.tsx:57` | état d'erreur INATTEIGNABLE : `detectSessionAnomalies` rend `[]` sur erreur |
| `support/[id].tsx:115` | idem — `'error'` jamais atteint, `errorCause` et `onRetry` morts |
| `adminUsersService.ts:93` | `listUsers` avale l'erreur, l'écran n'a ni `.catch` ni état |
| `utilisateurs/[id].tsx:55` | `null` rendu aussi bien pour compte absent que pour lecture refusée |

C'est la règle fondateur « données réelles câblées » enfreinte neuf fois.

### Des gestes qui engagent, sans confirmation ni trace

- **`coachs/[id].tsx:125`** — « Forcer le consentement (papier signé) » écrit un
  consentement AU NOM D'UN PILOTE, sans confirmation, et ignore l'échec
  (`if (result.ok) await reload()`, pas de branche `else`).
  `coachAdminService.ts:321` n'inscrit **aucun auteur** : la table ne porte pas la
  colonne, aucun déclencheur d'audit ne couvre `coach_pilots`. Un consentement
  sans auteur ni trace est indéfendable en cas de contestation.
- **`feature-flags.tsx:179`** — « Supprimer » efface un drapeau d'un seul toucher.
  Ces drapeaux commandent des fonctions vivantes de l'espace pilote
  (`biometry`, `pilot_waivers`, `convoys`, `app_payments`, `founders`).
- **`maintenance.tsx:103`** — le bandeau « Kill-switch ARMÉ » suit l'état LOCAL,
  modifié par l'interrupteur avant tout enregistrement : il affirme que l'app est
  bloquée pour tous avant que quoi que ce soit ne soit écrit.
- **`maintenance.tsx:45`** — `loadAppConfig` rendant `null` sur erreur, l'écran ne
  passe pas en erreur et **reste sur ses valeurs initiales** : `maintenance=false`.
- **`attendanceService.ts:155`** — seule écriture admin dans `registrations` :
  aucun auteur (`attended_by` n'existe pas), aucun trigger d'audit. Le cahier
  l'exige : « une inscription vaut un paiement, et sans trace un désaccord de
  facturation est insoluble ».
- **`evenements/[id].tsx:101/109/117/125`** — quatre écritures dont le
  `MutationResult` est jeté ; `moderation.tsx:84/91` et `devices.tsx:59` de même.
- **`ambassadeurs.tsx:146`** — « Activer » et « Révoquer », frères à 8 px, chacun
  `hitSlop={6}` : les zones se recouvrent sur 4 px et le dernier rendu rafle le
  toucher. Le piège `hitSlop` pour la troisième fois dans ce dépôt.

### Le briefing collectif n'existe pas

Le cahier : « un geste bascule tous les présents — seul des neuf items à l'être
par nature ». Réalité : les neuf items vivent en base
(`20260703200426_eligibility_items_hub02.sql:16`, avec une policy admin) et
**aucun fichier de `app/(admin)/` ne mentionne `eligibility_items`**. Les cinq
occurrences de « briefing » sont un champ d'horaire à la création d'un événement
(`evenements/nouveau.tsx`), jamais réaffiché. `presences.tsx:63` pointe un pilote
à la fois, et écarte tout autre appui pendant l'aller-retour serveur.

### L'incident n'a pas d'état

`20260719021027_be1_incident_reports.sql` : la table porte `occurred_at`,
`description`, `photo_path`, `created_at`. **Aucune colonne d'état** (reçu /
traité / clos), aucun auteur de traitement, aucune date — et la ligne 38 interdit
explicitement toute policy UPDATE ou DELETE. Le suivi exigé demande une migration.

### Deux systèmes de présence qui ne se voient pas

`presences.tsx:65` écrit `registrations.attended_at` (tables du site) ;
`scan-checkin.tsx:47` et `evenements/[id].tsx:109` écrivent
`event_registrations.status = 'checked_in'` (tables héritées). Pointer d'un côté
ne se voit pas de l'autre.

### Sécurité — les angles morts du critique de complétude

- **`adminSessionDiagnosticService.ts:75`** — l'en-tête affirme « Admin-only (RLS
  `is_admin()` sur ces tables) ». **Faux pour deux des quatre** :
  `session_insights` n'a que trois policies (propriétaire, service_role, coach).
  Le dépôt est PUBLIC, la RLS est la seule barrière.
- **`20260729034051_d1_is_coach_of_exige_le_role.sql:50`** — `is_coach_of`, qui
  commande l'accès du coach aux séances, aux tours et aux analyses, teste
  `active`, `pilot_consent_at` et `users.role` mais **JAMAIS
  `coach_pilots.status`**. `is_detailed_coach_of` non plus.
- **`20260621172308_scenic_routes.sql:96`** — le verrou de certification est un
  trigger `before update of status` : l'INSERT n'est pas couvert, et le
  propriétaire d'une route déjà certifiée peut en réécrire `name`, `geometry` et
  `pois` sans qu'aucune garde ne s'arme (`for all`, l. 39-42).
- **`src/__tests__/rls/adminTablesRLS.test.ts:49`** — le test affirme qu'un pilote
  ne lit aucune ligne de `device_assignments`, mais **ne crée jamais
  d'affectation** : il passe parce que la table est vide, pas parce qu'une policy
  écarte. Garde posée, non armée.
- **`devices.tsx:205`** — aucune écriture dans `device_assignments` n'existe dans
  tout le dépôt : les trois seuls accès sont des SELECT. L'écran laisse croire
  qu'on peut affecter un boîtier.

### Écrans qui mentent sur leur contenu

- **`preparation.tsx:51`** — l'écran « Préparation » tire les 50 premiers `users`
  de rôle `pilot` triés par nom, **sans aucune jointure sur `registrations` ni sur
  `events`**, alors que son état vide annonce « Aucun pilote inscrit à la
  prochaine session ».
- **`coachs.tsx:118`** — l'état vide délivre une instruction SQL de console
  Supabase (« Dashboard → SQL → UPDATE users SET role... ») alors que
  `preparation.tsx:151` sait faire ce geste dans l'application.
- **`devices.tsx:101`** — le type d'équipement est codé en dur (`type: 'racebox'`)
  puis réaffiché ligne 201 comme une donnée lue en base.

### Ce qui a été corrigé le 02/08 — la racine des plus graves

`profile === null` avait deux sens confondus : « pas de fiche » et « je n'ai pas
pu lire la fiche ». Trois seuils tiraient la même conclusion du second, et
`onAuthStateChange` fabriquait ce `null` à CHAQUE rafraîchissement de jeton dont
la lecture échouait — toutes les heures, sur la 4G du circuit. L'administrateur
était expulsé en plein pointage, sa porte de retour disparaissait au même
instant, et il ne restait qu'à tuer l'application.

Corrigé : `profilIndisponible` dans le magasin, un écran de reprise aux trois
seuils, un profil connu qui n'est plus détruit par une lecture ratée, et la porte
vers l'admin sortie de la branche de succès dont elle ne dépendait pas.
Garde : `src/store/__tests__/profilIndisponible.guard.test.ts` — vérifiée
échouante sur la version d'avant, sur ses six assertions structurelles.

---

## D-31 — Les liens universels : ce qui ne dépend pas que de l'application

**Relevé le 02/08/2026**, traité partiellement le 03/08.

`app.json` déclare `"scheme": "oxv"` mais ni `associatedDomains` (iOS) ni
`intentFilters` (Android). Un lien `https://www.oxvehicle.fr/share/<jeton>`
touché sur un téléphone où OXV est installé ouvre donc le navigateur, jamais
l'application.

**JE NE L'AI PAS AJOUTÉ, ET C'EST DÉLIBÉRÉ.** Déclarer `associatedDomains` sans
le fichier de vérification correspondant produit exactement le motif que ce
dépôt combat : une capacité déclarée qui ne se déclenche jamais. Il faut,
côté SITE :

- iOS — servir `https://www.oxvehicle.fr/.well-known/apple-app-site-association`
  (JSON, sans extension, `Content-Type: application/json`, sans redirection),
  contenant l'identifiant d'équipe Apple et `fr.oxvehicle.app` ;
- Android — servir `https://www.oxvehicle.fr/.well-known/assetlinks.json` avec
  l'empreinte SHA-256 du certificat de signature.

**CORRECTION DU 03/08, quelques minutes après avoir écrit le contraire.** J'ai
d'abord noté que « l'application ne détient pas ces informations ». C'est faux
pour la première : l'identifiant d'équipe Apple est **`K53YDJ3Y55`** (Gabin
FILLAT, compte individuel) — il s'affiche dans les identifiants EAS à chaque
build, et il n'a rien de secret : tout fichier `apple-app-site-association`
l'expose publiquement par construction.

Reste donc UNE inconnue : l'empreinte SHA-256 du certificat de signature
Android de production, à relever dans la console Google Play une fois
l'application publiée.

C'est un lot conjoint app + site, mais la moitié iOS est déjà documentable :

    { "applinks": { "details": [
        { "appIDs": ["K53YDJ3Y55.fr.oxvehicle.app"], "components": [
            { "/": "/share/*" } ] } ] } }

**Sans objet tant que la page `/share` n'est pas déployée** (voir D-22) : capter
le lien pour l'ouvrir dans une application qui ne sait pas afficher un partage
ne réglerait rien.

### Ce qui a été traité le 03/08

- **`oxv://virage`** — la clé `deepLink` de la notification « note du coach »
  transportait une adresse qui ne résolvait sur rien : aucune route ne s'appelle
  « virage ». Rien ne cassait — le tap passe par la branche `coach_annotation`
  de `app/_layout.tsx`, qui construit elle-même le bon chemin. La clé était donc
  une adresse fabriquée que personne ne lisait, et qu'un mainteneur aurait fini
  par croire. **Retirée.**
- **Lien App Store** — `apps.apple.com/app/oxv` ne porte aucun identifiant
  numérique et ne mène nulle part. Le courriel d'invitation coach (HTML et
  texte) annonce désormais Android seul, et dit que le lien iPhone suivra à la
  publication. **À rebrancher dès la fiche App Store créée.**
- **`usesAppleSignIn`** — la capacité était réclamée par chaque build iOS et le
  plugin `expo-apple-authentication` déclaré, sans une seule ligne de code qui
  s'en serve (vérifié : zéro import, zéro appel). Capacité, plugin et
  dépendance **retirés**. À rétablir le jour où l'authentification Apple sera
  réellement branchée — pas avant.

---

## D-32 — Le build iOS : trois causes, deux réglées, une qui vous revient

**03/08/2026.** Premier build iOS depuis la migration SDK 55 — le dernier réussi
(n°31, 25/07) tournait encore sous SDK 51. Trois échecs successifs, trois causes
différentes, chacune lue dans le journal plutôt que devinée.

### n°32 — `sharp` (RÉGLÉ)

Phase « Install dependencies ». `sharp@0.34.5` n'a pas trouvé de binaire
précompilé utilisable sur le builder macOS, a tenté une compilation depuis les
sources via node-gyp, et a réclamé `node-addon-api` absent.

Le verrou contenait pourtant `@img/sharp-darwin-arm64` et `darwin-x64` avec les
bons `os`/`cpu`. **Je ne sais pas pourquoi le contrôle a échoué**, et je préfère
le dire que d'inventer.

Ce qui est certain : `sharp` ne servait qu'à
`scripts/generate-placeholder-assets.js`, un générateur de visuels provisoires
lancé à la main, branché à aucun script npm. Il mettait une compilation native
sur le chemin critique de chaque build. **Sorti du graphe**, s'installe à la
demande, et le script le dit quand il manque.

### n°33 — l'entitlement « dossiers de santé » (RÉGLÉ)

    Provisioning Profile ... does not support the HealthKit Access
    (Verifiable Health Records) capability.

OXV ne lit aucun dossier de santé. Lu dans la source de
`react-native-health/app.plugin.js` (l. 32-38) : le greffon écrit
**inconditionnellement** `com.apple.developer.healthkit.access = []`, et
n'ajoute `'health-records'` que si l'option clinique est vraie. Le drapeau
commande le contenu, jamais la présence — et pour Apple, c'est la présence qui
réclame la capacité.

`plugins/withoutHealthRecords.js` retire la clé quand elle est vide. **Il doit
être déclaré AVANT `react-native-health`** : les mods Expo s'exécutent dans
l'ordre inverse de leur déclaration. Constaté par témoin, pas supposé.

### n°34 — la capacité HealthKit sur le profil (VOUS)

    Provisioning profile "*[expo] fr.oxvehicle.app AdHoc 1778931827644"
    doesn't include the HealthKit capability.

Le profil date de mai 2026 — antérieur à l'ajout de la biométrie. Il faut :

1. activer **HealthKit** sur l'identifiant `fr.oxvehicle.app` dans le portail
   développeur Apple (Certificates, Identifiers & Profiles → Identifiers →
   fr.oxvehicle.app → cocher HealthKit → Save) ;
2. laisser EAS régénérer le profil au build suivant.

**Je ne peux pas le faire d'ici** : aucun identifiant Apple ni clé API App Store
Connect n'est configuré dans ce dépôt, et une authentification Apple demande vos
propres identifiants. C'est une action de compte, elle vous revient.

Une fois la case cochée, `eas build -p ios --profile preview` régénère le profil
tout seul — la capacité est en libre-service, contrairement à celle des dossiers
de santé.

### Ce que HealthKit sert, pour mémoire

La lecture de la fréquence cardiaque enregistrée pendant un roulage
(`src/services/v2/healthKitService.ts`, `bio1Trigger.ts`, écran équipement). Ce
n'est pas un reliquat : c'est la biométrie, et le canal par coach a été livré le
02/08. Retirer HealthKit ferait passer le build au prix de cette fonction.
