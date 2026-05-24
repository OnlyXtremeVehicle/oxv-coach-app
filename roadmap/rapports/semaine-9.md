# Rapport semaine 9 — Paddock + Retour stands + Géolocalisation

**Date** : 25 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : 6 écrans + service géoloc livrés. Le flux **complet** d'une session (arrivée → paddock → roulage → retour → bilan) tient debout.

---

## Ce que j'ai fait

### Jour 1 — Service géolocalisation

**[src/lib/geolocation.ts](src/lib/geolocation.ts)** — wrap `expo-location` foreground :

- `requestLocationPermissions()` — request iOS/Android, met à jour `useAppStateStore.condition.geolocation`
- `setReferenceCircuit({lat, lon})` — point de référence pour calculer la distance
- `startGeolocationTracking()` — `watchPositionAsync` avec :
  - `accuracy: Balanced` (~10-30 m, économe en batterie)
  - `timeInterval: 5_000` ms
  - `distanceInterval: 50` m
  - Throttle 5 s sur le push vers le store (évite spam recompute)
- À chaque update, calcule `distanceToCircuitKm`, `moving` (speed > 5 km/h) et `headingToCircuit` (bearing théorique ±45°)
- Pousse vers `useAppStateStore.setPosition()` qui déclenche la transition d'état (S4 anticipation → S5 approche → S7 paddock)

**[src/lib/initGeolocation.ts](src/lib/initGeolocation.ts)** — câblage au mount :
- Charge le circuit officiel via `getDefaultCircuit()` (cache MMKV)
- Définit la référence, request perm, démarre le watch
- No-op silencieux si permission refusée (l'utilisateur peut toujours ouvrir le flow paddock manuellement)

Appelé dans `app/_layout.tsx` aux côtés de `initBle`, `initFlic`, `initNetInfo`.

**V1 = foreground only.** Le background location demande sur iOS la permission `Always` + `UIBackgroundModes: location` qui sont des décisions de privacy lourdes. Le passage en background sera fait en V1.1 avec un opt-in explicite à l'onboarding.

### Jour 2 — Écrans paddock #07-09

**[app/(app)/paddock.tsx](app/(app)/paddock.tsx) — #07 Vous y êtes**
- Eyebrow `BIENVENUE`, display *"Vous y êtes."* (48pt ultralight)
- Sous-titre `circuit.name` (Haute Saintonge) chargé via `getDefaultCircuit`
- Bouton primaire `Jumeler mon équipement` → equipement

**[app/(app)/equipement.tsx](app/(app)/equipement.tsx) — #08 Détection équipement**
- Variante production de [debug-capture](app/(app)/debug-capture.tsx) : scan auto au mount, timeout 30 s, message d'erreur explicite si rien trouvé
- Affichage `OXV Coach` au lieu de `RaceBox` (brand-neutral, doctrine)
- Liste devices avec RSSI ("Signal -65 dBm")
- `useEffect` qui détecte `bleStatus === 'connected'` → `router.replace('/(app)/placement')`
- Bouton "Relancer le scan" si erreur ou idle

**[app/(app)/placement.tsx](app/(app)/placement.tsx) — #09 Placement**
- Instruction headline : *"Posez le boîtier sur le support magnétique côté passager."*
- Illustration schématique : carré 160×60 (fond `background.secondary`, bordure subtle), petit carré rouge `OXV` au centre
- Manifeste *"Vous le verrez peu. Il s'occupera du reste."* (pose la promesse du silence)
- Bouton `C'est fait` → `/(app)` (hub, qui reste muet en S6)

### Jour 3-4 — Écrans retour stands #10-12

**[app/(app)/pilotage-fini.tsx](app/(app)/pilotage-fini.tsx) — #10 Vous avez piloté**
- Display centré *"Vous avez piloté."* (passé composé, reconnaissance émotionnelle)
- Caption optionnelle "X min · Y tours" lue depuis `useSessionStore`
- **Pas de bouton.** Transition auto vers donnees-securite après 4 s (respect du rythme)

**[app/(app)/donnees-securite.tsx](app/(app)/donnees-securite.tsx) — #11 Vos données sont en sécurité**
- Vocabulaire OXV : eyebrow `PRÉSERVATION` (pas "SAUVEGARDE")
- Headline *"Vos données sont en sécurité."*
- Barre de progression 3pt fond noir/rouge, simulation 6 s (vraie progression upload Storage en sem 11)
- Caption "Préservation en cours… X %"
- Auto-redirect bilan-pret à 100 %

**[app/(app)/bilan-pret.tsx](app/(app)/bilan-pret.tsx) — #12 Votre bilan est prêt**
- Display *"Votre bilan est prêt."* + manifeste *"Quand vous le souhaitez."*
- 2 boutons strictement équivalents en poids visuel :
  - `Découvrir` (primaire rouge OXV) → `/(app)/bilan`
  - `Plus tard` (bordé, secondaire) → `/(app)` (hub)
- **Doctrine essentielle** : on ne force pas la consultation. Les deux choix sont légitimes.

### Jour 5 — Wire géoloc + rapport

Le wire est fait dans `_layout.tsx`. `useAppStateStore` reçoit `setPosition` à chaque update GPS, ce qui déclenche `recompute()` qui choisit l'état pilote — donc S5/S7 sont automatiques quand la perm est accordée et le pilote bouge vers le circuit.

**Flow complet désormais possible** :
```
Login → Onboarding (8 écrans, sem 8)
     → Hub #20 (S3)
     → [reservation crée]
     → S4 (anticipation, hub mode countdown)
     → [trajet vers circuit, géoloc active]
     → S5 (approche, hub mode enroute "Bon trajet vers Beltoise")
     → S7 (paddock, arrivée détectée)
     → Paddock #07 → Équipement #08 → Placement #09
     → S6 (roulage, SILENCE TOTAL)
     → [fin session détectée]
     → Pilotage fini #10 → Données sécurité #11 → Bilan prêt #12
     → Bilan #13 → Carte #14 → Zoom #15 → Prochaine fois #16 → Progression #17
```

Tous les écrans existent. Seules les transitions automatiques (S6→S8 par exemple) demandent encore un wiring fin (sem 11 polish).

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ 61/61 tests

Pas validable sans device :
- [ ] La permission géoloc iOS/Android s'affiche bien
- [ ] Le watchPosition consomme raisonnablement (drain batterie estimé < 5 %/h en `Balanced`)
- [ ] Les auto-transitions S5/S7 fonctionnent sur le terrain
- [ ] La simulation de la barre de progression #11 reste lisible

---

## Ce qui reste en suspens

Inchangé depuis sem 8, plus :

- **Background location** : V1.1 avec opt-in explicite à l'onboarding
- **Détection auto fin de session** : pour V1, il faudra ouvrir l'app et taper sur `Mode debug` ou une route directe `/(app)/pilotage-fini`. Sem 10-11 verra peut-être un wiring auto (vitesse 0 + timer 5 min).
- **Progression upload réelle** dans #11 : actuellement simulée 6 s

---

## Questions pour Gabin

### Q26 — Détection auto fin de session : seuil et UX

Le sitemap dit "vitesse 0 + timer 5 min" pour déclencher S8. Mais ce déclenchement coupe la session (donc plus de marquage Flic possible). Trois options :

- **A — Auto 5 min** : si véhicule arrêté 5 min, fin auto. Risque : interruption pendant pause technique inter-runs.
- **B — Auto 15 min** : plus conservateur. Risque : si vraie fin de session, le pilote consulte le bilan tardivement.
- **C — Manuel uniquement** : un bouton "Terminer la session" sur un écran caché. L'utilisateur garde le contrôle.

Recommandation : **C** en V1, **B** en V1.1 quand on aura un retour terrain (test alpha juillet).

### Q27 — Permission géoloc à l'onboarding ou plus tard ?

Actuellement la permission est demandée au mount du `_layout` (donc à la première ouverture après login). Si refusée, l'app fonctionne mais sans détection auto.

Plus respectueux : la demander dans l'onboarding, **après** le pacte (par exemple un écran #06.5 "Pour vous accueillir au circuit, OXV Coach a besoin de votre position"), avec opt-out clair. À voir avec l'auditeur dev senior si vous le faites.

---

## Recommandations

### R27 — Désactiver `gestureEnabled: false` sur paddock

Sur l'onboarding j'ai désactivé le swipe-back. Sur le flow paddock je l'ai laissé actif — si vous voulez l'enlever sur #08 (équipement, à mi-flow) pour éviter une déconnexion involontaire, faites-le savoir.

### R28 — `app.json` location permission description

`NSLocationWhenInUseUsageDescription` est déjà présent dans `app.json` (justifié par le BLE scan iOS qui requiert la location). Le wording actuel est : *"iOS requiert l'accès à la localisation pour scanner les appareils Bluetooth."* — c'est un peu mince maintenant qu'on l'utilise aussi pour détecter l'arrivée au circuit. Je propose :

> *"OXV Coach utilise votre position pour détecter votre arrivée au circuit et appairer votre équipement Bluetooth."*

À valider pour la prochaine review App Store (sem 14).

---

## Estimation pour la semaine 10

Selon roadmap : **Comparateur #18 + Settings #24 + Notifications #23 + partage social.**

- **J1-2** — Écran #18 Comparateur 3 modes (évolution immédiate / récente / progression)
- **J3** — Écran #24 Settings (pacte en signature en haut, sections, déconnexion)
- **J4** — Écran #23 Notifications (3 tabs)
- **J5** — Partage social (4 scopes × 3 durées) + rapport

Estimation : **5 jours-claude**. Le partage social demande la table `app_progression_shares` (déjà spec'd dans archi P1) — à créer en migration 0011 sem 10.

---

## En résumé

**Le flow complet d'une session OXV existe maintenant côté code.** 17 routes pilote actives. La grammaire visuelle est tenue : eyebrows monospaces uppercase, displays ultralight, manifestes italiques, boutons rouge OXV, vocabulaire (préservation, vous y êtes, "Vous avez piloté").

26 commits. 61 tests. Toujours rien validé sur device — mais le code tient debout sans dette technique bloquante.

— Claude Code, 25 mai 2026
