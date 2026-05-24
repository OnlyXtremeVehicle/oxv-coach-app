# Rapport semaine 1 — Fondations

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : jours 1-4 condensés en une session, jour 5 (build + smoke test) à votre main

---

## Ce que j'ai fait

### Préalables doctrinaux (vos validations Q1-Q3)

- **Q1 — QDI** : migration `0007_drop_qdi_scores_doctrine_alignment` appliquée sur le projet Supabase de prod (`fouvuqkdxarjpjbqnsjq`). Pre-checks : 0 ligne, 0 vue dépendante, 0 FK pointant vers la table, 0 trigger. `DROP TABLE qdi_scores CASCADE` propre. Les types TypeScript régénérés depuis la prod ne contiennent plus la table.

- **Q2 — Client Supabase** : `src/supabase/client.ts` et `src/lib/supabase.ts.template` supprimés, remplacés par un seul [src/lib/supabase.ts](src/lib/supabase.ts) qui combine `expo-secure-store` (chiffrement tokens) + typage `Database` généré. Imports mis à jour dans `sessionsService.ts` et `weatherService.ts`. Alias `@/lib/*` ajouté au `tsconfig.json`.

- **Q3 — NotificationPreferences** : type réécrit selon votre liste (rituels J-7/2/1 + cycle session + logistique). Champs `rank_change`, `new_record`, `new_follower`, `coach_response`, `new_message`, `mention`, `oxv_announcements`, `oxv_promotions` retirés. `DEFAULT_NOTIFICATION_PREFS` aligné. Pas de migration SQL nécessaire (colonne `users.notification_preferences` vide partout dans la base).

### Préalables logistiques (Q4, Q6)

- **`.env`** créé à la racine avec votre `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé legacy `eyJ...`). Présent en local, ignoré par git, confirmé par `git status` (aucune mention de `.env`).
- **`.gitignore`** ajusté : `*.ubx` reste ignoré globalement, sauf `test-fixtures/*.ubx` (pour les fixtures Q5 en semaines 3-4).
- **Git** : `git init`, branche `main`, premier commit `f7fe331`. Identité git locale : `OnlyXtremeVehicle <administration@oxvehicle.fr>` (déjà configurée).

### Setup Expo SDK 51

- **`package.json`** régénéré depuis `package.json.v1` (gardé en racine comme référence figée des deps V1 validées). Une seule divergence forcée : `@react-native-community/datetimepicker` pinné en `8.2.0` exact — la `8.6.0` qui sort par défaut exige Expo SDK 52, on est en 51.
- **`npm install`** : 1373 packages, exit 0, warnings deprecated normaux pour SDK 51 (nothing actionable).
- **Scripts npm** : `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `build:ios|android:dev|preview|prod`.

### Structure de code (jour 1)

```
oxv-app/
├── app/                          # Expo Router
│   ├── _layout.tsx               # SafeArea + StatusBar + init auth
│   ├── index.tsx                 # Redirige vers (auth) ou (app) selon état
│   ├── +not-found.tsx            # 404 dans le ton OXV
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx             # Écran "Entrez."
│   └── (app)/
│       ├── _layout.tsx           # Garde : redirige login si déconnecté
│       └── index.tsx             # "Bienvenue, {first_name}."
└── src/
    ├── ble/                      # V1 récupéré (intact)
    ├── components/               # vide pour l'instant
    ├── hooks/                    # vide
    ├── lib/
    │   └── supabase.ts           # Client fusionné
    ├── services/                 # V1 récupéré + imports mis à jour
    ├── store/
    │   └── useAuthStore.ts       # Zustand : init/signIn/signOut/profile
    ├── theme/
    │   └── tokens.ts             # Activé depuis le template
    ├── types/
    │   ├── database.types.ts     # Généré depuis Supabase (65 KB)
    │   ├── index.ts              # NotificationPreferences nettoyé
    │   └── telemetry.ts          # V1 intact
    ├── ubx/                      # V1 récupéré (intact)
    └── utils/                    # V1 récupéré (intact)
```

### Auth (jours 2-4 condensés)

- **`src/store/useAuthStore.ts`** : Zustand 5, expose `session`, `user`, `profile`, `status`, `error`. Actions : `initialize` (lit la session SecureStore au démarrage, branche `onAuthStateChange`), `signIn` (avec traduction FR des erreurs Supabase courantes), `signOut`, `refreshProfile`. Le profil lu sur `users` ne sélectionne que les colonnes utiles à l'app (`id, email, first_name, last_name, pilot_level, is_admin`) — pas de leak de PII.
- **`app/(auth)/login.tsx`** : eyebrow "OXV COACH" + titre "Entrez." + 2 champs + bouton primaire rouge. Bouton désactivé tant que les champs sont vides ou la requête en vol. Erreurs affichées en bas en `system.error`.
- **`app/(app)/index.tsx`** : "Bienvenue, {first_name}." + manifeste "Connexion établie. Cette semaine pose les fondations." + bouton "Se déconnecter" secondaire.

### Lint et typecheck

- **`tsc --noEmit`** : ✅ 0 erreur.
- **`eslint src/ app/`** : ✅ 0 erreur, 4 warnings — tous sur `sessionsService.ts` (3 `any` dans des helpers de conversion V1, 1 `Array<T>` au lieu de `T[]`). Volontairement laissés : ce fichier sera refait en semaine 5+ pour les vrais besoins. Les warnings ne polluent pas le CI.
- **Prettier `--write`** appliqué une fois sur l'ensemble pour normaliser les CRLF/whitespace du code V1. Aucune logique changée.

---

## Ce qui est testé et fonctionnel

Vérifiable côté code, en local sans device :

- [x] Les types `Database` reflètent la prod (sans `qdi_scores`).
- [x] Le client Supabase compile et se câble à `EXPO_PUBLIC_SUPABASE_URL`.
- [x] `npx tsc --noEmit` passe.
- [x] `npm run lint` passe sans erreur.
- [x] La migration `0007_drop_qdi_scores_doctrine_alignment` est dans `supabase_migrations.schema_migrations` côté prod.
- [x] Le `.env` est bien hors-git (vérifié `git status`).

**Pas encore validable sans vous** :

- [ ] Login bout-en-bout avec un vrai compte Supabase
- [ ] Affichage "Bienvenue {first_name}" lu depuis `users`
- [ ] Logout et persistance de la session (relancer l'app et rester connecté)
- [ ] Rendu visuel sur device iOS et Android

---

## Ce qui reste en suspens

### Immédiat (vous, ~30 min)

1. **Tester l'app sur votre téléphone** — l'app utilise `expo-dev-client` (requis pour BLE/Sentry à terme), donc **pas Expo Go**. Deux options :
   - **A (Mac)** : `npx expo run:ios` localement → installe une dev build sur simulateur iOS
   - **B (sans Mac)** : `npx eas build --platform ios --profile development` → vous installez le `.ipa` via TestFlight interne. Nécessite `eas login` au préalable.
   - **C (Android)** : `npx expo run:android` localement (Android Studio requis) ou `eas build --platform android --profile development`.
2. **Login avec votre compte admin** (votre compte existant ; on a décidé en Q4 de ne pas créer de compte de test).
3. **Push initial** : créer le repo `oxv-coach-app` sur GitHub (privé), puis :
   ```bash
   git remote add origin https://github.com/OnlyXtremeVehicle/oxv-coach-app.git
   git push -u origin main
   ```

### Points qu'on n'a pas faits cette semaine (par choix ou contraintes)

- **CI GitHub Actions** : la roadmap mentionne "CI basique" en semaine 1. Je n'ai pas créé le workflow car il dépend de l'existence du remote. Quand vous aurez créé le repo, je peux ajouter `.github/workflows/check.yml` (typecheck + lint sur chaque PR) en 5 minutes.
- **Assets** : `app.json` référence `./assets/icon.png`, `splash.png`, `adaptive-icon.png`. Le dossier `assets/` est vide. À fournir par vous (ou je génère des placeholders rouges sur fond noir si vous voulez en attendant).
- **Sentry DSN** : `@sentry/react-native` est installé et configuré dans `app.json`, mais sans DSN dans `.env`. C'est volontaire (R4 du rapport semaine 0) : Sentry no-op en dev. Vous me direz quand vous voulez l'activer en preview/prod.
- **WatermelonDB** : prévue semaine 2, non démarrée.

---

## Questions pour Gabin

### Q7 — Assets visuels

Pour l'icône, splash et adaptive-icon — vous fournirez vos visuels ou vous voulez que je génère des **placeholders provisoires** (insigne OXV stylisé, rouge `#C8102E` sur noir, exporté en PNG aux 3 résolutions) le temps que vous travailliez les définitifs ?

### Q8 — `.gitattributes` pour Windows

Git a affiché 70 warnings LF→CRLF au commit (normal sur Windows). Pour figer le comportement et éviter des surprises côté CI Linux, je peux ajouter un `.gitattributes` qui normalise tout en LF. Ok pour le faire dans le prochain commit ?

### Q9 — Compte EAS

Pour activer les builds EAS dev, j'aurais besoin de connaître le **propriétaire EAS** du projectId `d168d639-22e2-4190-a9ea-cc6a31e3acaa` (dans `app.json`). Si c'est encore actif sur votre compte, on peut l'utiliser ; sinon il faut en créer un nouveau via `eas init`. Pas urgent, je peux gérer ça quand vous voulez tester un build.

---

## Recommandations

### R6 — Ouvrir GitHub avant la semaine 2

Le CI workflow et le déploiement EAS reposent sur le remote. Le faire avant le démarrage de la semaine 2 évite un blocage en milieu de semaine 3 quand on voudra builder pour tester le BLE.

### R7 — Ne pas pousser `.env` sur CI

Pour le CI, ce sera **secrets GitHub Actions** (pas `.env`). Quand vous créez le repo, prévoyez d'ajouter à terme :
- `EXPO_PUBLIC_SUPABASE_URL` (peut être en variable publique)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (idem, c'est une clé publique)
- `EXPO_TOKEN` (pour les builds EAS automatisés, à générer depuis expo.dev)

### R8 — Si vous voulez tester sans builder

Pour valider rapidement que l'app démarre sans le pipeline EAS :
```bash
npx expo start --dev-client
```
Ne tournera pas sur Expo Go (dev-client requis) mais vous verrez si la compilation Metro passe sans erreur. Suffisant pour valider la structure.

---

## Estimation pour la semaine 2

Sous réserve de votre validation de ce rapport et du retour des tests device.

- **Jour 1-2 — Stores Zustand** : `useSessionStore`, `useTelemetryStore`, `useUIStore`, `useAppStateStore` (la state machine S1-S10 du sitemap). `useAuthStore` est déjà là.
- **Jour 3-4 — WatermelonDB** : modèles miroirs des tables Supabase critiques (`telemetry_sessions`, `app_laps`, `users`), sync bidirectionnelle, gestion conflits last-write-wins. Note : WatermelonDB requiert un dev-client (ce qu'on a déjà installé).
- **Jour 5 — Types métier exhaustifs** + revue + rapport.

Estimation : **5 jours-claude**, sans dépendance externe sauf si vous voulez activer Sentry en preview à ce moment-là.

---

## En résumé

La semaine 1 fait ce qu'elle devait : poser les fondations, sans rien coder de métier. Les trois choix doctrinaux (Q1-Q3) sont actés à la fois en base et dans le code. La structure Expo Router est en place, l'auth Zustand câble Supabase via SecureStore, le typecheck est clean.

Le seul vrai trou est le **smoke test sur device** que je ne peux pas faire à votre place. Quand vous l'aurez fait et que le "Bienvenue, Gabin" s'affiche après votre login, on peut considérer la semaine 1 validée et passer à la semaine 2.

— Claude Code, 24 mai 2026

---

## Addendum — réponses Q7/Q8/Q9 et nouveaux livrables

Reçu vos validations Q7 (placeholders), Q8 (.gitattributes), Q9 (compte EAS option B). Trois nouvelles tâches actées en fin de semaine 1.

### Q8 — .gitattributes (livré)

Commit `8172157`. Template appliqué : LF par défaut, binaires marqués (`*.png`, `*.ubx`, fonts, etc.), `*.bat/.cmd/.ps1` autorisés en CRLF, `package-lock.json` et `src/types/database.types.ts` marqués `linguist-generated`. Renormalize lancé : 0 fichier touché — git avait déjà stocké en LF via `autocrlf=true` au premier commit. Plus aucun warning CRLF lors des commits suivants.

### Q7 — Placeholders assets (livré)

Commit `562b360`. Trois PNG générés par [scripts/generate-placeholder-assets.js](scripts/generate-placeholder-assets.js) :
- `assets/icon.png` 1024×1024 — insigne stylisé bouclier-casque (visière + V + X central), rouge `#C8102E` sur fond `#050505`
- `assets/splash.png` 2048×2048 — même insigne plus petit, abondance de fond noir
- `assets/adaptive-icon.png` 1024×1024 — foreground sur fond transparent (Android)

Corrigé aussi `app.json` : `splash.backgroundColor` et `android.adaptiveIcon.backgroundColor` passés de `#0B1220` (résidu V1) à `#050505` (vraie charte OXV). Le script peut être relancé pour régénérer.

**À ne pas confondre avec les définitifs.** PNG estampillés "PLACEHOLDER" dans le commit message. À remplacer par les visuels designer avant la soumission stores (semaine 14).

### Q5 — Capture UBX (livré, par anticipation)

Commit `a132a49`. Pipeline complet pour produire des fixtures `.ubx` réelles depuis un RaceBox physique, en vue des tests parser/BLE des semaines 3-4 :

- [src/ble/bluetoothService.ts](src/ble/bluetoothService.ts) reçoit un nouveau `onRawData(listener)` qui émet les bytes BLE bruts **avant** le resync du `UbxFrameBuffer` (sans bouger le pipeline existant)
- [src/ble/captureMode.ts](src/ble/captureMode.ts) : module standalone `start`/`stop`/`share`, écrit en base64 via `expo-file-system` dans `${documentDirectory}/fixtures/racebox-capture-{ts}.ubx`
- [app/(app)/debug-capture.tsx](app/(app)/debug-capture.tsx) : écran scan → connect → start → stop → share, stats live (chunks, bytes, durée) avec rerender 500 ms pendant la capture
- Lien "Mode debug — capture UBX" sur l'écran d'accueil visible **uniquement** sous `__DEV__`
- [scripts/README_CAPTURE_UBX.md](scripts/README_CAPTURE_UBX.md) : pas-à-pas pour vous + replay Node.js pour les tests parser

Deps ajoutées : `expo-file-system` 17.0.1, `expo-sharing` 12.0.1 (Expo SDK 51).

### Q9 — Compte EAS (en attente côté vous)

Décidé option B : nouveau compte Expo dédié `oxv@oxvehicle.fr`. Action préalable côté vous : configurer la redirection OVH `oxv@oxvehicle.fr → votre boîte` (5 minutes), puis `sign up` sur expo.dev, puis `eas login` et `eas init` dans le projet. Pas urgent jusqu'à fin de semaine 2 ; bloquant à partir de la semaine 3 (BLE = build natif requis).

### État final de la semaine 1

Cinq commits sur `main` :
1. `f7fe331` — chore: initialisation projet
2. `12784fb` — docs: rapport semaine 1
3. `8172157` — chore: .gitattributes
4. `562b360` — chore(assets): placeholders
5. `a132a49` — feat(debug): capture UBX

Typecheck OK, lint 0 erreur (4 warnings legacy V1 sur `sessionsService.ts`, à nettoyer en semaine 5 quand on retouchera ce service).

### Ce qui reste à votre main pour clôturer la semaine 1

1. Smoke test sur device (`npx expo run:ios` / `npx eas build … --profile development`)
2. Login + vérifier "Bienvenue, Gabin." + logout
3. Créer le repo GitHub `oxv-coach-app` privé et push : `git remote add origin … && git push -u origin main`
4. (À votre rythme) configurer `oxv@oxvehicle.fr` chez OVH puis `eas init` (avant semaine 3)

Pas de démarrage de la semaine 2 sans votre feu vert sur ces 4 points.

— Claude Code, addendum 24 mai 2026 (soirée)
