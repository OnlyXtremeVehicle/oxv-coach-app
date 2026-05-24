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
