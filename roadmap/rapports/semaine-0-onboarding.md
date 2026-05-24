# Rapport semaine 0 — Onboarding Claude Code

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Destinataire** : Gabin Dupont
**Statut** : en attente de validation avant démarrage semaine 1

---

## Ce que j'ai fait

Lecture du dossier complet selon l'ordre prescrit dans `CLAUDE.md` :

- **Doctrine** (Étape 1) : `CLAUDE.md`, `docs/screens/00_OVERVIEW_26_ECRANS.md`, `docs/screens/01_DESIGN_TOKENS.md`, `docs/juridique/01_PACTE_DE_PILOTAGE.md`
- **Architecture** (Étape 2) : `docs/architecture/01_PARTIE_1_stack_supabase.md`, `docs/architecture/04_SUPABASE_CONNECTION_GUIDE.md`, `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md`, `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`, `docs/architecture/07_CODE_V1_RECUPERE.md`, `docs/architecture/08_CONNEXION_PROGRESSION_SITE_APP.md`
- **Sitemap** (Étape 3) : `docs/sitemap/04_state_machine.md`
- **Roadmap** (Étape 4) : `roadmap/SEMAINES.md`, `roadmap/SETUP_SUPABASE.md`
- **Code V1 récupéré** : `src/ubx/parser.ts`, `src/ble/bluetoothService.ts`, `src/types/telemetry.ts`, `src/types/index.ts`, `src/supabase/client.ts`, le template `src/theme/tokens.ts.template`
- **Configs** : `app.json`, `package.json.v1`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `eas.json`, `.env.example`, `.gitignore`

Pas encore lu (volontairement reporté à la semaine concernée) : `02_algorithmes.md` (semaines 5-7), `03_deploiement.md` (semaines 13-14), `juridique 02-04`, `app_store`, `test_alpha`, `sitemap 01-03`.

Le contenu du zip d'origine `oxv-coach-app/` a été remonté à la racine du dossier de travail pour faciliter l'arborescence Expo.

---

## Ce que j'ai compris

### La doctrine en une page

OXV Coach n'est pas un coach. C'est un **miroir post-session**. Cette distinction guide tout :

| Permis | Interdit |
|---|---|
| « Le virage 7 vous tend les bras » | « Freinez plus tôt au virage 7 » |
| « Était-ce volontaire ? » | « Vous devriez tracer plus serré » |
| « Confortable », « À explorer », « Terrain serré » | « Bon », « Mauvais », « Élite » |
| Un seul chiffre central (marge globale en %) | Tableaux de bord multi-KPI |
| Silence total pendant le roulage | HUD, notifications, sons en piste |
| Vouvoiement, phrases courtes, pas d'emoji | Marketing creux, gamification |

Les **5 principes non négociables** structurent toute décision produit. Avant chaque écran ou copie, je vérifie : sécurité-avant-perf, miroir-pas-coach, silence-en-piste, ton-OXV, un-seul-chiffre.

### L'architecture

**Stack imposée et confirmée** : Expo SDK 51, React Native 0.74, TypeScript strict, Zustand 5, expo-router, react-native-ble-plx 3.2, @supabase/supabase-js 2.45, expo-secure-store pour les tokens, Sentry pour le monitoring. Polices Inter + Syncopate. Mode sombre forcé (`userInterfaceStyle: "dark"`). Bundle ID `fr.oxvehicle.app`.

**Architecture en couches** : UI ← Zustand (présentation) ← Business logic (algos de marge, parser, comparator) ← Data (WatermelonDB local + Supabase remote) ← Hardware (BLE, FileSystem, GPS).

**Offline-first** : prioritaire car pas de réseau au circuit la moitié du temps. WatermelonDB est encore à wirer (semaine 2).

### Le backend déjà en production

Le projet Supabase `fouvuqkdxarjpjbqnsjq` (Frankfurt) est **vivant** : 20 tables, 80+ RLS policies, 13 utilisateurs, 10 sessions télémétrie. L'infrastructure existe déjà — je m'y greffe, je ne la recrée pas.

**Tables déjà utilisables par l'app** (DÉJÀ EXISTANTES, ne pas recréer) :
- `users` (47 colonnes — `pilot_level`, `public_handle`, toggles rituels J-7/J-2/J-1 inclus)
- `telemetry_sessions` (la table maîtresse pour les sessions enregistrées par l'app)
- `telemetry_frames` (positions à 25 Hz, vide aujourd'hui)
- `circuits` (3 lignes — Beltoise + 2 autres, `track_svg_path` inclus)
- `laps`, `weather_snapshots`, `ritual_dispatches`
- `qdi_scores` — **point de friction doctrinal** (voir Questions §1)

**Tables à AJOUTER pour V1** (seulement 2, et seulement en semaine 7-8) :
- `app_circuit_zones` (zones nommées par circuit : « Le S des chênes »)
- `app_session_analyses` (résultat du calcul de marge composite, debrief J+1, accept pacte)

Les RLS suivent un pattern unique : `auth.uid() = user_id OR is_admin()`. Les nouvelles policies sur `app_*` suivront le même.

### Le code V1 récupéré (gain ≈ 3,5 semaines)

Validé en condition réelle (PoC `oxv-telemetry`, mai 2026) — **à ne pas réécrire** :
- [parser.ts](src/ubx/parser.ts) — 150 lignes, parsing UBX RaceBox Mini S, checksum Fletcher-8, buffer de resync. Propre, testable unitairement.
- [bluetoothService.ts](src/ble/bluetoothService.ts) — 274 lignes, pattern listeners (à wirer sur un store Zustand en semaine 2), scan/connect/notifications/reconnexion auto.
- [types/telemetry.ts](src/types/telemetry.ts) — alignés sur les vraies tables Supabase de prod.
- [services/sessionsService.ts](src/services/sessionsService.ts), [weatherService.ts](src/services/weatherService.ts), [utils/geo.ts](src/utils/geo.ts), [utils/lapDetection.ts](src/utils/lapDetection.ts), [utils/validation.ts](src/utils/validation.ts) — tous gardés tels quels.
- [supabase/client.ts](src/supabase/client.ts) — client avec `expo-secure-store` (plus sûr que AsyncStorage pour les tokens). **Conflit identifié** avec `src/lib/supabase.ts.template` — voir Questions §2.

**Écarté** : QDI scoring (300 lignes, gamifié, contredit la doctrine), charte V1 (couleurs erronées `#E63946` / `#FFB703`), structure d'écrans V1 (inadaptée aux 26 écrans V2), stores V1 (dépendaient du modèle V1).

### Les 26 écrans, leur logique d'apparition

Les écrans ne s'affichent jamais hors-contexte. La state machine pilote 10 états (S1 Découverte → S10 Repos), et chaque écran n'est valide que dans certains états. Exemples :

- En **S6 (roulage, véhicule > 60 km/h)** : **aucun écran**. C'est la traduction technique du principe « silence en piste ». Seul le bouton Flic 2 peut être pressé.
- En **S8 (atterrissage, dans les 2h après la session)** : séquence #10 → #11 (préservation) → #12 (bilan prêt) → #13 (le bilan central).
- En **S9 (J+1)** : déclenché par notif push, ouvre #19 le debrief littéraire (généré côté Edge Function avec OpenAI).

Les 5 écrans principaux qui font le cœur de la V1 : **#13 Bilan**, **#14 Carte**, **#15 Zoom virage**, **#16 La prochaine fois**, **#17 Progression**. Ils représentent les semaines 5-7.

### Le plan 14 semaines

Phase 1 (sem. 1-2) fondations · Phase 2 (3-4) BLE+UBX · Phase 3 (5-7) cœur 5 écrans · Phase 4 (8-10) écrans secondaires · Phase 5 (11-12) polish · Phase 6 (13-14) stores. Audit dev senior humain recommandé à la semaine 6-7.

À chaque vendredi : rapport dans `roadmap/rapports/semaine-N.md`, commit Git, attente de validation Gabin avant la semaine suivante.

---

## Questions pour Gabin (à valider avant la semaine 1)

### Q1 — Que fait-on du QDI ?

La table `qdi_scores` existe en base et calcule un score sur 5 dimensions (trajectoire/fluidité/freinage/accélération/régularité) avec des niveaux `elite/or/argent/bronze/novice`. Cela **contredit directement** la doctrine OXV (« miroir pas coach », pas de gamification).

Trois options identifiées dans `05_SCHEMA_SUPABASE_ACTUEL.md` :
- **A** — Conserver en base pour usage admin interne, ne jamais afficher au pilote. Permet d'éventuellement calibrer les algos sans rompre la doctrine.
- **B** — Afficher mais sans gamification (juste un chiffre, sans niveau). Risque de cannibaliser la marge composite (un seul chiffre par écran).
- **C** — Supprimer la table et supprimer les fonctions PostgreSQL associées. Net mais perd l'historique des 0 lignes actuelles.

**Ma recommandation** : option A pour la V1. La table reste, l'app l'ignore complètement (pas de lecture, pas d'écriture). Décision réversible en V1.1 si vous voulez la réactiver.

### Q2 — Quel client Supabase on garde ?

Deux fichiers coexistent et font la même chose différemment :
- [src/supabase/client.ts](src/supabase/client.ts) (V1, utilise `expo-secure-store`, pas de types `Database`)
- [src/lib/supabase.ts.template](src/lib/supabase.ts.template) (V2 proposé, utilise `AsyncStorage`, typé)

Le doc `07_CODE_V1_RECUPERE.md` dit que le V1 « remplace » le template. Mais le path `@/lib/supabase` est référencé dans toute la doc, et l'absence de types `Database` est un manque pour TypeScript strict.

**Ma recommandation** : fusionner en un seul fichier `src/lib/supabase.ts` qui prend le meilleur des deux — SecureStore (V1) + typage `Database` (V2) + helpers `getCurrentUser`, `checkConnection`, `isRLSError`. Je supprime alors `src/supabase/client.ts` et le `.template`. C'est ce que je ferai par défaut sauf objection.

### Q3 — Notification preferences avec champs « rank/record »

[src/types/index.ts](src/types/index.ts) définit `NotificationPreferences` avec des champs `rank_change`, `new_record`, `new_follower` — qui supposent un classement et un graphe social. La doctrine OXV interdit le classement entre pilotes.

**Ma recommandation** : retirer ces champs dès la V1 (la table `users.notification_preferences` étant un `jsonb` permissif, aucune migration nécessaire). Garder uniquement les champs alignés sur la doctrine : `session_reminder_d7/d2`, `weather_d1`, `payment_confirmation`, `debrief_ready`, `oxv_announcements`. Confirmez-vous ?

### Q4 — Accès `.env` pour la semaine 1

Pour démarrer concrètement la semaine 1 (test de connexion Supabase, écran de login), j'aurai besoin que vous créiez le `.env` avec au minimum :
- `EXPO_PUBLIC_SUPABASE_URL=https://fouvuqkdxarjpjbqnsjq.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=...` (votre clé anon depuis Project Settings → API)

Le reste (OpenAI, ElevenLabs, Resend, service_role) n'est nécessaire que pour les Edge Functions, plus tard.

Et idéalement un **compte de test** existant dans votre Supabase (email/mot de passe) que je puisse utiliser pour valider le login.

### Q5 — RaceBox physique pendant le dev

Pour les semaines 3-4, le code BLE devra être testé avec un vrai RaceBox Mini S. Quelles options ?
- Vous avez un RaceBox accessible et on planifie une session de test à distance ?
- Vous me fournissez des fichiers `.ubx` enregistrés ?
- Je travaille sur des fixtures générées et vous validez avec votre matériel ?

### Q6 — Repo Git

Le dossier n'est pas un repo Git aujourd'hui. La roadmap mentionne « Setup Git + GitHub Actions (CI basique) » en semaine 1. Confirmez-vous que je peux :
- `git init` à la racine
- Faire le premier commit avec tout ce qui existe + l'init Expo
- Vous laisser créer le remote GitHub (je ne peux pas le faire sans vos identifiants)
- Mettre en place un workflow CI minimal (typecheck + lint à la PR) dans `.github/workflows/`

---

## Recommandations

### R1 — Ne pas court-circuiter la semaine 1

Le README pose explicitement cette règle. Je m'y tiens : la semaine 1 n'écrit pas de code métier, elle construit les fondations. Pas de tentation de « pendant qu'on y est, on attaque déjà le bilan ».

### R2 — Tester sur Expo Go dès le jour 1

Je propose qu'à chaque jour de la semaine 1, vous installiez le QR code Expo Go sur votre téléphone pour valider visuellement, même un écran vide. Cela évite les surprises de fin de semaine.

### R3 — Conserver `package.json.v1` comme référence

Plutôt que `rm` après init Expo, je le laisse à la racine en tant que checksum des dépendances V1 validées. Utile en cas de régression à la semaine 3 (BLE) ou semaine 4 (parser).

### R4 — Sentry désactivé en dev

Sentry est dans `app.json` plugins, mais le DSN n'est pas dans `.env.example`. Je propose de le wirer dès la semaine 1 mais en mode **désactivé en dev** (DSN vide → no-op), et activé seulement en `preview`/`production` via une variable d'env. Cela évite de polluer Sentry avec mes logs.

### R5 — Linter sec dès le début

ESLint + Prettier + un `eslint-plugin-react-native` configurés strictement en semaine 1, avec une règle bloquant les `console.log` en CI (autorisés via `__DEV__` uniquement). Cela maintient le ton « Ferrari » jusque dans le code.

---

## Plan détaillé semaine 1 — Fondations

Sous réserve de validation des Q1-Q6 ci-dessus.

### Côté Gabin (à faire avant ou en parallèle)

- [ ] Créer le `.env` à la racine avec les 2 vars Supabase obligatoires (Q4)
- [ ] Fournir un compte de test (email + mot de passe) ou créer `claude-code-test@oxvehicle.fr` (Q4)
- [ ] Trancher Q1 (QDI), Q2 (client Supabase), Q3 (notif prefs)
- [ ] Décider Q5 (RaceBox) — réponse pas urgente avant semaine 3
- [ ] Confirmer Q6 (git init) ou indiquer si remote déjà existant
- [ ] Confirmer le `projectId` EAS de `app.json` (`d168d639-22e2-4190-a9ea-cc6a31e3acaa`) est toujours actif sur votre compte EAS, ou en créer un neuf

### Côté Claude Code (chronologie)

**Jour 1 — Init Expo + structure**
- `npx create-expo-app@latest .` avec template `--template blank-typescript`, fusion avec les fichiers de config existants (app.json, tsconfig, babel, metro, eas)
- Générer `package.json` à partir de `package.json.v1` (mêmes versions, sans les deps écartées)
- `npm install` puis `npx expo install --check`
- Structure `src/` finalisée : `components/`, `screens/`, `lib/`, `hooks/`, `store/`, `theme/`, `ble/`, `ubx/`, `services/`, `supabase/`, `types/`, `utils/`
- Activer `src/theme/tokens.ts` à partir du template
- ESLint + Prettier configurés strictement
- `git init` + premier commit

**Jour 2 — Supabase + types**
- Fusionner les deux clients en `src/lib/supabase.ts` (selon Q2)
- `npx supabase gen types typescript --project-id fouvuqkdxarjpjbqnsjq > src/types/database.types.ts`
- Hook `useAuth` Zustand (`src/store/useAuthStore.ts`) avec `signIn`, `signOut`, `user`, `loading`, persistence via SecureStore
- Écran de test temporaire qui ping `users` et affiche OK/Erreur

**Jour 3 — Navigation + thème**
- `expo-router` configuré, structure `app/` minimaliste : `app/_layout.tsx`, `app/(auth)/login.tsx`, `app/(app)/index.tsx`
- StatusBar dark, SafeAreaProvider, ThemeProvider qui expose `tokens`
- Polices Inter + Syncopate via `@expo-google-fonts/*`
- Écran « Bienvenue Gabin » qui lit `users.first_name` après login

**Jour 4 — Auth écran login**
- Écran #login (pas dans les 26 V2, écran technique) avec champ email + mot de passe, dans le ton OXV (manifeste « Entrez. »)
- Validation client + remontée d'erreur Supabase traduite en français
- Logout depuis l'écran d'accueil de test
- Tests manuels iOS Simulator + Android Emulator

**Jour 5 — Build de validation + rapport**
- `npx expo prebuild`
- Build EAS `development` iOS + Android (si quotas EAS OK)
- Smoke test sur device (vous, sur votre téléphone)
- Rapport `semaine-1.md` avec captures, commits, points de validation, tests passants
- CI basique GitHub Actions : `tsc --noEmit` + `eslint` à chaque PR

### Critères d'acceptation semaine 1

- [ ] L'app build sur iOS et Android sans warning bloquant
- [ ] Login Supabase fonctionne avec un compte de test
- [ ] L'écran d'accueil affiche « Bienvenue, {first_name} » lu depuis `users`
- [ ] Logout déconnecte proprement, retour login
- [ ] TypeScript strict passe (`tsc --noEmit` clean)
- [ ] ESLint sans erreur sur `src/`
- [ ] Premier rapport hebdo validé par vous

---

## Estimation pour la semaine suivante (semaine 2)

Sous réserve de validation semaine 1. Couvre Zustand stores + WatermelonDB + types métier complets.

- Jour 1-2 — Stores Zustand : `useAuthStore` (compléter), `useSessionStore`, `useTelemetryStore`, `useUIStore`, `useAppStateStore` (state machine S1-S10 selon `04_state_machine.md`)
- Jour 3-4 — WatermelonDB : modèles miroirs des tables Supabase, sync bidirectionnelle, gestion conflits last-write-wins. **Note** : WatermelonDB sur Expo SDK 51 requiert `expo-dev-client` (déjà dans deps V1), donc pas d'Expo Go pur — à valider.
- Jour 5 — Types TypeScript exhaustifs : compléter `src/types/` avec les types métier OXV alignés sur les 26 écrans et la state machine

Estimation effort : **5 jours-claude**, sans dépendance externe.

---

## En résumé

J'ai compris la doctrine, j'ai compris l'architecture, j'ai compris le code que je dois préserver et celui que je dois jeter. Je sais ce que la semaine 1 doit produire et ce qu'elle ne doit pas produire (= du code métier prématuré).

J'ai six questions concrètes à résoudre avec vous avant de toucher au moindre `npx create-expo-app`. Trois sont doctrinales et urgentes (Q1 QDI, Q2 client, Q3 notifs), deux sont logistiques pour démarrer (Q4 `.env`, Q6 Git), une est pour plus tard (Q5 RaceBox).

Si vous validez les six réponses dans la foulée, je peux démarrer la semaine 1 immédiatement après. Je n'écris aucune ligne de code applicatif sans votre feu vert sur ce rapport.

— Claude Code, 24 mai 2026
