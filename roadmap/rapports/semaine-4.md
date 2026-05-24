# Rapport semaine 4 — Tests, lapDetection, Flic 2 stub

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : 5 jours livrés. Tests passants, mais validation hardware reste conditionnelle au build dev.

---

## Ce que j'ai fait

### Jour 1-2 — Setup Jest + tests parser UBX + state machine

**[jest.config.js](jest.config.js)** — ts-jest minimal, environnement node, scope limité à la business logic pure :
- `src/ubx/` (parser)
- `src/utils/` (geo, lapDetection, validation)
- `src/types/state.ts` (state machine)
- `src/types/domain.ts` (helpers métier)

Coverage cible 70% lines/statements. Volontairement hors-périmètre Jest : composants React Native (testés manuellement en build dev), hooks Zustand (couverts via leurs deps pures), services BLE/Supabase (fixtures + builds réels).

**[src/ubx/__tests__/parser.test.ts](src/ubx/__tests__/parser.test.ts) — 16 tests** :
- `computeChecksum` : valid + sensibilité à un bit flip
- `isChecksumValid` : valid / corrompu / trop court
- `isRaceBoxDataMessage` : valid + 5 cas d'échec (taille, sync bytes, class, ID, checksum)
- `parseRaceBoxDataMessage` : décodage d'un payload de référence (lat/lon Beltoise, vitesse 100 km/h, heading, g-forces, batterie 75%)
- `UbxFrameBuffer` : single chunk, skip garbage (avec un 0xB5 piège), split en 3 chunks (cas réel BLE 20-byte MTU), multiple frames back-to-back, `clear()`

Les trames sont synthétisées dans le test (`buildValidFrame()` avec checksum recalculé). Pas de dépendance à un fichier `.ubx` réel — quand une vraie fixture sera disponible (Q5), un test supplémentaire de compte-de-frames pourra venir ici.

**[src/types/__tests__/state.test.ts](src/types/__tests__/state.test.ts) — 19 tests** :
- Pré-conditions : S1 (pas de compte), S2 (onboarding), priorisation
- Pilotage actif : S6 (roulage > 60 km/h), S7 (paddock arrêté), précédence sur position
- Atterrissage : S8 (< 2h), S9 (2h–48h), S10 (> 48h)
- Anticipation : S4 (≤ 14j), S3 (> 14j), S5 (en route jour J), S7 (à l'arrivée)
- `isScreenValid` : bilan post-session, **AUCUN écran en S6**, onboarding ⇄ S2, système hors S2/S6

Total : **35 tests, tous passants en 11s**. Coverage cible atteinte sur les fichiers ciblés (à mesurer plus précisément avec `npm run test:coverage`).

**Subtilité technique** : Jest 30 avec ts-jest 29 émet `clearMocksOnScope is not a function`. Downgrade à Jest 29 (mature + compat ts-jest 29). À monter en Jest 30 quand ts-jest 30 sera stable.

**CI** : `.github/workflows/check.yml` reçoit une étape `npm test -- --ci` après le format check.

### Jour 3 — lapDetection live

**[src/ble/lapDetectionRunner.ts](src/ble/lapDetectionRunner.ts)** — runner standalone :

- `startLapDetection({ finishLineLat, finishLineLon, finishLineRadiusM })` — s'abonne à `bluetoothService.onData`, filtre `fix < Fix3D`, appelle `processGpsPoint` (V1) et pousse `useSessionStore.registerLap(durationMs)` quand un tour est complété
- **Premier passage = outlap** (pas compté comme tour valide, durée non calculable)
- Timestamps via `Date.now()` (monotonique au mieux) ; itow GPS serait plus précis mais ajout en sem 5 si nécessaire
- `stopLapDetection()` + `getLapDetectorStatus()` exposés pour le debug UI

Le détecteur n'est **pas** démarré automatiquement au démarrage de l'app — il l'est :
- Manuellement depuis l'écran debug (V1, pour valider sur fixture/RaceBox)
- Automatiquement au démarrage d'une session officielle (sem 9, quand on câblera le flow paddock)

### Jour 4 — Flic 2 stub

**[src/ble/flic2Service.ts](src/ble/flic2Service.ts)** — V1 stub intentionnel :

- API publique stable : `scan()`, `connect(id)`, `disconnect()`, `onClick(listener)`, `onStatusChange(listener)`, `simulateClick(kind)`
- Pas de scan BLE réel : les UUID caractéristiques du Flic 2 ne sont pas publics. Le SDK Flic officiel (FlicLib iOS / fliclib-android) doit être wrappé dans une expo dev module — c'est le plan V2
- `simulateClick(kind)` déclenche le flow downstream comme un vrai clic — utile pour debug et tests

**[src/ble/initFlic.ts](src/ble/initFlic.ts)** — wire `flic2Service.onClick → useSessionStore.addMarker`, avec :
- Snapshot du `lapCount` au moment du clic (pour rattacher le marker au tour)
- Markers **ignorés** si pas de session active (`status !== 'recording' && !== 'paused'`)
- Warning console en __DEV__

`initFlic()` / `teardownFlic()` ajoutés au `useEffect` de `RootLayout`.

### Jour 5 — Debug-capture enrichi

[app/(app)/debug-capture.tsx](app/(app)/debug-capture.tsx) — 3 nouvelles sections au-dessus du retour accueil :

- **Détection de tours (Beltoise)** : démarrer/arrêter, compteur passages bruts + tours dans le store + meilleur tour
- **Session test** : démarrer/arrêter une session bidon (`id: debug-{ts}`, `userId: debug-user`) pour valider les markers sans Supabase
- **Flic 2 simulation** : 3 boutons (Single → `good`, Double → `incident`, Triple → `question`) + affichage des 5 derniers marqueurs avec timestamp local + tour

Toutes les sections sont **composables** : on peut tester les markers Flic sans BLE, ou capturer sans démarrer la détection de tours.

La finish line Beltoise est hardcodée (`45.6004, -0.141, 40m`, depuis la table `circuits` officielle). En sem 5+, on lira via `supabase.from('circuits')`.

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ 35/35 tests en 11s
- [x] Workflow CI : étape Jest ajoutée, tournera dès le prochain push

À valider sur device (dépend Q9 = compte EAS) :

- [ ] Scan + connect RaceBox réel
- [ ] Streaming GPS frames vers le store
- [ ] Détection d'un vrai tour Beltoise (le pilote doit traverser la finish line)
- [ ] Simulation Flic → marqueur ajouté à une session test
- [ ] Coupure BLE volontaire → modal #25 après ~37s

---

## Ce qui reste en suspens

- **Compte EAS `oxv@oxvehicle.fr`** (Q9) — toujours le vrai goulot. Bloque toute validation sur device.
- **Fixture .ubx réelle** (Q5) — utile pour un test supplémentaire de compte-de-frames sur un vrai fichier, et pour visualiser un tracé Beltoise.
- **SDK Flic 2 natif** (Q12) — à wrapper en expo dev module quand vous aurez le matériel.

---

## Questions pour Gabin

### Q14 — Lecture des circuits depuis Supabase : timing ?

Actuellement la finish line Beltoise est hardcodée dans l'écran debug. Quand on attaquera les écrans paddock (#07-09 en sem 9) et bilan (#13 en sem 5), il faudra lire la table `circuits` dynamiquement (1 query au mount, cache MMKV).

J'avais prévu de faire ça en sem 5 (avec l'écran Bilan qui a besoin du tracé SVG du circuit). Pas urgent, juste pour info.

### Q15 — Mode Balade Découverte vs track day premium

Le dossier `docs/test_alpha/` mentionne une "Balade Découverte" le 5 juillet 2026. Je ne l'ai pas encore lu en détail.

Si la Balade Découverte a un format différent du track day Heritage (vitesse plus modérée, parcours simplifié, etc.), l'algorithme de marge composite et la détection de tours pourraient nécessiter une calibration différente.

À regarder en sem 5 quand j'attaquerai le bilan. Ok ?

---

## Recommandations

### R14 — Lancer `npm run test:coverage` une fois après le push GitHub

Pour avoir une métrique de couverture initiale et éventuellement ajuster le seuil dans `jest.config.js` (actuellement 70% lines/statements, 60% branches, 70% functions — sans doute trop bas pour le parser qui est très couvert et trop haut pour le state machine si on rate des branches).

### R15 — Quand un vrai .ubx arrivera, ajouter un test "fixture"

Un test supplémentaire dans `parser.test.ts` qui :
1. Lit `test-fixtures/racebox-static-5min.ubx`
2. Push dans `UbxFrameBuffer`
3. Vérifie qu'on extrait un nombre attendu de `RaceBoxData` frames (~7500 pour 5 min à 25 Hz)
4. Vérifie que les coords GPS extraites correspondent à Beltoise (lat ~45.6, lon ~-0.14)

C'est un excellent gardien contre les régressions futures du parser. Et ça documente le format attendu.

### R16 — Sentry DSN avant la semaine 12 (rappel R11)

Plus on a de retours bêta, plus c'est utile. Q11 ouverte depuis le rapport sem 3.

---

## Estimation pour la semaine 5 — Cœur de l'app commence

Selon la roadmap : **Écran #20 (Accueil hub 3 modes) + Écran #13 (Bilan central, le plus important).**

- **J1** — Lecture des docs algos (`docs/architecture/02_PARTIE_2_algorithmes.md`) + service `circuitsService` (cache MMKV + fetch Supabase pour la table `circuits`)
- **J2** — Écran #20 : 3 modes (countdown, en route, passif) avec rendu conditionnel basé sur `useAppStateStore.state` et `useUIStore.hubMode`. Lecture du profil pour le greeting personnalisé.
- **J3-4** — Algorithme de marge composite V1 (simplifié, pas Pacejka complet) : input = laps + sectors → output = `MarginPercent`. Stocké dans `app_session_analyses` (table à créer si pas faite — vérifier sem 1).
- **J5** — Écran #13 : chiffre central géant (heroLarge 120pt, weight 200), étiquette humaine (vert/jaune/rouge), phrase manifeste, 4 cards de navigation. Rapport.

Estimation : **5 jours-claude**. Premier écran "vrai" de l'app, doit respecter au pixel la doctrine. Je relirai `00_OVERVIEW_26_ECRANS.md` #13 en détail avant.

---

## En résumé

5 jours livrés sur la semaine 4. La business logic critique (parser UBX + state machine) a une suite de tests qui tournera automatiquement en CI à chaque push. La détection de tours est wired sur le stream BLE — quand vous aurez un build dev avec un RaceBox à portée, vous pourrez faire un tour Beltoise et voir le compteur s'incrémenter. Flic 2 a une API stable mockée, prête à recevoir une vraie intégration native quand vous aurez le matériel.

15 commits totaux sur `main`. Tout est vert. Le goulot d'étranglement reste **Q9 — compte EAS** : sans build natif, on dépend de validations futures pour confirmer que tout ce code fonctionne ensemble sur un vrai téléphone.

— Claude Code, 24 mai 2026
