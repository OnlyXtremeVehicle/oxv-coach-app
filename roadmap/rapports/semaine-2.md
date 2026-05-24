# Rapport semaine 2 — State machine, stores, CI

**Date** : 24 mai 2026 (suite logique du semaine 1, "continuons")
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : jours 1-3 livrés. Jour 4-5 (WatermelonDB) en attente d'arbitrage Q10.

---

## Ce que j'ai fait

### Lecture (Étape 3 du onboarding terminée)

Lu les 3 cartes restantes du sitemap :
- [01_architecture_statique](docs/sitemap/01_architecture_statique.md) — 6 zones, 26 écrans pilote + 3 vues admin, 4 tiers de priorité
- [02_parcours_temporel](docs/sitemap/02_parcours_temporel.md) — la dramaturgie en 9 jours (J-7 → J+1), 8 moments-clés
- [03_flux_navigation](docs/sitemap/03_flux_navigation.md) — hub #20 + topbar + 3 branches + 4 couches conditionnelles

Combiné avec `04_state_machine` lue en semaine 1, j'ai maintenant les 4 dimensions complètes pour coder.

### Types métier (jour 1)

[src/types/state.ts](src/types/state.ts) — spec complète de la state machine OXV :

- `PilotState` (10 valeurs S1..S10) + `ALL_PILOT_STATES`
- 6 unions de conditions modulatrices : `NetworkCondition`, `BluetoothCondition`, `GeolocationCondition`, `AppVersionCondition`, `EquipmentCondition`, `PactCondition`
- `Conditions`, `DEFAULT_CONDITIONS`
- `AppContext`, `SessionRef`, `RecordingState`, `PositionFix`
- `ScreenId` (union des 26 écrans) + `VALID_SCREENS_BY_STATE` (Record exhaustif) + `isScreenValid(id, state)`
- `STATE_THRESHOLDS` centralisés (rayon circuit `1km`, seuil vitesse `60km/h`, fenêtre post-session `2h`, fenêtre décantation `48h`, horizon anticipation `14j`, fenêtre approche `12h`)
- `determineState(ctx): PilotState` — fonction pure, ordre d'évaluation cohérent avec le sitemap, sécurité par défaut `S3_attente` si contexte ambigu

[src/types/domain.ts](src/types/domain.ts) — concepts produits transversaux :

- `MarginPercent`, `MarginZone` (`green` | `yellow` | `red`), `MarginLabel` (`'Confortable'` | `'À explorer'` | `'Terrain serré'`)
- `MarginThresholds` + `DEFAULT_MARGIN_THRESHOLDS` (30/15) + `marginZoneOf()` + `marginLabelOf()` (vouvoiement + verbes OXV)
- `HomeHubMode` (`countdown` | `enroute` | `passive`) pour les 3 modes de l'écran #20
- `HeritageTier` (`access` | `signature` | `promotion` | `heritage`) + `heritageProgressFor(sessions)` — utile aussi pour la page progression oxvehicle.fr
- `LapMarker` / `LapMarkerKind` pour le bouton Flic 2

### Stores Zustand (jour 2)

Quatre stores créés dans `src/store/` :

**[useAppStateStore](src/store/useAppStateStore.ts)** — source de vérité de `state: PilotState`. `recompute()` appelle `determineState()` à chaque setter de contexte. Volontairement, `setCondition()` ne déclenche **pas** de recompute : les conditions techniques modulent les overlays UI (cf. useUIStore), pas l'état machine principal. `canShowScreen(id)` exposé comme sélecteur pour les guards de route.

**[useUIStore](src/store/useUIStore.ts)** — `hubMode`, `offlineBannerVisible`, `bleErrorModalVisible`, `updateModalVisible`, `notificationsBadgeVisible`, `unreadNotificationsCount` avec mutateur lié.

**[useSessionStore](src/store/useSessionStore.ts)** — session de roulage active. `status: RecordingStatus` (`idle` | `recording` | `paused` | `completed` | `aborted`). `startSession`, `pauseSession`, `resumeSession`, `endSession`, `abortSession`. `registerLap(ms)` met à jour `bestLapMs`. `addMarker(LapMarker)` pour le bouton Flic 2.

**[useTelemetryStore](src/store/useTelemetryStore.ts)** — live BLE : `bleStatus`, `lastFrame`, `rateHz`, `totalFrames`, `lastFrameAt`. À câbler sur `bluetoothService.onData/onStatusChange` en semaine 3.

### CI GitHub Actions (jour 3)

[.github/workflows/check.yml](.github/workflows/check.yml) :

- Trigger : `push main` + `pull_request`
- Concurrency : annule les runs précédents de la même branche
- Node 20 LTS (pas Node 24 cutting edge, plus stable en CI)
- `npm ci` avec cache `actions/setup-node@v4`
- 3 jobs séquentiels : `npm run typecheck`, `npm run lint`, `npm run format:check`
- Variables Supabase **fictives** au moment de l'install pour ne pas exiger les secrets en CI (le code throw seulement quand on exécute, pas au type-check)

Activable dès que vous push sur GitHub. Aucun secret à configurer pour ce workflow ; les secrets EAS viendront dans un workflow séparé en semaine 13.

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1 (inchangé)
- [x] `npm run format:check` : ✅ tout conforme Prettier
- [x] `determineState()` est pure (pas d'effet de bord, `now` injecté), donc testable unitairement sans matériel — base solide pour les tests de transitions plus tard
- [x] `VALID_SCREENS_BY_STATE` est exhaustif (TypeScript force `Record<PilotState, …>`)

---

## Ce qui reste en suspens

### Bloqué par votre décision (Q10 ci-dessous)

- [ ] WatermelonDB sync offline (jours 4-5 prévus dans la roadmap)

### Bloqué par votre côté (rappel)

- [ ] Smoke test device de la semaine 1 (`expo run:ios` ou `eas build`)
- [ ] Push initial sur GitHub (le CI s'activera automatiquement)
- [ ] Compte EAS dédié `oxv@oxvehicle.fr` (deadline fin semaine 2)

---

## Question pour Gabin

### Q10 — WatermelonDB en V1 : nécessaire ou overkill ?

La roadmap (`SEMAINES.md`) prévoit WatermelonDB en semaine 2 jour 3-4. J'ai des réserves que je veux partager avant de m'y lancer (~2-3h de setup + sync engine).

**Pour rappel** — WatermelonDB est une base SQLite locale optimisée pour les apps RN, avec un moteur de sync bidirectionnelle vers un backend distant. Conçue pour les apps avec 100k+ enregistrements locaux et beaucoup d'écriture offline.

**Mes réserves pour V1** :

1. **Volume modeste** — Heritage = 4 sessions / an / pilote. Sur 5 ans : 20 sessions, 20 bilans, ~80 tours/an. Postgres distant + cache MMKV suffit largement.
2. **Pattern d'usage centré post-session** — Le pilote consulte son bilan **après** la session (en ligne, paddock ou retour stand). L'offline est utile pour les écrans #17 Progression et #13 Bilan en mode consultation pure ; pas d'écriture offline critique.
3. **Surface d'attaque tooling** — WatermelonDB requiert un plugin Expo (`@morrowdigital/watermelondb-expo-plugin`), un schema SQLite, des migrations, un sync engine custom. Beaucoup de pièces qui peuvent casser sur les futurs Expo SDK upgrades.
4. **Doctrine "fais simple, pas innovant"** — CLAUDE.md ligne 240.

**Alternative que je proposerais** :

- **react-native-mmkv** pour le cache (déjà ultra-rapide, sync, persistant) :
  - Cache des 5 dernières sessions
  - Cache du profil utilisateur
  - Cache du circuit Beltoise (SVG, secteurs)
- **Fetch direct Supabase** pour le reste avec :
  - `react-query` (TanStack Query) ou un service simple à base de `supabase.from(...)`
  - Cache stale-while-revalidate côté client
  - File d'attente offline minimaliste pour les rares écritures (acceptation pacte, mark comme lu, etc.)
- **Fichiers UBX bruts** stockés via `expo-file-system` (déjà installé pour la capture), uploadés en arrière-plan vers Supabase Storage

Effort : ~1 jour, contre 2-3 pour WatermelonDB.

**Trois options pour vous** :

- **A — On garde WatermelonDB** comme prévu. Je passe les 2-3h de setup et on a une vraie sync offline-first. Risque : du tooling à maintenir, peut casser sur Expo SDK 52.
- **B — On simplifie : MMKV + Supabase direct + file d'attente offline**. Mon préféré. ~1 jour, moins de surface, parfaitement aligné doctrine.
- **C — On ne fait rien de plus en V1** : on lit/écrit Supabase directement, on accepte que l'offline soit dégradé. Risqué pour la doctrine "ça marche au circuit même sans 4G", mais code simplissime.

**Ma recommandation** : B. C'est l'option qui respecte le mieux la doctrine produit tout en garantissant l'expérience offline minimale (consulter ses bilans dans la voiture avant de partir, dans le paddock sans réseau, etc.).

---

## Recommandations

### R9 — Tests unitaires de `determineState()` dès maintenant

`determineState()` est pure et pilote toute la navigation. Le plus tôt elle a une suite de tests, le mieux. Estimation : 1-2h pour couvrir les 10 états + les transitions principales, avec Jest. Je peux le faire en jour 4 si vous validez Q10 vers l'option B (qui libère du temps).

### R10 — Connecter `useTelemetryStore` au `bluetoothService` en sem 3

Le store est prêt. Il manque juste un effet d'effet au démarrage de l'app qui fait :
```ts
const off1 = bluetoothService.onStatusChange(useTelemetryStore.getState().setBleStatus)
const off2 = bluetoothService.onData(useTelemetryStore.getState().pushFrame)
```
Trivial, mais à faire avant les tests BLE de la semaine 3 pour que l'écran de debug capture utilise le bon canal.

---

## Estimation pour la suite

Si vous choisissez :

- **Option A (WatermelonDB complet)** : jour 4-5 de semaine 2 + débordement possible. Demande un dev-client pour tester (donc dépend du compte EAS Q9).
- **Option B (MMKV + Supabase direct)** : jour 4-5 propres. Pas de dev-client requis pour le typecheck.
- **Option C (rien)** : jour 4 = tests de `determineState`, jour 5 = rapport et préparation semaine 3.

Semaine 3 dans tous les cas : BLE scan + connect + receive UBX en condition réelle (besoin RaceBox + dev-client).

---

## En résumé

8 commits ajoutés sur `main`. La state machine est implémentée, validée par TypeScript exhaustif sur les écrans, testable en pur sans matériel. Les 4 stores Zustand sont en place et couvrent les 4 axes (état pilote, UI, session, télémétrie). Le CI tournera dès que vous push sur GitHub.

Reste l'arbitrage Q10 sur WatermelonDB avant de finir la semaine 2.

— Claude Code, 24 mai 2026
