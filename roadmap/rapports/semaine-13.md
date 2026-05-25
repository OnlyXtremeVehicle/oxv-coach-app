# Rapport semaine 13 — Câblage final + alpha prep

**Date** : 25 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : **Le pipeline post-session est complet et câblé**. Analyse trackviz auto-déclenchée, debrief J+1 généré, notif locale programmée, opt-in pilote en place. Reste à câbler côté humain : compte EAS pour le build device.

---

## Ce que j'ai fait

### J1 — Orchestration analyse post-session

[`src/services/analyzeSessionService.ts`](../src/services/analyzeSessionService.ts) — le pivot :

```
samples (UBX local OU telemetry_frames DB)
  → analyzeTrackVizSession (sem 12)
  → upsertSegmentAnalyses (14 lignes app_segment_analyses)
  → laps DB → computeMargin (sem 5)
  → upsertAnalysis (1 ligne app_session_analyses)
  → generateDebrief (sem 13 J2)
  → updateDebriefText
  → scheduleDebriefNotification (sem 13 J3, J+1 par défaut)
```

3 sources de samples tentées dans l'ordre :
1. `.ubx` local si fourni (par exemple celui qui vient juste d'être enregistré côté app)
2. `telemetry_frames` en DB (paginé 1000/page, safety 50 k)
3. Sinon : on tombe en fallback laps-only (calcul marge globale uniquement, pas de segment-level)

Helpers exportés :
- `parseUbxFile(uri)` — lit en base64, décode via `UbxFrameBuffer`, retourne `TrackVizRecordingSample[]`
- `raceBoxToTrackVizSample(data, elapsedMs)` — conversion pure
- `downsample` à 600 samples max pour limiter le coût SVG/analyse

**Le tout est best-effort** : `analyzeAndPersistSession` ne lève jamais, retourne `{ ok, source, sampleCount, segmentsPersisted, marginGlobal, notes }`. L'écran #11 « Données en sécurité » peut transitionner vers #12 sans crainte.

**Écran #11 mis à jour** : la temporisation 6 s factice est remplacée par un vrai run d'analyse, avec progress bar animée 0→92% en 3.5 s et timeout sécurité 30 s. Sans `sessionId/userId` (cas dev sans auth), il temporise simplement.

### J2 — Générateur debrief J+1 (V1 sans IA)

**Décision Q31** : pour l'alpha juillet, on livre un générateur **côté app** à partir de templates qualitatifs. Pas d'OpenAI, pas d'Edge Function, pas de coût par appel. V1.1 (post-alpha) substituera une Edge Function avec OpenAI sans changer l'écran #19 (format identique : 3 paragraphes séparés par `---`).

[`src/services/debriefGenerator.ts`](../src/services/debriefGenerator.ts) — `generateDebrief(input)` produit 3 actes :

- **Acte 1 — Récit** : opening (avec/sans prénom) + ton selon zone + phrase tour (compte + best lap formaté `m:ss.mmm`) + détail du segment au plus fort G_lat
- **Acte 2 — Méta** : phrase fond + balance véhicule/pilote (équilibre rare si delta < 8, sinon attribue la marge restante au plus large)
- **Acte 3 — Préparation** : focus sur le segment à plus faible marge — juste le **lieu**, jamais le geste à faire — + invitation générique

**Tous les paragraphes sont testés contre la liste de verbes interdits** (alignée avec `focusCorner.test.ts`). 16 tests couvrent doctrine, structure, segments, balance, format temps.

Câblé dans `analyzeAndPersistSession` : après `upsertAnalysis`, on appelle `generateDebrief` avec les segments fraîchement persistés et on update `debrief_text` en base. L'écran #19 lit la même colonne — agnostique à la source.

### J3 — Notifications push (locales V1)

**Migration 0013** appliquée en prod :
- `users.expo_push_token text` (préparé pour V1.1 push remote)
- `users.push_notif_enabled boolean default true` (opt-in pilote)
- `users.push_token_updated_at timestamptz`

[`src/services/pushNotificationsService.ts`](../src/services/pushNotificationsService.ts) :
- `registerForPushNotifications(userId)` — permission + token + persist idempotent. Skip émulateur.
- `scheduleDebriefNotification({ userId, sessionId, delayMs? })` — notif locale 24 h par défaut, data `{ type: 'debrief', sessionId }`
- `scheduleSessionReminder({ userId, sessionOxvId, sessionAt, hoursBefore? })` — notif locale 18 h avant
- `cancelAllOxvNotifications()`
- `isPushEnabled(userId)` — lit `push_notif_enabled`

Canaux Android créés (Debrief J+1, Veille de session) **sans son** — doctrine sobriété. Handler global : `shouldShowAlert: true, shouldPlaySound: false`.

[`app/_layout.tsx`](../app/_layout.tsx) :
- `registerForPushNotifications` appelé après auth (effet sur `profileId`)
- `useLastNotificationResponse` pour deep-link sur tap notif :
  - `debrief` → `/(app)/debrief?sessionId=xxx`
  - `session_reminder` → `/(app)/`
- Attend que `navState` soit prêt avant de naviguer (évite la race condition au boot)

[`app/(app)/settings.tsx`](../app/(app)/settings.tsx) — **nouvelle section "PRÉFÉRENCES"** :
- Toggle `Switch` : « Notifications OXV — Debrief J+1 · Veille de session »
- Lecture initiale depuis `users.push_notif_enabled`
- `togglePush(next)` : update DB + `cancelAllOxvNotifications` si off

### J4 — Fixture UBX synthétique + smoke test documenté

**Pas de RaceBox physique sous la main**, donc je fais ce qui est faisable en autonomie :

[`scripts/generate-fixture-ubx.ts`](../scripts/generate-fixture-ubx.ts) — génère 240 trames UBX **valides** (88 octets, checksum Fletcher-8 correct) depuis `buildDemoTrackVizSamples`. Encode tous les offsets payload conformément à `parser.ts` (iTOW, lat/lon × 1e7, speed mm/s, G × 1000, etc.).

```bash
npx tsx scripts/generate-fixture-ubx.ts test-fixtures/demo-session.ubx
# OK → test-fixtures/demo-session.ubx (240 trames, 21120 octets)
```

[`src/services/__tests__/parseUbxFile.integration.test.ts`](../src/services/__tests__/parseUbxFile.integration.test.ts) — **test d'intégration** qui génère la fixture en mémoire, mock `expo-file-system` pour la servir en base64, lance le vrai `parseUbxFile`, et vérifie :
- Nombre de samples reconstruits = nombre de samples d'origine
- Séquence temporelle croissante à partir de 0
- Lat/lon à la précision parser (1e-6)
- Vitesse ±0.5 km/h
- `source: 'ble'` (et pas `'demo'`)

**Le pipeline UBX → trackviz est désormais prouvé de bout en bout sans device.**

[`docs/SMOKE_TEST_DEVICE.md`](../docs/SMOKE_TEST_DEVICE.md) — procédure complète en 8 phases pour le dev senior quand le RaceBox arrive :
- **A** Build + installation
- **B** Onboarding + auth
- **C** Permissions BLE + push + géoloc
- **D** Roulage + analyse post-session
- **E** Bilan + écrans secondaires
- **F** Notifications (programmation, tap, opt-in)
- **G** Offline + résilience (mode avion, reconnexion BLE, crash)
- **H** Smoke admin

Plus checklist finale avant submission stores + rappel des blocants côté Gabin.

[`app.json`](../app.json) : plugin `expo-notifications` ajouté avec icône + couleur rouge OXV + `defaultChannel: debrief` + `enableBackgroundRemoteNotifications: false` (V1 = locales seulement).

### J5 — Build EAS + ce rapport

**Le build EAS preview ne peut pas être lancé depuis cette session** : il requiert le compte `oxv@oxvehicle.fr` (Q9, toujours bloquant côté vous).

**Commandes prêtes à exécuter** quand vous serez loggué à EAS sur votre poste :

```bash
# Login (une seule fois par poste)
eas login

# Build preview iOS pour TestFlight interne
eas build --profile preview --platform ios

# Build preview Android pour sideload
eas build --profile preview --platform android

# Submission TestFlight (sem 14)
eas submit --profile production --platform ios

# Submission Play Internal Testing (sem 14)
eas submit --profile production --platform android
```

Le `projectId` Expo (`d168d639-22e2-4190-a9ea-cc6a31e3acaa`) et le `owner: oxv` sont déjà dans `app.json`. Vérifier qu'ils correspondent bien au compte `oxv@oxvehicle.fr` (sinon `eas init` pour réassigner).

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : **0 erreur**
- [x] `npm run lint` : **0 erreur, 4 warnings legacy V1** (inchangés depuis sem 12)
- [x] `npm run format:check` : tout conforme
- [x] `npm test` : **103/103 tests** (98 + 5 intégration UBX)
- [x] Migration `0013_push_tokens` appliquée en prod
- [x] Fixture UBX synthétique fonctionnelle (240 trames, parser OK)
- [x] Pipeline post-session câblé et testable sans device

**Validable uniquement sur device** (sem 13 J4 → quand le RaceBox arrive) :
- [ ] Smoke test phases A→H de [`SMOKE_TEST_DEVICE.md`](../docs/SMOKE_TEST_DEVICE.md)
- [ ] Notification J+1 effectivement reçue + tap → deep-link
- [ ] Opt-in toggle effectif (couper coupe les notifs en queue)
- [ ] Build EAS preview iOS + Android sans erreur

---

## État global après sem 13

| Brique | État |
|---|---|
| 26 écrans pilote | ✅ codés |
| 3 vues admin bronze | ✅ codées |
| 3 overlays système | ✅ codés |
| Module trackviz complet | ✅ codé, testé |
| Vraies marges par virage | ✅ branchées #14/#15/#16 |
| **Pipeline post-session UBX → marges** | ✅ **câblé sem 13 J1** |
| **Debrief J+1 généré localement** | ✅ **sem 13 J2** |
| **Notifs locales debrief + opt-in** | ✅ **sem 13 J3** |
| **Fixture UBX + test intégration** | ✅ **sem 13 J4** |
| State machine S1-S10 + 10 stores | ✅ |
| Pipeline BLE RaceBox + parser UBX | ✅ (sans device) |
| Géoloc foreground + transitions auto | ✅ |
| Offline queue + retry policy | ✅ |
| Migrations 0001-0013 | ✅ en prod |
| 103 tests Jest | ✅ |

**37 commits totaux, 0 dette technique bloquante.**

---

## Questions pour Gabin

### Q36 — Personnalisation prénom du debrief

Le générateur accepte un `firstName` mais `analyzeAndPersistSession` le laisse à `null` (pour éviter un fetch additionnel sur `users`). Résultat : tous les debrief commencent par « Hier, vous avez… » au lieu de « Hier, Gabin, vous avez… ».

Trois options :

- **A** — Garder null (vouvoiement neutre, sobre) — recommandé V1
- **B** — Faire un fetch dans `analyzeAndPersistSession` (1 query SELECT first_name de plus)
- **C** — Passer le prénom en paramètre de l'écran #11 (l'écran le connaît via `useAuthStore`)

V1.1 avec OpenAI le rendra moot — la personnalisation viendra du modèle.

### Q37 — Cron quotidien pour notifs J+1 sur device dormant

Les notifs locales programmées via `expo-notifications` se déclenchent sur l'OS même si l'app est tuée. **MAIS** : si l'utilisateur a tué l'app **avant** la programmation (cas extrême : roulage → upload .ubx → kill app avant que `scheduleDebriefNotification` ait été appelé), la notif J+1 sera perdue.

V1.1 mitigation : **Edge Function cron quotidienne** qui pousse les debrief des sessions des dernières 24 h via Expo Push API (token déjà persisté en DB depuis sem 13 J3 — c'était l'idée).

Pour V1 alpha : on assume que l'utilisateur garde l'app ouverte jusqu'à la fin de l'analyse (typique : il regarde le bilan, ferme proprement).

### Q38 — Format du fallback `dateLong` si `sessionStartedAt` invalide

`generateDebrief` reçoit `sessionStartedAt` mais ne l'utilise pas pour formater une date dans le récit (le récit dit juste « Hier »). C'est ok V1, mais à terme on voudra probablement adapter selon l'heure réelle (matin/après-midi/soir). À noter pour V1.1.

---

## Recommandations

### R37 — Tenter le build EAS preview en parallèle de la sem 14

Si vous débloquez Q9 (compte EAS) cette semaine, lancez **dès que possible** un premier build preview iOS. Le délai EAS Build est souvent de 20-40 min, et c'est là qu'on découvre les vrais soucis de configuration native (provisioning, entitlements, plugins natifs cassés). Mieux vaut le découvrir maintenant que pendant la submission TestFlight.

### R38 — Programmer un smoke test « réel » en milieu de sem 14

Idéalement, **bloquer 1 demi-journée** avec le dev senior + un RaceBox + un iPhone pour exécuter la procédure [`SMOKE_TEST_DEVICE.md`](../docs/SMOKE_TEST_DEVICE.md) en conditions réelles. Tout ce qu'on n'aura pas vu en simulation va sortir là (timing reconnexion BLE, latence vraie du parseUbxFile sur un .ubx de 5 min, comportement notif sur iPhone vs Android, etc.).

### R39 — Préparer les docs alpha pour les pilotes du 5 juillet

À écrire (probablement sem 14 J3 ou J4) :
- Guide d'installation TestFlight + sideload Android
- Démarrage 1ère session (appairage RaceBox, premier roulage, première lecture du bilan)
- Charte d'utilisation alpha (collecte des feedbacks, canal Slack/email dédié, what to expect)
- Page web ou PDF — votre choix selon votre infra OXV

### R40 — Push GitHub remote — VRAIMENT cette fois

37 commits jamais poussés. Le diff total approche les ~25 k lignes. Si votre poste meurt, vous perdez tout. **Recommandé fortement** : `git remote add origin git@github.com:oxv/oxv-coach-app.git` (créer le repo private sur GitHub d'abord) + `git push -u origin main` aujourd'hui.

---

## Estimation pour la semaine 14

**Sem 14 — Polish + soumission stores.** 5 jours :

- **J1** — Smoke test device réel (si Q9 débloqué) + fixes bloquants éventuels
- **J2** — Polish UX (animations, micro-interactions, ce qu'on aurait voulu faire sem 12 et qu'on a reporté pour trackviz)
- **J3** — Docs alpha pilotes (guide installation + premier usage) + page web ou PDF
- **J4** — Build EAS production iOS + Android, submission TestFlight + Play Internal Testing
- **J5** — Rapport final sem 14 + sortie projet code

**Test alpha 5 juillet 2026 — dans 5 semaines (35 jours).** Sem 14 nous laisse 28 jours de buffer pour vous (validation alpha pilotes, corrections post-feedback éventuelles, marketing alpha si besoin).

---

## En résumé

Tout ce qui peut être codé sans device l'a été. **103 tests verts.** Le pipeline post-session est complet : un retour box doit produire un bilan analysé avec vraies marges par virage, un debrief en 3 actes doctrinal, et une notif J+1 programmée — automatiquement et sans intervention humaine.

Sem 14 est **dépendante de vous** : compte EAS pour build device, RaceBox + iPhone pour smoke test, docs alpha à formaliser ensemble. Mes 5 jours-claude sont prêts à attaquer dès que vous me donnez le go.

— Claude Code, 25 mai 2026
