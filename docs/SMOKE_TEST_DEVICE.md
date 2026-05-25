# Smoke test sur device — Procédure dev senior

> **Quand exécuter** : avant le premier build EAS preview, et après tout
> changement majeur du pipeline BLE / analyse. Au minimum 1 fois sem 13
> et 1 fois sem 14 avant submission stores.
>
> **Durée estimée** : 45-60 min en conditions nominales (RaceBox connecté,
> session courte 5 min, retour box, analyse + bilan + debrief).

---

## Pré-requis matériel

- [ ] **iPhone iOS 16+** ou Android 11+ (les versions plus anciennes n'ont
      pas été validées avec react-native-ble-plx 3.x)
- [ ] **RaceBox Mini S** chargé et appairé une fois sur le téléphone (bouton
      bleu allumé fixe → mode advertising)
- [ ] **Flic 2** appairé en Bluetooth (sem 13 le service est en stub —
      simuler les press via `flic2Service.simulateClick()` en debug)
- [ ] **GPS dégagé** (extérieur, pas en sous-sol)
- [ ] **Connexion internet** initiale (pour login). Le reste fonctionne offline.

---

## Phase A — Build et installation (sem 13 J5)

### Build EAS preview

```bash
# Sur poste de Gabin (compte EAS oxv@oxvehicle.fr, Q9)
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Récupérer le `.ipa` (TestFlight interne) ou le `.apk` (sideload Android).

### Installation

- **iOS** : invitation TestFlight → ouvrir le mail → installer
- **Android** : sideload du .apk → autoriser les sources inconnues

### Vérification immédiate post-install

- [ ] L'app ouvre sur l'écran de login OXV (logo + champ email)
- [ ] Le splash screen disparaît en < 2 s
- [ ] Aucun crash visible
- [ ] Statut Sentry : check le dashboard Sentry pour confirmer que les events
      arrivent (Q11 — DSN à fournir)

---

## Phase B — Onboarding et auth

### Login

- [ ] Saisir un email + mot de passe d'un user de test (créé via l'admin
      Supabase, **pas via MCP** par sécurité — voir doctrine credentials)
- [ ] L'app route vers `/(onboarding)/` si `profile_completed_at IS NULL`,
      sinon vers `/(app)/`

### Parcours onboarding (si nouveau user)

- [ ] **#01 Accueil philosophique** — manifeste affiché, bouton Continuer
- [ ] **#02 Doctrine** — les 3 principes lisibles
- [ ] **#03 Méthode** — explication
- [ ] **#04 Niveau pilote** — 4 options, sélection persistée
- [ ] **#05 CGU/RGPD** — case à cocher, refus impossible sans cocher
- [ ] **#06 Pacte** — signature avec horodatage en DB
      - Vérifier : `SELECT pact_accepted_at FROM users WHERE id = ...`

---

## Phase C — Permissions et BLE

### Permission Bluetooth

- [ ] À l'arrivée sur `/(app)/` : popup système BLE acceptée
- [ ] Sur Android : popup ACCESS_FINE_LOCATION acceptée également

### Connexion RaceBox

- [ ] Sur `/(app)/equipement` (depuis paddock) : scan auto démarre
- [ ] Le RaceBox apparaît dans la liste sous 5 s (nom commence par "RaceBox")
- [ ] Tap → état passe à `connecting` puis `connected` sous 3 s
- [ ] Indicateur de fréquence BLE > 20 Hz (cible RaceBox = 25 Hz)
- [ ] Permissions push : popup notif acceptée, token persisté en DB
      - Vérifier : `SELECT expo_push_token FROM users WHERE id = ...`
      - Le token doit ressembler à `ExponentPushToken[xxxxxxxxxxxxxxxx]`

### Permission géolocalisation

- [ ] Au mount du store géoloc : popup système accepté
- [ ] Coordonnées mises à jour dans `useAppStateStore.lastKnownLocation`
- [ ] À proximité de Beltoise simulée (45.6005, -0.142 ± 200 m) : état
      passe automatiquement S1 → S2

---

## Phase D — Roulage et analyse

### Démarrage session

- [ ] Sur `/(app)/placement` : "Démarrer" → state machine S3 → S4 → S5
- [ ] Écran s'éteint automatiquement (silence en piste, doctrine P3)
- [ ] Aucune notification ne déclenche pendant le roulage (DnD-like)
- [ ] La session apparaît en `recording` dans `telemetry_sessions`
- [ ] Les frames remontent dans `telemetry_frames` (5 Hz)

### Tours détectés

- [ ] Simuler 3-4 passages près de la ligne d'arrivée (start_lat / start_lon
      du `circuits.default = Beltoise`)
- [ ] Tour 1 marqué `is_outlap = true`
- [ ] Tours 2-3 normaux, `lap_number` incrémenté
- [ ] `useSessionStore.lapCount` reflète bien le compteur
- [ ] `bestLapMs` se met à jour si tour plus rapide

### Fin de session

- [ ] Retour au paddock (état pilote → S7 puis S8 quand BLE déconnecté
      et géoloc revient au paddock 90+ s)
- [ ] Écran `#10 Vous avez piloté` apparaît automatiquement
- [ ] Bouton `Continuer` → `#11 Données en sécurité`

### Préservation + analyse (le cœur sem 13 J1)

- [ ] **Progress bar visible**, atteint 92% en ~3.5 s
- [ ] L'analyse tourne en arrière-plan :
      - `app_segment_analyses` reçoit 14 lignes (1 par segment)
      - `app_session_analyses` reçoit 1 ligne avec `margin_global` et
        `debrief_text` non-null
- [ ] Transition automatique vers `#12 Bilan prêt` quand l'analyse rend
      (ou timeout 30 s)
- [ ] `console.log` du DevTools affiche un objet `{ source: 'telemetry_frames' | 'ubx_local', sampleCount, segmentsPersisted, marginGlobal, notes }`

---

## Phase E — Bilan et écrans secondaires

### Bilan (#13)

- [ ] Marge globale affichée en grand (un seul chiffre central)
- [ ] Zone correctement colorisée (vert / jaune / rouge)
- [ ] Label humain (Confortable / À explorer / Terrain serré)
- [ ] Pas d'instruction directive nulle part

### Carte (#14)

- [ ] Carte du circuit affichée (SVG)
- [ ] **Les 14 virages sont coloriés selon les vraies marges** (et pas
      mockCornerMargins — vérifier l'écart entre 2 sessions différentes)
- [ ] Tap sur un virage → `/(app)/virage?index=X&sessionId=Y`

### Zoom virage (#15)

- [ ] Section Trajectoire : écart latéral moyen + max
- [ ] Section Physique : vitesse entrée / G_lat max / vitesse sortie
      (lus depuis `app_segment_analyses`, pas de "—")
- [ ] Section Question : juste "Était-ce volontaire ?"

### Prochaine fois (#16)

- [ ] Affiche le focus corner (la zone à plus faible marge)
- [ ] Phrase non directive
- [ ] Test absent : vérifier 100% que le mot "freinez" ou "accélérez"
      n'apparaît nulle part dans l'écran

### Debrief J+1 (#19)

- [ ] Affiche le texte généré (3 paragraphes séparés)
- [ ] Acte 1 mentionne le virage le plus engagé
- [ ] Acte 3 mentionne la zone à explorer
- [ ] Signature de fermeture en monospace

---

## Phase F — Notifications

### Programmation (sem 13 J3)

- [ ] À la fin de l'analyse (#11) : une notif locale est planifiée
      pour J+1
      - Vérifier via `Notifications.getAllScheduledNotificationsAsync()`
        dans la console debug
- [ ] La notif arrive bien 24h après (test accéléré : modifier `delayMs`
      à 60 s en debug, vérifier qu'elle apparaît)

### Tap sur la notif

- [ ] Tap sur la notif → l'app s'ouvre directement sur `/(app)/debrief`
      avec le bon `sessionId` en query
- [ ] Le debrief affiche bien la session ciblée

### Opt-in pilote

- [ ] Aller dans #24 Settings → section Préférences → toggle "Notifications OXV"
- [ ] Couper le toggle → `cancelAllScheduledNotificationsAsync` appelée
- [ ] Vérifier `users.push_notif_enabled = false` en DB
- [ ] Re-activer → nouvelle notif debrief programmable

---

## Phase G — Offline et résilience

### Mode avion

- [ ] Activer le mode avion AVANT la fin de session
- [ ] Faire le retour paddock → l'analyse tourne quand même (offline-ready)
- [ ] Bannière offline visible (`<OfflineBanner>`)
- [ ] Désactiver le mode avion → la queue offline se flush automatiquement
- [ ] Les rows `app_session_analyses` et `app_segment_analyses` arrivent en DB

### Reconnexion BLE

- [ ] Couper l'alimentation du RaceBox pendant le roulage
- [ ] Modal `#25 BLE error` apparaît après 30 s
- [ ] Re-allumer le RaceBox → reconnexion auto en < 20 s (backoff 2/5/10/20s)
- [ ] La session continue à enregistrer sans perte de tours

### Crash recovery

- [ ] Tuer l'app pendant le roulage (force quit)
- [ ] Rouvrir l'app
- [ ] La session `recording` est récupérée si moins de 5 min
- [ ] L'analyse peut être déclenchée manuellement depuis l'écran #20 hub

---

## Phase H — Smoke admin (si user `is_admin = true`)

- [ ] `/(admin)/` accessible (sinon redirect /(app))
- [ ] Préparation : liste les pilotes avec leur niveau et KYC
- [ ] En cours : liste les sessions `recording` actuelles
- [ ] Analytique : 3 BigStat agrégés
- [ ] Accent visuel bronze partout (pas rouge OXV)

---

## Checklist finale avant submission stores (sem 14)

- [ ] 1 smoke test complet iPhone OK (phases A-G)
- [ ] 1 smoke test complet Android OK (phases A-G)
- [ ] Sentry remonte les events test
- [ ] Aucun crash en 30 min d'usage continu
- [ ] 0 verbe interdit affiché sur l'ensemble du parcours (grep manuel
      ou test e2e auto en V1.1)
- [ ] Les permissions sont demandées avec les bonnes formulations
      françaises (vérifier `app.json` infoPlist + permissions Android)
- [ ] Toutes les chaînes de texte sont en français impeccable
      (vouvoiement, pas d'anglicisme — `npx tsx scripts/check-french.ts`
      à écrire si on veut automatiser)

---

## Tests automatisés disponibles (sans device)

103 tests Jest passants en sem 13 J4 :

```bash
npm test
```

Périmètre :
- Parser UBX (Fletcher-8, reconstruction frames, payload decode) — 35 tests
- State machine S1-S10 (déterminisme transitions) — 13 tests
- Helpers projection lat/lon → SVG — 8 tests
- Marge composite V1 (régularité + smoothness) — 10 tests
- Focus corner (anti-verbes-interdits) — 8 tests
- Trackviz géométrie (map-matching + segments + phases) — 14 tests
- analyzeSessionService (helpers purs) — 7 tests
- **parseUbxFile (intégration sur fixture synthétique) — 5 tests** ← sem 13 J4
- debriefGenerator (anti-verbes-interdits + format 3 actes) — 16 tests

Le test `parseUbxFile.integration` génère une fixture .ubx en mémoire
à partir des `buildDemoTrackVizSamples`, la parse via le vrai parser,
et vérifie que les samples reconstruits matchent (lat/lon précision 1e-6,
vitesse ±0.5 km/h, ordre temporel préservé).

Pour générer une fixture .ubx sur disque (pour partage / debug) :

```bash
npx tsx scripts/generate-fixture-ubx.ts test-fixtures/demo-session.ubx
```

---

## Bloquants connus côté Gabin (rappel)

| Q | Sujet | Impact smoke test |
|---|---|---|
| Q9 | Compte EAS | Bloque tout build device |
| Q11 | DSN Sentry | Pas de remontée crashs en prod |
| Q12 | Flic 2 hardware | Bouton physique non testable |
| Q19 | Vrais noms 14 virages | Placeholders affichés au pilote |
| Q26 | Politique fin de session | V1 conservateur, à valider |
| Q33 | Trace GPS référence Beltoise | Map-matching approximatif |

— Claude Code, sem 13 J4
