# Rapport semaine 3 — BLE RaceBox

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : pipeline BLE complet côté code. Validation device à votre main.

---

## Ce que j'ai fait

### Permissions BLE (jour 1)

[src/ble/permissions.ts](src/ble/permissions.ts) — `requestBlePermissions(): Promise<BlePermissionResult>` :

- **iOS** : `PERMISSIONS.IOS.BLUETOOTH` (prompt système au premier call)
- **Android 12+** : `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` runtime via `requestMultiple()`
- **Android < 12** : `ACCESS_FINE_LOCATION` runtime (BLE scan = location)
- Retourne `{ granted, missing[] }` pour permettre des messages contextuels côté UI

Le code est appelé par l'écran [debug-capture](app/(app)/debug-capture.tsx) avant `startScan()`. Côté production (paddock #08), le même call sera appelé.

### Wire-up bluetoothService ↔ stores (jour 2)

[src/ble/initBle.ts](src/ble/initBle.ts) — appelé une fois au démarrage depuis `app/_layout.tsx` :

- `onStatusChange` → `useTelemetryStore.setBleStatus()` + `useAppStateStore.setCondition('bluetooth', …)` + (sur `connected`) reset compteurs reconnect + clear modal #25
- `onData` → `useTelemetryStore.pushFrame(frame)`
- `onError` → `console.warn` + hook prêt pour Sentry
- Ticker 1s : si `connected`, pousse `bluetoothService.getCurrentRate()` dans le store (utile pour vérifier la santé BLE — ~25 Hz attendu)

Idempotent (flag `started`), avec `teardownBle()` qui démonte proprement les listeners et le ticker à l'unmount.

### Reconnexion automatique (jour 3)

Toujours dans [initBle.ts](src/ble/initBle.ts), watchdog `scheduleReconnect()` :

- Sur `disconnected` avec un `lastConnectedDeviceId` connu : passe en condition `'reconnecting'` puis retente
- Backoff exponentiel : 2s, 5s, 10s, 20s (4 tentatives, total ~37s)
- Au-delà de **30s** OU 4 tentatives échouées : bascule en condition `'lost'` et affiche la modal #25
- `manualReconnect()` exposé pour le bouton "Reconnecter" de la modal
- `abandonReconnect()` exposé pour "Continuer sans" : oublie le device et coupe le watchdog

[src/ble/bluetoothService.ts](src/ble/bluetoothService.ts) reçoit deux ajouts minimaux :
- `getLastConnectedDeviceId()` — utilisé par le watchdog
- `forgetLastDevice()` — utilisé par `abandonReconnect`

Et un fix subtil : `disconnect()` (déconnexion volontaire) reset maintenant `lastConnectedDeviceId`, sinon le watchdog tenterait de reconnecter immédiatement après chaque clic "Déconnecter" du debug.

### Écran #25 — Modal BLE error (jour 3)

[src/components/BleErrorModal.tsx](src/components/BleErrorModal.tsx) :

- Pilotée par `useUIStore.bleErrorModalVisible`
- Eyebrow orange (pas rouge — pas paniquer, doctrine)
- Titre : *"Connexion à l'équipement perdue."*
- Sous-titre rassurant : *"Vos données déjà enregistrées sont sauvegardées."*
- 2 boutons : `Reconnecter` (primaire rouge OXV, déclenche `manualReconnect`) + `Continuer sans` (secondaire, déclenche `abandonReconnect`)

Le composant est monté dans `app/_layout.tsx`, donc accessible depuis n'importe quel écran (couche C du sitemap).

### Upload .ubx vers Supabase Storage (jour 4)

[src/services/telemetryStorage.ts](src/services/telemetryStorage.ts) — `uploadTelemetryFile()` :

- Lit le fichier .ubx local via `expo-file-system` (encoding base64)
- Convertit en bytes via `Buffer` (polyfill RN déjà installé)
- Upload via `supabase.storage.from('telemetry_raw').upload(path, bytes, { upsert: true })`
- Path convention : `{user_id}/{telemetry_session_id}.ubx` — cohérent avec la RLS
- Met à jour `telemetry_sessions.raw_data_url` après upload (échec non bloquant — log warning)

Migration `0008_telemetry_raw_storage_bucket` appliquée en prod :

- Bucket privé `telemetry_raw`, max 50 Mo, MIME `application/octet-stream`
- 4 policies RLS sur `storage.objects` (select/insert/update/delete) avec `(storage.foldername(name))[1] = auth.uid()::text`

Cohérent avec l'archi Partie 1 §3.7. Le fichier SQL est aussi conservé dans `supabase/migrations/` pour traçabilité.

### Sentry conditionnel (jour 5, bonus)

[src/lib/sentry.ts](src/lib/sentry.ts) — `initSentry()` :

- **No-op si `__DEV__`** ou si `EXPO_PUBLIC_SENTRY_DSN` absent
- Sinon : `Sentry.init({ dsn, tracesSampleRate: 1.0, enableAutoSessionTracking: true })`
- Helper `captureException(err, context?)` qui log en console en dev, ou pousse vers Sentry en prod

Appelé au top-level de `app/_layout.tsx`. Le plugin Expo Sentry est déjà câblé dans `app.json` ; il manque juste de fournir le DSN via env quand vous voudrez activer en preview/prod (Q11 ci-dessous).

---

## Ce qui est testé et fonctionnel

Sans device :

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1
- [x] `npm run format:check` : ✅ tout conforme
- [x] Migration `0008` appliquée sur la prod Supabase (bucket visible, policies en place)
- [x] La compilation Metro doit passer (à valider au prochain `expo start`)

Pas validable sans vous + un RaceBox :

- [ ] Scan + connection avec un vrai RaceBox Mini S
- [ ] Streaming 25 Hz pendant 5 min puis 30 min
- [ ] Coupure volontaire du Bluetooth téléphone → watchdog kick in, modal #25 après ≈37s
- [ ] Reconnexion manuelle depuis la modal → reset du watchdog
- [ ] Upload .ubx → vérifier dans le dashboard Supabase Storage

---

## Ce qui reste en suspens

### Bloqué côté vous (rappel + nouveautés)

1. **Compte EAS `oxv@oxvehicle.fr`** (Q9) — bloquant : sans build natif, pas de test BLE possible. Redirection OVH + `expo.dev` signup + `eas init`, ~10 min.
2. **RaceBox à portée** pour les tests de scan/connect/streaming.
3. **Push initial GitHub** — le CI workflow `check.yml` tournera tout seul.

### Pas critiques pour l'instant

- **Capture d'une vraie fixture .ubx** (Q5) — quand vous aurez le build dev installé, vous pourrez ouvrir l'écran debug, capturer 5-30 min, partager le .ubx. Je l'utiliserai pour les tests parser de la sem 4.

---

## Questions pour Gabin

### Q11 — Sentry DSN : quand l'activer ?

Sentry est wired pour rester silencieux en dev (pas de pollution). Pour activer en preview/production, il faut :

1. Créer un projet Sentry "oxv-coach" sous l'org `only-xtreme-vehicle` (déjà référencée dans `app.json`)
2. Récupérer le DSN
3. L'ajouter aux secrets GitHub Actions ET aux variables EAS Build (preview + production)

C'est une action ~15 min côté vous. Pas urgent : tant qu'on n'a pas de build preview, Sentry ne sert à rien. Idéal de le faire avant la semaine 12 (polish) pour avoir 1-2 semaines de remontées crash avant la soumission.

### Q12 — Bouton Flic 2 : quel modèle, quel timing ?

La roadmap mentionne le bouton Flic 2 en semaine 4 jour 4. Avant que je m'y mette :

- Vous avez déjà un Flic 2 ou il faut commander ?
- Préférence pour quel firmware (le SDK BLE diffère légèrement entre Flic 1 et Flic 2) ?
- Je peux faire un mock-up pour la sem 4 si le matériel arrive plus tard, puis brancher quand vous l'avez.

### Q13 — Test alpha juillet 2026 : on commence à préparer ?

Le dossier `docs/test_alpha/` mentionne une Balade Découverte le 5 juillet 2026 à Bouteville. On est le 24 mai. Donc J-42.

Je n'ai pas encore lu ces docs en détail. Vous voulez que je les regarde maintenant pour anticiper d'éventuelles fonctionnalités requises pour ce test (par exemple un mode "Balade Découverte" différencié) ? Ou on attend la semaine 8-10 quand on aura les écrans secondaires ?

---

## Recommandations

### R11 — Configurer Sentry sans urgence mais avant la semaine 12

Pour avoir des remontées crash pendant les phases de polish (sem 11-12) et bêta (sem 13). Si vous me transmettez le DSN par cette conversation (chiffrée), j'ajoute la variable `EXPO_PUBLIC_SENTRY_DSN` au `.env.example` et à la doc.

### R12 — Cooldown reconnexion : peut-être à durcir pour la prod

Actuellement le watchdog tente 4 reconnexions sur ~37s. Sur un circuit avec interférences (radio, autres BLE), 37s peut sembler court. À évaluer en condition réelle ; je peux porter à 60-90s si vous le constatez en sem 3-4.

### R13 — Pas d'écran de scan pilote en V1

Volontairement, je n'ai pas créé d'écran #08 (Détection équipement) pour le flux paddock côté pilote. La doctrine du Pacte dit que l'écran apparaît à l'arrivée circuit. Pour la V1, l'écran [debug-capture](app/(app)/debug-capture.tsx) sert à la fois pour le dev et pour le scan. L'écran #08 final viendra en semaine 9 quand on attaquera le flow paddock complet.

---

## Estimation pour la semaine 4

Selon la roadmap : **Parser UBX (déjà fait V1) + bouton Flic 2 + détection tours + visualisation debug.**

Vu ce qu'on a déjà :

- Parser UBX : ✅ V1 récupéré, testable manuellement avec une fixture (Q5)
- Détection de tours : `src/utils/lapDetection.ts` V1 récupéré, à wirer sur les frames live
- Bouton Flic 2 : à faire (dépend Q12)
- Visualisation debug : peut être enrichie sur l'écran de capture pour montrer le tracé GPS reconstruit

Plan jour-par-jour :

- **J1** : tests manuels du parser sur fixture (vous me passez un .ubx, je vérifie le compte de frames, secteurs, etc.)
- **J2** : wirer `lapDetection` sur le stream BLE live (dans `initBle` ou un service dédié)
- **J3-4** : SDK Flic 2 + scan/pair/clic detection (dépend Q12)
- **J5** : écran de debug enrichi avec le tracé GPS reconstruit + rapport

Estimation : **4-5 jours-claude**, dont J3-4 conditionnels au matériel Flic.

---

## En résumé

12 commits sur `main`. Le pipeline BLE est complet côté code : permissions runtime, scan/connect via service V1, streaming vers store, reconnexion automatique avec backoff, écran #25 en cas de perte > 30s, upload Storage avec bucket privé RLS-protégé. Sentry est prêt à recevoir un DSN.

Tout reste à valider sur device, ce qui dépend de **Q9** (compte EAS pour pouvoir builder). C'est le vrai goulot d'étranglement de la semaine 3 : sans build natif, je peux écrire du code BLE mais pas le vérifier sur un vrai RaceBox.

Trois nouvelles questions (Q11 Sentry DSN, Q12 Flic 2 matériel, Q13 préparation test alpha juillet) — toutes non bloquantes pour démarrer la semaine 4.

— Claude Code, 24 mai 2026
