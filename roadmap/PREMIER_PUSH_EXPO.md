# Premier push Expo — runbook EAS

> Préparé le 2026-06-13. Issu de l'audit multi-agents de readiness EAS
> (config, secrets, CI, doctrine) avec vérification adverse des bloqueurs.
> Voir aussi `roadmap/DEPLOIEMENT_SUPABASE.md` (backend) et
> `docs/architecture/03_PARTIE_3_deploiement.md` (vision déploiement).

---

## 1. Ce qu'est « le premier push »

Dans ce projet, le premier push Expo **n'est pas une publication App Store /
Google Play**. La doctrine (`CLAUDE.md`) interdit toute soumission store sans
accord explicite de Gabin.

Le premier push = **le tout premier `eas build` réussi en distribution interne**
(profil `preview`), qui produit un binaire installable par les pilotes alpha :

- iOS : distribution interne EAS / TestFlight interne ;
- Android : APK directement sideloadable (ou Play Internal Testing).

C'est le prérequis technique de tout `eas submit` et `eas update` ultérieur.

---

## 2. État de préparation (prêt côté repo)

- Identité applicative complète : `name=OXV`, `slug=oxv-app`, `owner=oxv`,
  `scheme=oxv`, `ios.bundleIdentifier = android.package = fr.oxvehicle.app`
  (valeurs réelles, aucun placeholder), `extra.eas.projectId =
  d168d639-22e2-4190-a9ea-cc6a31e3acaa`.
- `eas.json` : 3 profils (`development`, `preview`, `production`). `development`
  et `preview` en `distribution: internal`. `cli.appVersionSource = remote` +
  `production.autoIncrement = true` (numéros de build gérés côté EAS).
  `android.buildType` explicité par profil (APK interne, AAB prod).
- Stack Expo SDK 51 cohérente : `expo ~51.0.28`, `react-native 0.74.5`,
  `expo-router ~3.5.23`, `expo-dev-client ~4.0.27`, `@sentry/react-native ~5.24.3`.
- 6 scripts npm de build EAS prêts : `build:{ios,android}:{dev,preview,prod}`.
- Config-plugins de prebuild en place (router, apple-auth, ble-plx, image-picker,
  secure-store, notifications) avec purpose strings FR iOS + permissions Android.
- Clé Google Maps Android externalisée (PR #74) : injectée au build via
  `app.config.js` depuis `GOOGLE_MAPS_ANDROID_KEY` ; jamais commitée. Absente,
  l'app ne crashe pas (carte Android dégradée seulement).
- Hygiène des secrets correcte : `.env` gitignoré et absent du repo ;
  `.env.example` ne contient que des placeholders ; secrets serveur lus
  uniquement dans les Edge Functions (Deno.env), jamais préfixés `EXPO_PUBLIC_`.
- **Backend Supabase de prod déjà déployé** (voir §5).

---

## 3. Les deux verrous critiques (côté Gabin)

Le repo est prêt à builder ; les deux seuls verrous sont organisationnels et
**ne peuvent pas être levés par Claude** :

### BLK-2 — Compte EAS `oxv@oxvehicle.fr` (le « Q9 », bloquant depuis la sem. 1)

Sans `eas login` authentifié sur le compte `oxv`, **aucun** `eas build` ni
`eas secret:create` n'est possible.

À faire (Gabin) : créer/valider le compte Expo `oxv@oxvehicle.fr` → `eas login`
sur le poste de build → `eas whoami` → vérifier que `owner=oxv` et le `projectId`
d'`app.json` correspondent au compte (sinon `eas init` pour relier). Le plan EAS
Build Free suffit (< 30 builds/mois).

### BLK-1 — Variables Supabase requises au build (sinon crash au boot)

`src/lib/supabase.ts:18-22` **lève une exception au chargement du module** si
`EXPO_PUBLIC_SUPABASE_URL` ou `EXPO_PUBLIC_SUPABASE_ANON_KEY` manquent. Ces
variables `EXPO_PUBLIC_*` sont inlinées par Metro **au moment du build** :
absentes du build EAS, elles valent `undefined` dans le bundle → l'app crashe
au démarrage.

`eas.json` n'injecte aujourd'hui que `EXPO_PUBLIC_PLAUSIBLE_DOMAIN`. Il faut donc
provisionner les deux variables Supabase côté EAS **avant le premier build**.

**Option A (recommandée — secrets hors dépôt, couvre tous les profils)** :

```sh
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://fouvuqkdxarjpjbqnsjq.supabase.co --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value <CLE_ANON_REELLE> --type string
eas secret:list
```

L'URL est publique (connue) ; la clé anon est à fournir par Gabin (publique au
sens Supabase — protégée par RLS — mais préférable en secret EAS qu'en clair
dans le dépôt).

**Option B (alternative)** : inliner les deux dans le bloc `env` de **chaque**
profil de `eas.json`. Attention : il faut alors les ajouter aussi au profil
`development` (qui a son propre bloc `env`), sinon ce profil resterait sans
Supabase. L'option A (scope projet) couvre automatiquement tous les profils et
évite cet oubli.

---

## 4. Séquence exacte du premier push

```sh
# 0. Prérequis poste de build
node --version                 # >= 18 (CI = Node 20)
npm i -g eas-cli               # eas-cli >= 5.9.0 (imposé par eas.json, non en devDeps)
eas --version

# 1. Dépendances
npm ci

# 2. Connexion au compte EAS oxv  (résout BLK-2 — GABIN)
eas login                      # compte oxv@oxvehicle.fr
eas whoami

# 3. Vérifier le lien projet
eas project:info               # owner=oxv, projectId=d168d639-...  (sinon: eas init)

# 4. Provisionner Supabase  (résout BLK-1, CRITIQUE — voir §3 option A)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://fouvuqkdxarjpjbqnsjq.supabase.co --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value <CLE_ANON_REELLE> --type string
eas secret:list

# 5. (Optionnel) Clé Google Maps Android — sinon carte Android grise
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_KEY \
  --value <CLE_MAPS_RESTREINTE> --type string

# 6. >>> PREMIER PUSH <<< build interne preview iOS + Android
eas build --profile preview --platform all
#   distribution=internal => pas de review store.
#   iOS demandera de générer/uploader les credentials de signature au 1er run
#   (nécessite un compte Apple Developer — cf. §6 BLK-7).
#   Variantes : npm run build:ios:preview  /  npm run build:android:preview

# 7. Distribuer aux pilotes alpha
#   Récupérer le lien/QR d'install fourni par EAS (page de build).
#   iOS = TestFlight interne / lien ad-hoc ; Android = APK sideload.
```

De-risking optionnel avant l'étape 6 : `eas build --profile development
--platform ios` pour valider la chaîne credentials/prebuild avec un dev-client
(nécessite ensuite `npm start` en parallèle pour charger le JS).

---

## 5. Backend Supabase : déjà déployé (ne pas re-dérouler le runbook)

Vérifié sur la base de prod `fouvuqkdxarjpjbqnsjq` (ACTIVE_HEALTHY, Postgres 17.6)
le 2026-06-13 — **tout est en place** :

- migrations 0027 → 0040 toutes appliquées (+ postérieures du 2026-05-30) ;
- bucket Storage `session-media` (privé) présent ;
- secrets Vault : `edge_functions_base_url`, `edge_functions_invoke_secret`,
  `cron_token` ;
- 9 Edge Functions déployées et ACTIVE (generate-debrief-ai, cron-analyze-...,
  send-coach-invitation, 6 notify-*) ;
- cron horaire `cron-analyze-pending-sessions` actif (header X-Cron-Token) ;
- 12 nouvelles tables (pilot_friendships, session_media, coach_permissions, ...)
  toutes avec RLS active.

`roadmap/DEPLOIEMENT_SUPABASE.md` décrit ce déploiement : il est **fait**. Seule
réserve non vérifiable en lecture : la valeur réelle des clés API serveur
(OPENAI / RESEND / CRON_TOKEN). Lancer `get_advisors` avant la distribution alpha.

---

## 6. Reporté (PAS pour le premier push)

| Réf | Sujet | Quand | Qui |
|-----|-------|-------|-----|
| BLK-5 | Smoke test device (iPhone iOS 16+ **et** Android 11+, RaceBox appairé, `docs/SMOKE_TEST_DEVICE.md` phases A-G) | sur le build preview, **avant** toute prod | Gabin + dev |
| BLK-7 | Comptes stores : Apple Developer (99 $/an, délai 24-72 h) + Google Play Console (25 $) ; remplir `submit.production` (appleId/ascAppId/appleTeamId, serviceAccountKeyPath/track) | avant `eas submit` | Gabin (Claude prépare la structure) |
| BLK-6 | Soumission store : `eas submit` **interdit sans go explicite** de Gabin | sem. 14 | Gabin |
| BLK-3 | EAS Update / OTA non câblé (`expo-updates` absent, pas de `runtimeVersion`/`updates.url`) : `npx expo install expo-updates && eas update:configure`, channel par profil | après le 1er build natif, si OTA souhaité | Claude |
| BLK-8 | iOS : `NSAllowsArbitraryLoads=true` (ATS désactivé) → justifier ou restreindre via `NSExceptionDomains` | avant review App Store | Gabin + Claude |
| BLK-9 | Sentry : DSN absent + plugin retiré (sem. 14) → no-op tant qu'aucun DSN. Stratégie d'intégration SDK 51 à décider si Sentry voulu en prod | avant prod | Claude + Gabin |

---

## 7. Ce que Gabin doit fournir (synthèse)

1. Compte Expo `oxv@oxvehicle.fr` opérationnel + `eas login` (BLK-2). **Bloquant absolu.**
2. La valeur réelle de la clé anon Supabase (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) du
   projet `fouvuqkdxarjpjbqnsjq` (BLK-1). L'URL est connue.
3. Apple Developer Program ouvert (signature iOS dès le build interne) (BLK-7).
4. Google Play Console ouverte (Android) (BLK-7).
5. (Optionnel) Clé Google Maps Android restreinte (BLK-7/Maps).
6. Go formel avant tout `eas submit` (BLK-6).
7. Smoke test device avant toute prod (BLK-5).
