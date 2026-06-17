# OXV Mirror — Brief de passation pour claude.ai

> But : donner à **claude.ai** (Claude dans le chat) tout le contexte pour aider à
> finaliser l'app, **sans** accès au dépôt, à Supabase ni aux builds.
> Rédigé le 2026-06-08 depuis Claude Code (qui, lui, a accès au code + backend).
>
> **À faire par Gabin** : copier-coller ce fichier dans claude.ai en début de conversation.
> Pour un sujet précis, y joindre aussi le(s) doc(s) listé(s) au §11.

---

## 0. Ce que claude.ai peut / ne peut pas faire ici

claude.ai (chat) **n'a pas** accès au dépôt, à la base Supabase, ni à EAS.
- ✅ Il peut : écrire/relire du code React Native, concevoir des écrans (artifacts),
  rédiger des contenus/textes (dans la doctrine), débugger un extrait collé, planifier.
- ❌ Il ne peut pas : builder/déployer l'app, lire la vraie base, lancer les tests.
  Ces étapes restent dans **Claude Code** (terminal) + **EAS** + **Supabase**.

Donc « finaliser avec claude.ai » = générer/corriger des morceaux précis, puis les
réintégrer côté Claude Code. Toujours **coller le code à modifier** ou le décrire.

---

## 1. Le projet en 30 secondes

**OXV Mirror** = app mobile (React Native) compagnon d'OXV (track days premium au
Circuit de Haute Saintonge à Bouteville). Elle restitue au pilote une lecture
**posée et factuelle** de sa conduite **après** chaque session, à partir de la
télémétrie d'un boîtier Bluetooth (RaceBox Mini).

**Doctrine fondatrice** : « L'app est un miroir. Elle vous montre. Elle ne vous
dirige pas. »

### 5 principes NON négociables
1. **Sécurité avant performance** — le mot « limite » est remplacé par « marge » partout.
2. **Miroir, pas coach** — aucune instruction de pilotage. On décrit, on questionne, on ne prescrit pas.
3. **Silence en piste** — aucun écran/son/notif pendant que le véhicule roule.
4. **Ton OXV** — vouvoiement systématique, **pas d'emojis**, phrases courtes, style « Ferrari sec ». Pas de marketing creux.
5. **Un seul chiffre par écran** — un indicateur central (la marge en %), le reste qualitatif.

### Verbes INTERDITS dans le contenu (scannés en CI)
« Freinez plus tôt », « Accélérez », « Prenez une trajectoire… », « Vous devriez »,
« Il faut », « Évitez de ». + anglicismes (« tap » → « appui », etc.).
### Verbes AUTORISÉS
« Une zone à observer », « À creuser la prochaine fois », « Était-ce volontaire ? »,
« Confortable », « Terrain serré », « Apprivoisé ».

### Interdits produit (cohérence doctrine)
Pas de classement entre pilotes, pas de score sécurité public, pas de gamification
(badges/succès), pas de notion de « record ».

---

## 2. État actuel (juin 2026, J−~27 avant l'alpha de Bouteville le 5 juillet 2026)

**L'app est fonctionnellement quasi-complète.** ~95 % du périmètre cahier est codé.

### ✅ Fait et opérationnel
- Doctrine + rebrand « OXV Coach » → « OXV Mirror » complets.
- **4 piliers factuels** (remplacent l'ancien « QDI ») : Signature de pilotage,
  Régularité, Évolution, Carte de chaleur.
- Capture BLE RaceBox + parser UBX + détection de tours + analyse de session.
- Espace **pilote** complet (accueil, bilan, virage, progression, comparateur,
  galerie média, objectifs, réglages, onboarding + pacte).
- Espace **social** : amis (opt-in mutuel), « côte à côte » entre copains, carte
  sociale (pings événements), carte écosystème nationale (annuaire circuits + services).
- Espace **coach** : rôle + permissions modulaires, annotations, repères par virage,
  priorisation du bilan, gabarits, « lecture du coach », roulages, tableau de bord business.
- Espace **admin** (back-office bronze) : sessions, coachs, analytique, média, circuit.
- **Backend Supabase 100 % déployé** (migrations 0001→0040, RLS, 9 Edge Functions,
  bucket `session-media`, cron horaire d'analyse).
- **Build iOS ad-hoc opérationnel** (cf. §8).

### 🟠 Ce qui reste (chemin critique = juridique + finition, pas dev)
1. **Bug login post-auth** (cf. §7) — bloquant pour tester.
2. **Relecture juridique** des 5 docs (pacte, CGU, CGV, RGPD, pacte coaching) au prisme
   « restitution vs coaching » — **validation Gabin requise**, brief avocat à produire.
3. **Clé Google Maps Android** non créée (iOS = Apple Maps, OK ; Android = cartes grises
   tant que le secret n'est pas posé).
4. **TestFlight** non câblé (build ad-hoc OK ; cf. §8).
5. **Données de référence** : tables `circuit_services` / circuits écosystème prêtes mais vides.
6. **Différé post-alpha** : §8 étape B (réservation + commission marketplace — prérequis
   juridique micro-entreprise), gating premium.

---

## 3. Stack technique (versions EXACTES — contrainte forte)

| Élément | Version | Note |
|---|---|---|
| Expo SDK | **51** | RN 0.74.5, **ancienne architecture** |
| React Native | 0.74.5 | |
| React | 18.2.0 | |
| TypeScript | strict, pas de `any` | |
| Navigation | **expo-router** (file-based, `typedRoutes`) | groupes `(app)`, `(auth)`, `(onboarding)`, `(coach)`, `(coach-onboarding)`, `(admin)` |
| State | **Zustand** v5 | |
| Storage local | **react-native-mmkv v2.12.2** | ⚠️ PAS v3/v4 (Nitro = RN≥0.75, incompatible SDK 51). API : `new MMKV({id})`, `.delete()` (pas `.remove()`) |
| Backend | **Supabase** (`@supabase/supabase-js`) | projet Frankfurt, ref `fouvuqkdxarjpjbqnsjq` |
| Auth tokens | **expo-secure-store** | jamais MMKV pour les tokens |
| BLE | react-native-ble-plx v3 | |
| Cartes | **react-native-maps 1.14.0** | `PROVIDER_DEFAULT` (iOS=Apple Maps, Android=Google → clé requise) |
| Graphes | react-native-svg 15.2.0 | pas de lib de charting lourde |
| Date picker | @react-native-community/datetimepicker 8.2.0 | |
| Erreurs | @sentry/react-native ~5.24 | init conditionnelle |

**Règle d'or compat** : toute lib native ajoutée doit supporter **RN 0.74 / SDK 51 /
ancienne architecture**. Sinon le `pod install` iOS casse (c'est ce qui est arrivé
avec MMKV v4).

---

## 4. Backend Supabase

- **Projet** : ref `fouvuqkdxarjpjbqnsjq` (région Frankfurt).
- **Variables app** (build) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (clé anon = publique, normale côté client ; RLS protège tout).
- **service_role** : JAMAIS côté client, jamais en clair. Uniquement Edge Functions.
- **Migrations** : 47 fichiers, numérotés jusqu'à **0040**, toutes appliquées en prod.
  Convention de nommage : `AAAAMMJJHHMMSS_00NN_nom.sql`.

### Tables principales
`users` (profil + `role` ∈ {pilot, coach, admin}, exclusif), `telemetry_sessions`,
`laps`, `circuits`, `app_session_analyses`, `app_segment_analyses`,
`app_progression_shares`, `pilot_goals`, `pilot_friendships`, `social_pings`,
`circuit_services`, `session_media`, `coach_pilots`, `coach_annotations`,
`coach_permissions`, `coach_roulages`, `roulage_invitations`, `coach_session_context`,
`coach_corner_reference`, `coach_pilot_highlight`, `coach_annotation_template`,
`coach_reading_weights`, `notif_throttle_log`, `pricing`.

### Helpers RLS (SECURITY DEFINER — à connaître pour écrire des policies/requêtes)
- `is_admin()` → `role='admin'`
- `is_coach()` → `role='coach'`
- `is_coach_of(pilot_uuid)` → **1 argument** ; vrai si `coach_pilots` lie `auth.uid()` au pilote, `active` + `pilot_consent_at` non nul
- `is_my_coach(coach_uuid)`
- `are_friends(a_uuid, b_uuid)` → 2 arguments
- `is_validated_member()`
- `coach_has_permission(coach_uuid, name)` → name ∈ {view_pilots, manage_own_sessions, view_business_dashboard}

**Le rôle est unique** : un admin n'est pas coach et inversement. Le routage de l'app
dépend du rôle (cf. bug §7).

### Edge Functions (9, déployées, ACTIVE)
`generate-debrief-ai` (verify_jwt=true), `send-coach-invitation` (true),
6 × `notify-*` (false, appelées par triggers DB via pg_net + secret Vault),
`cron-analyze-pending-sessions` (false, cron horaire actif).

### Garde-fou IA (juridique)
`generate-debrief-ai` a un **garde-fou déterministe** : scan des verbes interdits sur
la sortie GPT + retry + refus 422 → fallback local descriptif. Rien de prescriptif ne
peut atteindre le pilote. **Ne pas affaiblir ce garde-fou.**

---

## 5. Architecture de l'app (expo-router)

Groupes de routes dans `app/` :
- `(auth)` : `login` (+ `_layout`).
- `(onboarding)` : `index`, `pacte`, `doctrine`, `methode`, `niveau`, `cgu`.
- `(app)` : espace pilote — `index` (accueil), `bilan`, `virage`, `signature`,
  `regularite`, `progression`, `heatmap`, `comparateur`, `tours`, `stats`, `telemetry`,
  `replay`, `debrief`, `prochaine-fois`, `objectifs`, `amis`, `social`, `social-carte`,
  `circuits`, `circuit/[id]`, `mon-coach`, `roulages`, `session-media/[sessionId]`,
  `cote-a-cote/[friendId]`, `partage`, `share/[token]`, `settings`, + flow piste
  (`paddock`, `placement`, `entre-runs`, `pilotage-fini`, `bilan-pret`, `donnees-securite`).
- `(coach)` : `index`, `pilote/[id]`, `comparer-pilotes`, `annoter`, `reperes`,
  `repere/[index]`, `priorites`, `gabarits`, `lecture`, `contexte`, `business`,
  `roulages/{index,nouveau,[id]}`.
- `(coach-onboarding)` : `index`, `pacte`, `mission`.
- `(admin)` : `index`, `sessions-media`, `coachs`, `coachs/[id]`, `analytique`,
  `preparation`, `en-cours`, `circuit`.
- `app/_layout.tsx` : layout racine + **garde d'auth + routage par rôle** (point chaud, cf. §7).
- `app/index.tsx` : route initiale (redirige selon session/rôle).

**Services** (logique métier, dans `src/services/`) : ~47 fichiers. Pattern : la
logique pure (testable Jest) est isolée dans des fichiers `*Logic.ts` **sans** import
Supabase ; les `*Service.ts` font les I/O Supabase. Ex : `roulagesLogic.ts` (pur) +
`roulagesService.ts` (I/O).

Design system : `src/theme/tokens.ts` (couleurs, typo, espacements) — **à utiliser
partout**, jamais de valeurs en dur. Fond très sombre (#050505), accent rouge OXV (#C8102E).

---

## 6. Conventions de code (sinon la CI casse)

- **TypeScript strict**, pas de `any` (sauf justifié). Hooks fonctionnels, pas de classes.
- **CI GitHub Actions** (`.github/workflows/check.yml`) sur chaque PR :
  `typecheck` + `eslint` + `prettier --check` (sur `src/**` et `app/**`) + `jest`
  + **scan doctrine** (`scripts/check-doctrine.ts` : verbes interdits + anglicismes)
  + **scan accessibilité** (`scripts/check-accessibility.ts` : tout `Pressable` doit
  avoir un `accessibilityRole`).
- **Branche protégée `main`** : tout passe par PR + CI verte. Workflow : branche →
  commit → push → PR → CI → squash-merge.
- Tables non encore typées dans `database.types.ts` : pattern
  `.from('table' as never).select('*' as never)` puis cast `as unknown as Row`.
- Tests Jest = **logique pure uniquement** (`**/__tests__/**/*.test.ts`), pas de natif.
- **Pas de localStorage/sessionStorage** (casse l'offline-first) ; MMKV pour le cache,
  SecureStore pour les secrets.

---

## 7. ⚠️ Bug login actuel (diagnostic précis)

**Symptôme** : sur le build iOS, l'utilisateur reste bloqué sur l'écran de connexion ;
identifiants corrects mais « ça ne se connecte pas ».

**Ce qui est ÉCARTÉ (vérifié côté serveur)** :
- Clé anon valide (`/auth/v1/settings` → 200, clés legacy non désactivées).
- Email confirmé (`email_confirmed_at` non nul).
- **L'authentification RÉUSSIT** : `last_sign_in_at` se met à jour à chaque tentative.
  Donc Supabase accepte identifiants + clé.

**Conclusion** : le problème est **APRÈS l'auth**, dans l'app — la session est obtenue
mais l'app ne quitte pas l'écran de login. Pistes, par ordre de probabilité :
1. **Routage post-login par rôle** : le compte de test est passé en `role='coach'`
   (pour tester l'espace coach) avec `coach_pact_accepted_at` probablement nul →
   le routage vers `(coach)` / `(coach-onboarding)` peut boucler ou planter.
2. **Persistance de session** sur le build : vérifier l'adaptateur d'auth Supabase
   (`src/lib/supabase.ts`) — doit utiliser un storage (SecureStore) + `onAuthStateChange`
   doit déclencher la navigation.
3. **Garde d'auth** dans `app/_layout.tsx` / `app/index.tsx` : la redirection après
   session peut ne pas se déclencher, ou attendre un profil qui échoue.

**Fichiers à inspecter (à coller dans claude.ai)** : `app/_layout.tsx`,
`app/index.tsx`, `app/(auth)/login.tsx`, `src/lib/supabase.ts`, et le store d'auth
(Zustand) s'il existe.

**Débogage rapide possible** : repasser le compte de test en `admin` (le routage admin
fonctionnait avant) pour isoler si le bug est spécifique au rôle coach.

---

## 8. Build & déploiement

- **EAS** : compte `oxv` (org), projet `oxv-app`, propriétaire Apple **Individual**
  (team `K53YDJ3Y55`). bundle/package = `fr.oxvehicle.app`.
- **iOS preview = ad-hoc interne** : ✅ build réussi, installable sur l'iPhone
  enregistré (1 device au profil). S'installe via la page EAS du build (bouton Install /
  QR). Expire ~14 jours après le build.
- **Profils** (`eas.json`) : `development`, `preview` (interne), `production`.
  `EXPO_PUBLIC_PLAUSIBLE_DOMAIN=oxvehicle.fr` injecté en `env` preview+production.
- **Clé Google Maps Android** : externalisée dans `app.config.js` via
  `process.env.GOOGLE_MAPS_ANDROID_KEY` (jamais commitée). À créer par Gabin :
  `eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_KEY --value <clé> --type string`
  (clé restreinte au package `fr.oxvehicle.app` + SHA-1, API « Maps SDK for Android »).
- **TestFlight** : pas encore câblé. Requiert (action Gabin) une **clé API App Store
  Connect** (.p8, rôle App Manager) ; ensuite build `production` + `eas submit`.

---

## 9. Pour « finaliser » — priorités

1. **Débloquer le login** (§7) — sinon rien n'est testable.
2. **Relecture juridique** des 5 docs + brief avocat (seul vrai bloquant légal).
   ⚠️ Toute modif de texte juridique = **validation Gabin obligatoire**.
3. **Finition UX** des écrans clés (accueil, bilan, virage) au regard de la doctrine
   et des design tokens.
4. **Clé Google Maps Android** (sinon cartes grises sur Android).
5. **TestFlight** pour distribuer aux pilotes alpha.
6. **Données de référence** (circuits + services) à saisir.

---

## 10. Garde-fous (à respecter par claude.ai)

- **Doctrine** : vouvoiement, zéro emoji, verbes interdits (§1). Tout contenu pilote
  est descriptif/interrogatif, jamais prescriptif.
- **Jamais** de classement, score public, gamification, « record ».
- **service_role** jamais côté client ; `.env` jamais commité ; clé Maps restreinte.
- **Schéma de prod** : toute modif = migration + validation Gabin (ne pas inventer de
  tables/colonnes sans vérifier le schéma réel — cf. doc §11).
- **Compat SDK 51** pour toute dépendance native.
- En cas de doute : **faire simple et conforme à la doctrine**, pas complexe et innovant.

---

## 11. Specs détaillées (à uploader à claude.ai selon le sujet)

Le dépôt contient les specs complètes. À joindre au cas par cas :
- **Doctrine & composants** : `docs/specs-bundle-v4/01_doctrine_et_composants.md`
- **Moteur d'insights (restitution)** : `docs/specs-bundle-v4/02_moteur_insights.md`
- **Schéma Supabase réel** : `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md` ⭐ (pour toute requête/migration)
- **Design tokens** : `docs/screens/01_DESIGN_TOKENS.md`
- **Vue des écrans** : `docs/screens/00_OVERVIEW_26_ECRANS.md`
- **Espace coach** : `docs/specs-bundle-v4/06_espace_coach.md`
- **Social / RGPD** : `docs/specs-bundle-v4/07_social_rgpd.md`
- **Carte lieux/écosystème** : `docs/specs-bundle-v4/08_carte_lieux.md`
- **Chartes éthiques** : `docs/specs-bundle-v4/10..13_*.md`
- **Juridique** : `docs/juridique/*.md`
- **Audit d'état** : `roadmap/AUDIT_OXV_MIRROR.md`

> `docs/specs-bundle-v4/` est le paquet de specs **faisant foi** (le plus récent).
> `specs-bundle-v2` est une version antérieure (historique).

---

*Fin du brief. Pour exécuter (build, DB, tests), revenir vers Claude Code.*
