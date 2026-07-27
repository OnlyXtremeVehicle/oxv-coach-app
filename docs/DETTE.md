# Dette — défauts constatés hors du périmètre du lot en cours

Règle de travail V3 : _« Ne jamais élargir le périmètre d'un lot. Si un défaut apparaît hors périmètre, le consigner ici et continuer. »_

Chaque entrée porte son fichier, sa ligne, et le lot qui la traitera. Rien n'est corrigé ici.

---

## D-1 · Un coach rétrogradé conserve l'accès aux données — **ouvert**

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

## D-5 · La remise `stash@{0}` est sauvegardée mais toujours en place

**Constaté le 27/07/2026, jalon 0.1, étape 2.**

Le plan prescrit de la vider. Son contenu — « SEC-1 : reformatage prettier accidentel des docs historiques (récupérable) » — a été **poussé sur `origin/wip/sec1-remise-prettier`** plutôt que supprimé : une suppression ne se reprend pas, une branche se supprime quand on veut.

`git stash drop` reste à faire, quand vous aurez confirmé que la branche vous suffit.

**Traité par** : geste manuel du fondateur.
