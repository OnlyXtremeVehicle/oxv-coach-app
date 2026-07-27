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

## D-2 · `.gitignore` — quatre gardes sur huit sont absentes

**Constaté le 27/07/2026, jalon 0.1, étape 3.**

Couverts : `.env`, `.env.local`, `*.p8`, `*.p12`.
**Non couverts** : `google-services.json`, `GoogleService-Info.plist`, `*.mobileprovision`, `*.keystore`.

**Aucun fichier de ce type n'est suivi aujourd'hui.** Il n'y a pas de fuite — seul `.env.example` est suivi, ce qui est sa fonction. Mais la garde n'existe pas : sur un dépôt public, un fichier de signature déposé dans l'arbre partirait au prochain `git add` sans que rien ne l'arrête.

**Traité par** : à rattacher au premier lot qui touche la configuration de projet. Correctif d'une ligne.

---

## D-3 · Deux documents publiés affirment un état de sécurité périmé

**Constaté le 27/07/2026, jalon 0.1, étape 3.**

`BILAN_COMPLET_OXV.md` affirme « JWT anon en dur repo entier | Aucun (`eyJhbGciOi` : 0 hit) ». Vrai à la rédaction, **faux depuis la reconstitution des 94 migrations** : `supabase/migrations/20260718133742_fix_relay_validate_inscription_jwt.sql:35` en porte un. Il s'agit de la clé anon, publique par construction — l'affirmation est fausse, la situation reste saine.

`docs/ETAT_COMPLET_APP_2026-07-26.md:18` et `:1369` décrivent l'élévation de privilège `is_admin` comme **ouverte en production**, avec le détail de son exploitabilité. **Elle a été fermée par SEC-2 le 26/07.** Le document n'a pas suivi.

Les deux sont désormais publics. L'erreur va dans le sens prudent — elle surestime le risque — mais un document d'état qui se trompe sur la sécurité perd sa fonction.

**Traité par** : à rattacher au premier lot qui touche ces documents.

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
