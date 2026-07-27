# BILAN COMPLET — OXV (APPLICATION + BACKEND)

> Bilan demandé par le fondateur le 2026-07-18. Audit en lecture seule sur le
> commit `cd55aae` (branche `feat/site-document-emails`) + interrogation directe
> de la production Supabase (`fouvuqkdxarjpjbqnsjq`, Frankfurt). Règle de
> preuve : chaque affirmation trace vers un fichier ou une requête ; INCONNU
> plutôt qu'inventé. Statuts stricts : FINIE (branchée données réelles + états +
> éprouvée) · À FINIR (manque nommé) · À VÉRIFIER (code complet, jamais validé
> en conditions réelles) · PAS COMMENCÉE.

## Chiffres clés

| Mesure | Valeur |
|---|---|
| Période de développement | 24 mai → 18 juillet 2026 (8 semaines) |
| Commits | **582** |
| Lignes de code (src + app) | **≈ 145 600** |
| Routes d'écran | **171** (pilote 80 · coach 36 · admin 29 · partner 8 · pro 7 · auth 2 · onboardings 9) |
| Services | 137 fichiers |
| Tests | **837 verts** (98 fichiers de tests ; + 85 skippés = tests RLS exigeant une base live) |
| Edge functions en prod | **32, toutes ACTIVE** |
| Builds distribués | v1.0.0 **b23** et **b24** (EAS iOS interne, iPhone fondateur provisionné) |
| TypeScript / ESLint / doctrine | 0 erreur / 0 erreur / 0 verbe interdit (178 écrans scannés) |

## La ligne de fracture à connaître avant de lire

**`telemetry_frames` est quasi vide en prod (53 trames de test).** Tout ce qui se
fonde sur les TRAMES (trajectoires, G point à point, heatmap, replay, zoom
virage, 4 des 5 branches QDI) est **code-complet mais jamais passé sur une
vraie séance** → statut À VÉRIFIER, pas FINIE. Ce qui se fonde sur les TOURS et
agrégats (chronos, régularité, stats, progression) tourne sur les données réelles
V1. La première vraie journée de capture (smoke test terrain) fera basculer
d'un coup ~15 écrans de « à vérifier » vers « finie » — ou révélera les vrais bugs.
C'est LE point de bascule du projet.

---

# PARTIE 1 — FONCTIONNALITÉS PILOTE

# Audit — Fonctionnalités de l'espace pilote

**Périmètre vérifié** : `app/(app)/` = 84 fichiers .tsx (81 écrans + 3 layouts, 38 342 lignes), `app/(onboarding)/` = 5 écrans + layout, `app/(auth)/` = 2 écrans + layout. Navigation 5 zones dans `src/lib/appMap.ts:39-129` (Miroir · Data Lab · Carnet · Découverte · Compte), barre masquée en flux capture (`appMap.ts:161-179`).

**Preuves transverses** (commandes exécutées) :
- `tsc --noEmit` → **0 erreur** (EXIT=0).
- `jest --ci` → **837 tests passés, 85 skippés, 0 échec** (81 suites passées ; 17 suites skippées = `src/__tests__/rls` qui exigent une base live — les tests RLS ne tournent donc PAS en local).
- Quasi aucun mock dans les écrans : grep MOCK/FAKE/demoData sur `app/(app)` ne remonte que des `placeholder` de champs texte + 2 exceptions réelles (insights DÉMO, debug-circuit).
- Ligne de fracture factuelle : **`telemetry_frames` est vide en prod** (`app/(app)/insight/[reading].tsx:17` : « telemetry_frames vide → tout est en DÉMO jusqu'à Valence »). Tout écran fondé sur les *frames* (trajectoire, G, vitesse point à point) est donc code-complet mais jamais passé sur données réelles → À VÉRIFIER. Les écrans fondés sur les *laps/agrégats* (chronos, régularité) ont des données réelles V1.

---

## 1. Miroir (lecture de soi)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Paddock accueil 3 modes (silence S5 / countdown / passif : régularité, QDI 5 barres, meilleur tour, boîtier, prochaine journée) | `app/(app)/index.tsx` (799 l.) | FINIE | Branché réel : `telemetry_sessions` + `fetchSessionLaps` + `getOrComputeQdiForSession` + `getMyNextTrackDay` (l.82-150), loading + best-effort catch. Branches QDI issues des frames se masquent honnêtement si absentes |
| Bilan de séance (héros régularité, 4 piliers QDI, moments-clés, voix coach, export PDF, souvenirs) | `app/(app)/bilan.tsx` (1 428 l.) | À VÉRIFIER | 13 hooks de chargement, tout branché (segmentAnalyses, keyMoments, bilanPdfExport) ; jamais validé sur une séance réelle de bout en bout (bandeau DÉMO `demoBannerForEventType` présent, export PDF = view-shot device) |
| Trace narrative (un seul fait, portes Bilan/Signature/Data Lab) | `app/(app)/trace.tsx` | FINIE | `traceNarrativeService` réel (laps), états vides |
| Signature de pilotage (radar QDI pentagonal + mini-radars mensuels) | `app/(app)/signature.tsx` (718 l.) | À VÉRIFIER | 4 branches QDI sur 5 calculées depuis les frames (`qdiLogic.ts:86-107` : gLat/gLong) — frames vides en prod |
| Progression & constance (courbe or meilleur tour + histogramme) | `app/(app)/progression.tsx` (832 l.) | FINIE | `fetchAllSessions` + `fetchSessionLaps` + `computeRegularity` (testé) |
| Régularité (écart-type, barre par tour) | `app/(app)/regularite.tsx` | FINIE | Laps réels, EmptyState |
| Stats consolidées (km/sessions/tours, records par circuit) | `app/(app)/stats.tsx` | FINIE | `loadPilotStats`, modes simple/détaillé |
| Comparateur 2 séances (4 lignes factuelles, sans gagnant) | `app/(app)/comparateur.tsx` | FINIE | Laps réels ; ne lit pas encore la pré-sélection du panel de cartes (cf. §7) |
| Empreinte saison (mini-radars QDI mensuels) | `app/(app)/empreinte-saison.tsx` | À VÉRIFIER | `listMonthlyQdi` = médianes de branches frames-dépendantes |
| Passeport piste (identité cumulative, palier, records) | `app/(app)/passeport.tsx` | FINIE | `loadPassport` + `registrations.offer_type`, badge masqué sans inscription |
| Carte licence FFSA + insigne partageable | `app/(app)/carte-licence.tsx` | À VÉRIFIER | Données réelles (`users.ffsa_license`, `kyc_status`) ; capture `react-native-view-shot` + partage OS jamais éprouvés sur device (dépendance = rebuild EAS) |
| Debrief J+1 (récit IA 3 actes) | `app/(app)/debrief.tsx` | À VÉRIFIER | Lit `app_session_analyses.debrief_text` avec fallback pédagogique ; edge `generate-debrief-ai` existe (`supabase/functions/`) mais génération + push J+1 jamais validés en réel ; filtre `aiSafetyFilter` testé |
| Debrief présentiel (fil de notes coach↔pilote temps réel) | `app/(app)/debrief-presentiel.tsx` | À VÉRIFIER | `coach_messages` + `useCoachThread` (migration realtime 20260711181903) ; temps réel jamais validé à deux appareils |
| Pass OXV (inscriptions, QR de présence, événements ouverts) | `app/(app)/pass-oxv.tsx` | FINIE | Côté pilote complet ; le SCAN du QR (expo-camera) reste à brancher **côté admin** (`pass-oxv.tsx:6`) |

## 2. Data Lab (analyse)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Hub Data Lab parlant (cartes-aperçus réels, confiance donnée, export CSV) | `app/(app)/data-lab.tsx` (1 097 l.) | FINIE | Aperçus = centerline réelle, chronos réels, compteur de constats identique à Insights ; `computeDataConfidence` testé |
| Carte du circuit (pastilles de marge par virage) | `app/(app)/carte.tsx` | À VÉRIFIER | `loadSessionTrajectory` (frames) + `getCornerMarginsZones` — carte masquée sans mock (`carte.tsx:110`), jamais alimentée en réel |
| Zoom virage (phases frein/apex/sortie, références + audio coach) | `app/(app)/virage.tsx` (1 198 l.) | À VÉRIFIER | Frames-dépendant ; audio coach (`getAnnotationAudioUrl`) jamais éprouvé device |
| Comparer un virage (2 tours superposés) | `app/(app)/virage-comparer.tsx` | À VÉRIFIER | `loadLapFrames` ×2 — frames vides en prod |
| Tour par tour (barres de delta, meilleur en or) | `app/(app)/tours.tsx` | FINIE | Laps réels + pastilles G des colonnes laps ; états L=8/E=7/V=4 |
| Carte de chaleur vitesse | `app/(app)/heatmap.tsx` | À VÉRIFIER | Source `telemetry_frames` (l.74) — vide en prod, état vide honnête |
| Rejouer un tour (scrubber manuel) | `app/(app)/replay.tsx` | À VÉRIFIER | `loadLapFrames` — frames |
| Télémétrie (diagramme G-G + 3 canaux) | `app/(app)/telemetry.tsx` (945 l.) | À VÉRIFIER | Frames |
| Insights — constats de séance (liste) | `app/(app)/insights.tsx` | À VÉRIFIER | Constats dérivés réels (laps + branches QDI persistées, gating offre respecté), mais marqueur DÉMO assumé pré-Valence (`DEMO_NOTICE` l.209) |
| Insights — 6 lectures approfondies (anatomie, G-G, dispersion, tour idéal, flow, transfert) | `app/(app)/insight/[reading].tsx` + `src/components/insights/*Viz.tsx` | À FINIR | Les 6 viz existent mais rendent des **données DÉMO codées en dur** (ex. `AnatomieViz.tsx:38` « Données DÉMO du virage 3 ») — câblage sur frames réelles post-Valence manquant |
| Vue unifiée Skia | `app/(app)/data-lab-canvas.tsx` | À VÉRIFIER | En-tête : « APERÇU TECHNIQUE, à valider au build » ; garde Expo Go, jamais validé en build natif |
| Conditions & ressenti (faits météo vs note pilote) | `app/(app)/conditions.tsx` | FINIE | `weather_snapshots` + `pilotNotesService`, zéro schéma |

## 3. Carnet (espace perso)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Carnet (météo du jour réelle, composer ressenti CRUD, fil de notes) | `app/(app)/carnet.tsx` (1 044 l.) | FINIE | `pilot_notes` own-row, section météo masquée sans relevé du jour |
| Prochaine fois (intentions numérotées, saisie réelle) | `app/(app)/prochaine-fois.tsx` | FINIE | `session_intentions` + `savePendingIntention` (une seule intention en attente, logique documentée) |
| Objectifs personnels (un actif, auto-évaluation libre) | `app/(app)/objectifs.tsx` | FINIE | `pilotGoalsService`, invisible au coach (migration 0023) |
| Programme partagé par le coach (lecture seule) | `app/(app)/programme.tsx` | FINIE | `listSharedCyclesForMe`, états vides |

## 4. Découverte (marketplace / social)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Hub 3 onglets Coachs / Partenaires / Roulages (prix séance réel) | `app/(app)/coachs.tsx` (1 280 l.) | FINIE | `listPublishedCoaches` + amis + médias, pills d'état local |
| Fiche coach + demande de séance | `app/(app)/coach/[id].tsx` (889 l.) | FINIE | `requestBooking` (Phase 1, aucun paiement in-app), 10 états vides |
| Mon coach (consentement RGPD donner/retirer + factures, paiement par lien) | `app/(app)/mon-coach.tsx` (852 l.) | FINIE | `pilotConsentService` + `pilotCoachBillingService` ; paiement = ouverture d'un lien externe |
| Mes demandes (suivi, annulation, avis 1-5) | `app/(app)/mes-demandes.tsx` | FINIE | `coaching_bookings` RLS pilote, UPSERT `coach_reviews` |
| Roulages (invitations reçues, accepter/décliner, historique) | `app/(app)/roulages.tsx` | FINIE | `roulagesService` + résolution nom coach |
| Amis (@handle, demandes, « roulé ensemble ×N ») | `app/(app)/amis.tsx` | FINIE | `friendshipsService` + croisement réel des analyses |
| Côte à côte (2 amis, tracés superposés, sans gagnant) | `app/(app)/cote-a-cote/[friendId].tsx` | À VÉRIFIER | Tracé superposé = frames des deux pilotes ; jamais éprouvé à deux comptes réels |
| Partenaires + lead consenti | `app/(app)/partenaires.tsx` | FINIE | Confirmation explicite avant création du lead (RLS `partner_leads`) |
| Catalogue d'offres par catégorie | `app/(app)/catalogue.tsx` (867 l.) | FINIE | `listMarketplace` ; garde-fou doctrinal : jamais de push télémétrique |
| Fiche partenaire (vitrine photos réelles) | `app/(app)/partenaire/[id].tsx` (971 l.) | FINIE | Images réelles des offres, placeholder monogramme sinon |
| Carte OXV (territoire : carte + liste, filtres par catégorie) | `app/(app)/carte-oxv.tsx` (1 129 l.) | FINIE | `social_pings` + circuits ; garde `isExpoGo` (repli hors carte native) |
| Belles routes (certifiées, hors chrono) | `app/(app)/belle-route.tsx` | FINIE | `scenic_routes` `status='certified'` |
| Créer votre route (planificateur GraphHopper + POI Overpass) | `app/(app)/creer-route.tsx` (818 l.) | À VÉRIFIER | Réintroduit build 23 ; dépend de 2 API externes (GraphHopper, Overpass) jamais validées en conditions réelles depuis le retour |
| Mes routes (sauvegarde, demande de certification, suppression) | `app/(app)/mes-routes.tsx` | FINIE | `scenicRoutesService` |
| Créer un tracé (import way OSM → circuit privé/proposé) | `app/(app)/creer-trace.tsx` | À FINIR | Import OSM fonctionnel ; modes « tracé manuel » et « depuis une session » explicitement « à venir » (`creer-trace.tsx:13`) |
| Galerie souvenirs (tous médias OXV) | `app/(app)/galerie.tsx` | FINIE | `listAllPilotMedia`, 12 occurrences d'états vides ; crédit partenaire de la maquette non affiché (aucune donnée réelle) |
| Galerie média d'une session | `app/(app)/session-media/[sessionId].tsx` | FINIE | RLS DB + Storage |
| Partage par lien public (scopes, durée, révocation) + vue par token | `app/(app)/partage.tsx` + `app/(app)/share/[token].tsx` | FINIE | RPC `get_shared_progression`, liste blanche de métriques |
| Carte trophée partageable (image 4:5) | `app/(app)/carte-trophee.tsx` | À VÉRIFIER | Meilleur tour + tracé réels ; capture view-shot + expo-sharing jamais éprouvés sur device |
| Club (hub de liens) | `app/(app)/club/index.tsx` | FINIE | Hub de navigation pur, 8 liens, aucun contrôle sans effet |

## 5. Compte (réglages)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Compte hub (profil réel, carte boîtier, liste réglages) | `app/(app)/compte/index.tsx` | FINIE | Chaque valeur trace vers une table réelle |
| Profil public (consultation : galerie, garage, compteur cartes, @handle) | `app/(app)/profil.tsx` (751 l.) | À FINIR | Migration `20260717000000_profil_pavillon.sql` jointe mais **NON APPLIQUÉE en prod** → bio / n° voiture / opt-in Pavillon masqués (repli 42703 codé, `src/lib/queries/profil.ts:7-10`) ; statut Fondateur non tranché (TODO_ARBITRAGE `profil.tsx:385`) |
| Édition profil (bio, réseaux, handle) | `app/(app)/profil-edition.tsx` | À FINIR | Même dépendance migration ; avatar/couverture non éditables (aucun write-path réel — assumé) |
| Réglages (consents IA, analytics opt-out, export, suppression compte, déconnexion) | `app/(app)/settings.tsx` | FINIE | 9 services branchés ; le commentaire d'en-tête « le reste affiche Bientôt » (l.9) est PÉRIMÉ — le corps est câblé |
| Centre de consentements unifié | `app/(app)/consentements.tsx` | FINIE | `consentService` = même source que Réglages (pas de double vérité) |
| Données & sécurité RGPD (export, suppression) | `app/(app)/donnees-securite.tsx` | FINIE | 2FA et changement de mot de passe de la maquette NON rendus — aucun backend (drop honnête documenté l.9-12) |
| Préférences notifications (maître + debrief + rituel + offres) | `app/(app)/notifications.tsx` | À VÉRIFIER | Colonnes réelles `users.push_notif_enabled` / `notification_preferences` / `notif_offers` ; notifications programmées jamais éprouvées sur device |
| Garage (CRUD véhicules, photos réelles, journal de réglages) | `app/(app)/garage.tsx` + `garage/[vehicleId].tsx` | FINIE | Médias `users.media` par `vehicleId`, URLs signées, jamais d'image factice |
| Mon boîtier (état, batterie, historique santé) | `app/(app)/mon-equipement.tsx` | À VÉRIFIER | `deviceHealthService` RLS ; données de santé réelles n'existent qu'après du terrain |
| Circuits (roulés avec record or / non roulés en pointillé) | `app/(app)/circuits.tsx` | FINIE | `fetchCircuits` + `loadPilotStats`, zéro nouvelle table |
| Détail circuit + services écosystème | `app/(app)/circuit/[id].tsx` | FINIE | `ecosystemService`, mise en relation seule (étape A) |
| Support (création ticket, fil, réponse) | `app/(app)/support/index.tsx` + `support/[id].tsx` | FINIE | `supportService`, statut lecture seule pilote |
| Décharge de responsabilité e-sign | `app/(app)/decharge.tsx` | À FINIR | Gatée flag `pilot_waivers` **OFF** → écran « Bientôt » (l.117) ; bloquant nommé : relecture avocat du texte (l.6-8) ; migrations waiver présentes (20260712091000/093000) |
| Documents légaux in-app (Pacte, CGU, confidentialité) | `app/(app)/legal/[doc].tsx` | FINIE | Textes bundlés depuis `docs/juridique/` via `genlegal.js` |

## 6. Flux capture (Préparation → Bilan prêt)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Hub Session (étape courante selon state machine) | `app/(app)/session/index.tsx` | FINIE | Dérive S5/S6 de `useAppStateStore`, navigation pure |
| Préparation journée (météo réelle, check-list, créneau, QR Pass) | `app/(app)/preparation.tsx` (684 l.) | FINIE | `nextTrackDayService` + `registrations` ; « placement paddock » maquette non rendu (pas en base) |
| Arrivée circuit « Vous y êtes » (S5→S7) | `app/(app)/paddock.tsx` | À FINIR | **Déclenchement géolocalisation absent** : « V1 sans détection auto fiable, navigable manuellement depuis debug-capture ou deep link » (`paddock.tsx:4-6`) |
| Équipement (scan BLE, mémoire dernier boîtier, flotte) | `app/(app)/equipement.tsx` | À VÉRIFIER | `bluetoothService` + permissions + `getMyAssignedDevice` ; exige un RaceBox réel — smoke test device non fait |
| Placement + démarrage capture (multi-circuit) | `app/(app)/placement.tsx` | À VÉRIFIER | `startCaptureSession` + `captureFinishLineFor` ; ligne d'arrivée Valencia à remplir en SQL (migrations `20260715120000`/`20260716120000` présentes, application prod non vérifiable d'ici) |
| Roulage silencieux (REC pulsant, aucun chiffre) | `app/(app)/roulage.tsx` | À VÉRIFIER | Capture en tâche de fond + file de sync offline (`captureSyncQueue`) — livrée, jamais éprouvée terrain |
| Entre-runs (compte à rebours réel, note rapide) | `app/(app)/entre-runs.tsx` | À VÉRIFIER | Compte à rebours masqué sans session du jour ; meilleur tour depuis `useSessionStore` = exige une capture live |
| Fin de flux : Pilotage fini → Préservation (upload .ubx + analyse + timeout 30 s) → Bilan prêt | `pilotage-fini.tsx` + `preservation.tsx` + `bilan-pret.tsx` | À VÉRIFIER | `analyzeAndPersistSession` branché, fallbacks robustes ; chaîne complète device→base→bilan jamais validée sur séance réelle |
| Debug capture (fixtures .ubx, détection tours, Flic 2) | `app/(app)/debug-capture.tsx` (656 l.) | FINIE | Outil DEV, gaté `__DEV__` (l.54, redirect sinon) |
| Debug circuit (rendu tracé) | `app/(app)/debug-circuit.tsx` | FINIE | Outil DEV, seule utilisation assumée de `DEMO_SESSION_INSIGHTS` |

## 7. Profil & cartes (lot PROFIL_CARTES) — complément

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Panel de cartes sessions (filtres, sélection 2 cartes, barre de comparaison) | `app/(app)/cartes.tsx` | À FINIR | Sessions réelles `status='completed'` ; le bouton Comparer pousse vers `/comparateur` **sans transmettre la pré-sélection** (TODO_LOT_SUIVANT `cartes.tsx:114`) ; température piste absente du schéma (`CarteSession.tsx:1`) |

## 8. Auth & Onboarding

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Login e-mail + mot de passe | `app/(auth)/login.tsx` | FINIE | États loading/error du store, redirection par rôle |
| Liaison par code d'appairage du site (+ deep link `oxv://lier`) | `app/(auth)/lier.tsx` | À VÉRIFIER | Dépend d'une edge `pair-app` qui n'est PAS dans `supabase/functions/` de ce repo (côté site ?) — existence non vérifiable d'ici ; flux jamais éprouvé bout en bout |
| Onboarding 6 écrans (accueil → doctrine → méthode → niveau → CGU → pacte) | `app/(onboarding)/*.tsx` | FINIE | Écritures réelles : `setPilotLevel`, `acceptCguAndPrivacy`, `acceptPact` + `completeOnboarding` ; pas de bouton « passer » (doctrine) |

---

## Absentes du code (mentionnées specs/maquettes)

| Fonctionnalité | Source de la mention | Statut |
|---|---|---|
| Changement / réinitialisation de mot de passe | maquette 40-donnees-securite (cf. `donnees-securite.tsx:9-12`) | PAS COMMENCÉE |
| 2FA | même maquette | PAS COMMENCÉE (aucun backend) |
| Statut « Fondateur » sur le profil | spec lot PROFIL_CARTES §5.5 | PAS COMMENCÉE (arbitrage M. Fillat en attente, `profil.tsx:385`) |
| Couverture de profil (upload) | référence profil.html | PAS COMMENCÉE (aucun write-path, aucune colonne) |
| Drops doctrinaux assumés (pas des manques) : état pneus entre-runs (aucun capteur), crédit partenaire galerie, placement paddock jour J | en-têtes `entre-runs.tsx`, `galerie.tsx`, `preparation.tsx` | — |

---

## Compteurs (83 fonctionnalités recensées)

- **FINIES : 46**
- **À FINIR : 8** (6 lectures Insight en données démo · modes manuel/session de créer-trace · profil + édition bloqués par migration pavillon non appliquée · décharge flag OFF/avocat · arrivée circuit sans géoloc · pré-sélection panel cartes → comparateur)
- **À VÉRIFIER : 25** — dont le bloc dominant : tout ce qui dépend de `telemetry_frames` (vide en prod) et du terrain BLE/device (flux capture complet, Data Lab trajectoires/G/vitesse, signature QDI, captures view-shot, notifications push, liaison `pair-app`)
- **PAS COMMENCÉES : 4** (+3 drops doctrinaux assumés)

## Marqueurs trouvés dans le code

- `TODO_ARBITRAGE` : 1 — statut Fondateur, `app/(app)/profil.tsx:385`
- `TODO_LOT_SUIVANT` : 1 — pré-sélection des 2 cartes dans le comparateur, `app/(app)/cartes.tsx:114`
- `DIVERGENCE_SCHEMA` : 6 fichiers — `app/(app)/profil.tsx:1`, `app/(app)/profil-edition.tsx:1`, `app/(app)/cartes.tsx:1`, `src/components/cartes/CarteSession.tsx:1` (température piste absente du schéma), `src/components/profil/GalerieGrille.tsx:1`, `src/lib/queries/profil.ts:1` + `src/lib/queries/cartes.ts:1` (adaptations au schéma réel 17/07/2026, dont migration pavillon non appliquée)

**Point unique le plus structurant** : la migration `supabase/migrations/20260717000000_profil_pavillon.sql` est dans le repo mais non appliquée en prod (d'après les commentaires du lot, non vérifiable en base d'ici → INCONNU côté prod) ; son application débloque d'un coup bio, n° voiture et opt-in Pavillon sur 2 écrans. Le second : la première séance réelle avec frames (Valence) fait basculer d'un coup ~10 fonctionnalités « À VÉRIFIER » du Data Lab et du flux capture.

---

# PARTIE 2 — FONCTIONNALITÉS COACH

# Audit — Espace coach (`app/(coach)/`, 37 routes)

Méthode : lecture des 37 fichiers de route (25 883 lignes au total), traçage des imports services → tables Supabase, exécution de la suite Jest coach/live/roulages (`npx jest --testPathPattern "(coach|live|roulage)"` → **13 suites PASS, 130 tests verts, 4 suites RLS skipped** faute de credentials DB locaux : `src/__tests__/rls/coachAiRLS.test.ts`, `coachAnnotationsRLS`, `coachGradedAccessRLS`, `coachSessionsRLS`). Aucune donnée mockée détectée dans les écrans (tous les hits « placeholder » sont des placeholders de TextInput). 30/36 écrans utilisent `StateWrapper` (loading/erreur/vide) ; les 6 autres gèrent leurs états inline ou n'en ont pas besoin (layout).

## Réponses aux 3 questions posées

**1. Le live (P5) est-il validé terrain ? NON.** Le pipeline est complet et durci — relais BLE→Realtime greffé sur la capture et gaté consentement avec révocation en vol (`src/services/liveRelayRunner.ts:47-48,100-117`), canaux privés + roster par-coach (`src/services/liveSessionService.ts:4-14`), RLS `realtime.messages` **appliquée en prod le 2026-07-11** (`supabase/migrations/20260711181903_live_realtime_authorization.sql` ; doc `docs/architecture/09_SCHEMA_LIVE_MESSAGES_PROPOSITION.md:125` « ✅ DURCI (appliqué 2026-07-11) »), logique testée (`liveRelayLogic.test.ts`, `liveSessionLogic.test.ts` PASS). Mais le **seul flux éprouvé de bout en bout est le simulateur `__DEV__`** (`app/(coach)/en-direct.tsx:137,324-357`, `liveSessionService.ts:176`) ; aucune trace dans le repo d'un test réel RaceBox→relais→écran coach (la checklist device `roadmap/BUILD_DEVICE_CHECKLIST_2026-07-01.md` a ses cases non cochées).

**2. L'IA a-t-elle ses gardes ? OUI, 4 couches, fail-closed.** (a) Consentement : RPC `coach_ai_consent` fail-closed côté edge (`supabase/functions/coach-ai-draft/index.ts:89-90`), opt-in pilote défaut OFF ; (b) filtre doctrinal serveur à la génération (rejet 422 `doctrine_violation` + audit, `coach-ai-draft/index.ts:195-201`) ; (c) **re-filtre du texte édité** à la validation + création d'annotation par le seul chemin edge, auto-publication bloquée par RLS (`coach-ai-validate/index.ts:90-132` ; `src/services/coachAiService.ts:111-114`) ; (d) trigger doctrinal DB sur `coach_annotations` + garde app `aiSafetyFilter.ts` (lexique proscrit verrouillé par snapshot, `src/services/aiSafetyFilter.ts:43-113`). Validation humaine obligatoire avant tout envoi pilote. Edges déployées ACTIVE `verify_jwt=true`, RLS vérifiée sur 9 cas (`roadmap/rapports/pr-46-assistant-ia-coach.md:39-64`).

**3. La facturation est-elle gatée ? OUI, avec un trou nommé.** Double gate : flag `app_feature_flags.coach_billing` — **INACTIF jusqu'au SIRET** (`app/(coach)/facturation.tsx:10,104-110` ; entrée du Poste masquée `index.tsx:172-178` ; `isFlagEnabled` renvoie false sur erreur → fail-closed, `featureFlagsService.ts:42-50`) — plus gate métier `canIssueInvoice` (opt-in + nom + SIRET non vides, `coachBillingLogic.ts:54-66`, vérifié à l'écran `facture-nouvelle.tsx:125-131`). **Trou** : `facture-nouvelle.tsx` et `facturation-identite.tsx` ne re-vérifient pas le flag — une navigation directe par route les atteint flag OFF ; seul le gate métier retient alors l'émission.

## A — Poste & lecture de séance

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Poste (hub binômes, activité, à-faire) | `app/(coach)/index.tsx` (1 238 l.) | FINIE | RLS `coach_pilots_view` (actifs+consentis), file `coach_queue` réelle ; logique testée (`coachQueueLogic.test`, `coachConsoleLogic.test` PASS) |
| File de lecture (à lire/lues/archivées) | `app/(coach)/file-lecture.tsx` | FINIE | Statut explicite persistant table `coach_queue` (`coachQueueService.ts:23-59`) |
| Studio télémétrique (QDI, carte, tours) | `app/(coach)/studio.tsx` | FINIE | Trace GPS best-effort (`studio.tsx:110`) — vide tant que le boîtier n'a rien déposé, état géré |
| Triage (virages à moindre marge) | `app/(coach)/triage.tsx` | FINIE | `coachTriageLogic.test` PASS ; désigne sans prescrire (doctrine C3) |
| Débrief mode présentation | `app/(coach)/debrief.tsx` | FINIE | EmptyState explicite sans repères de marge (`debrief.tsx:214`) |
| Comparer 2 séances d'un pilote | `app/(coach)/comparer.tsx` | FINIE | Régularité réelle via `regularityService` ; « — » si non mesurable |
| Comparer 2 pilotes | `app/(coach)/comparer-pilotes.tsx` | FINIE | Doctrine « deux styles, pas un meilleur » respectée |

## B — Studio d'expression / outils coach

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Annoter un virage (texte + mémo vocal) | `app/(coach)/annoter.tsx` (1 019 l.) | FINIE | Texte : CRUD réel + visibilité private/shared. **Mémo vocal à vérifier sur device** (micro expo-av + bucket privé `coach-audio`, `coachAudioService.ts:23-104` — jamais confirmé matériel) |
| Gabarits de commentaire | `app/(coach)/gabarits.tsx` | FINIE | Table `coach_annotation_template` (`coachCurationService.ts:124-159`) |
| Repères de virage multi-circuit | `app/(coach)/reperes.tsx`, `repere/[index].tsx` | FINIE | Migration `20260716180000_corner_references_multicircuit.sql` ; `coachReferenceLogic.test` PASS |
| Ma lecture (pondération des composantes) | `app/(coach)/lecture.tsx` | FINIE | Table `coach_reading_weights` ; `coachReadingLogic.test` PASS |
| Contexte de séance (cadrage sportif) | `app/(coach)/contexte.tsx` | FINIE | Table `coach_session_context` ; `coachContextLogic.test` PASS |
| Priorités du bilan | `app/(coach)/priorites.tsx` | FINIE | Table `coach_pilot_highlight` (`coachCurationService.ts:46-89`) |
| Rapport de séance PDF | `app/(coach)/rapport.tsx` | À VÉRIFIER | Rendu `coachReportPdfService` + share sheet native **jamais confirmés sur device réel** ; bilan non stocké (voyage dans le PDF, choix assumé `rapport.tsx:6`) |

## C — Relation pilote

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Fiche pilote (CRM lecture seule) | `app/(coach)/pilote/[id].tsx` (1 084 l.) | FINIE | 5 services réels (profil, notes, signature, médias) ; badge « consenti · lecture seule » |
| Plan d'objectifs mesurables | `app/(coach)/plan.tsx` | FINIE | Table `coach_objectives` ; `coachObjectivesService.test` PASS ; pas d'échéance (absente du schéma, rien d'inventé) |
| Programmes adaptatifs (liste + détail) | `app/(coach)/cycles.tsx`, `cycles/[id].tsx` | FINIE | `pilot_development_cycles`/`cycle_steps` ; contenu prescriptif refusé (garde `isDoctrineSafe` + trigger DB, `cycles/[id].tsx:8-10`) ; RLS test présent (skipped local) |
| Messagerie coach↔pilote (liste + fil, temps réel) | `app/(coach)/messages.tsx`, `messages/[coachPilotId].tsx` | À VÉRIFIER | Table `coach_messages` + Realtime `postgres_changes` (`useCoachThread.ts`) — **aucun test unitaire du service, jamais validé entre 2 comptes réels** ; RGPD ok (table sans coordonnées) |

## D — Agenda / marketplace / roulages

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Calendrier semaine/agenda | `app/(coach)/calendrier.tsx` | FINIE | `listCoachBookings` + `listMyAvailability` réels ; math de placement horaire non testée unitairement |
| Disponibilités (créneaux réservables) | `app/(coach)/disponibilites.tsx` | FINIE | `createAvailability`/`updateAvailabilityStatus` — consommés par la fiche publique pilote |
| Demandes reçues (accepter/décliner) | `app/(coach)/demandes.tsx` | FINIE | `respondToBooking` (RLS coach_respond) ; « Proposer un créneau » = simple renvoi vers Disponibilités, pas d'action serveur propre (assumé, `demandes.tsx:24`) |
| Roulages : liste / création / détail-roster | `app/(coach)/roulages/{index,nouveau,[id]}.tsx` | FINIE | `roulagesService` + `roulagesLogic.test` PASS ; invitations réelles. Le « multi-live jour J » évoqué dans l'en-tête de `[id].tsx:4` n'est PAS branché (voir Pas commencées) |

## E — Business & facturation

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Tableau business (revenus roulages) | `app/(coach)/business.tsx` | FINIE | Gaté permission `can_view_business_dashboard` (fail-safe, `useCoachPermissions.ts`) ; revenu uniquement si prix renseigné — rien de fabriqué |
| Hub facturation (profil + factures + PDF) | `app/(coach)/facturation.tsx` | À VÉRIFIER | Complet et gaté flag `coach_billing` **INACTIF en prod** — dormant, jamais éprouvé avec un vrai SIRET/une vraie facture |
| Identité de facturation (émetteur) | `app/(coach)/facturation-identite.tsx` | FINIE | Champs 1:1 `coach_profiles` (zéro colonne nouvelle) ; Luhn SIRET indicatif non bloquant ; **ne re-vérifie pas le flag** |
| Émettre une facture (n° atomique + PDF) | `app/(coach)/facture-nouvelle.tsx` | À VÉRIFIER | Gate métier `canIssueInvoice` OK ; n° serveur durci (`20260712090000_harden_next_coach_invoice_number_authz.sql`) ; **pas de check flag local** ; émission + PDF jamais éprouvés en réel |
| Fiche publique / compte pro | `app/(coach)/profil.tsx` | FINIE | `coach_profiles` RLS owner + upload bucket `coach-media` avec rollback storage si la DB échoue (`coachMediaService.ts:103-162`) |

## F — Live & AR

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| En direct — roster pilotes en piste | `app/(coach)/en-direct.tsx` | À VÉRIFIER | Chaîne complète + consentement + RLS realtime appliquée ; **jamais validé terrain** (seul flux éprouvé = simulateur `__DEV__`) |
| En direct — focus 1 pilote (chrono, V, G) | `app/(coach)/en-direct/[sessionId].tsx` | À VÉRIFIER | États de connexion honnêtes (live/ralenti/coupé) ; laps best-effort ; delta « vs best » de la maquette volontairement non affiché (pas de source, `[sessionId].tsx:29`) ; même dette terrain |
| Vue AR (Ray-Ban Display, E0.1) | `app/(coach)/ar.tsx` | À FINIR | **« Lancer la vue AR » est un no-op documenté** (`ar.tsx:197-202`) ; route web `app.oxvehicle.fr/ar-view` (E0.2) non confirmée en ligne (fallback WebView géré) ; appairage lunettes absent. Sélection pilote/session réelle, gardes doctrine posées |

## G — IA assistée + infra

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Assistant IA (file, contexte, historique) | `app/(coach)/assistant.tsx` (1 301 l.) | FINIE | 4 couches de gardes (voir réponse 2) ; 3 états distincts (vide ≠ erreur ≠ consentement absent) ; jamais utilisé par un vrai binôme en prod (opt-in pilote défaut OFF) |
| Layout coach (guard rôle + responsive) | `app/(coach)/_layout.tsx` | FINIE | Redirect `/(app)` si `role !== 'coach'` (`_layout.tsx:33-35`) ; rail console / onglets compagnon ; `coachNav.test` PASS |

## Pas commencées (mentionnées, absentes du code)

| Fonctionnalité | Référence | Note |
|---|---|---|
| Multi-live d'un roulage (roster live jour J) | annoncé `app/(coach)/roulages/[id].tsx:4` | Aucun code ; le live actuel est mono-pilote |
| Push AR vers les lunettes + appairage (E0.2 côté app) | `ar.tsx:200-201` | Dépend de la route web `ar-view` (site) et de la dev preview Meta |
| Action serveur « Proposer un créneau » sur une demande | `demandes.tsx:24` | Choix assumé (renvoi vers Disponibilités) — à requalifier si le fondateur attend une contre-proposition tracée |

## Compteurs finaux

| Statut | Routes | Détail |
|---|---|---|
| FINIE | **29/37** | familles A (7), B (6), C (4), D (6), E (3), G (2, dont layout), + annoter |
| À VÉRIFIER | **7/37** | rapport PDF, messages ×2, facturation hub, facture-nouvelle, en-direct ×2 — tous complets, aucun validé en conditions réelles |
| À FINIR | **1/37** | vue AR (lancement no-op, route web absente) |
| PAS COMMENCÉE | **3 items hors-routes** | multi-live roulage, push/appairage AR, contre-proposition de créneau |

Tests : 130 verts / 0 échec sur le périmètre coach-live-roulages ; 22 tests (4 suites RLS) non exécutables localement sans credentials. Le talon d'Achille de l'espace n'est pas le code — c'est l'absence totale de validation terrain (device réel, RaceBox réel, binôme réel) sur le live, la facturation et les PDF.

---

# PARTIE 3 — FONCTIONNALITÉS PARTENAIRE · ADMIN · PRO

# Audit — Espaces Partenaire, Admin, Pro (app mobile)

**Volumes** : `app/(partner)/` = 8 écrans + layout (2 472 lignes) · `app/(admin)/` = 29 écrans + layout (8 776 lignes) · `app/(pro)/` = 7 écrans + layout (1 870 lignes).
**Garde d'accès** : routage mono-rôle à la racine (`app/index.tsx:93-103`) ; guards stricts par groupe — partner (`app/(partner)/_layout.tsx:18`), admin `is_admin` (`app/(admin)/_layout.tsx:17`), pro `role='pro_pilot'` (`app/(pro)/_layout.tsx`). Aucune donnée mock/démo détectée dans les 3 groupes (grep MOCK/placeholder/fictif : seulement des `placeholder=` de champs de saisie).

## 1. PARTENAIRE — 8 écrans

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Tableau de bord (statut compte, 3 compteurs, 7 accès, événements liés) | `app/(partner)/index.tsx` (services `partnerService.ts`, `eventsService.ts`) | FINIE | StateWrapper loading/erreur/vide (l.96-104) ; données réelles `partner_accounts`/`partner_offers`/`partner_leads` (`partnerService.ts:66-171`). Zéro test unitaire `partnerService` |
| Ma fiche (zone desservie + description) | `app/(partner)/profil.tsx` | FINIE | Écriture limitée RLS `owns_partner_account` (header l.5-6) ; nom/type/statut réservés admin |
| Mes offres — créer/éditer/publier/archiver/supprimer | `app/(partner)/offres.tsx` (443 l.) | FINIE | CRUD complet sur `partner_offers` (`partnerService.ts:236-247`) ; prix AFFICHÉ, jamais encaissé (header l.5) |
| Mes leads — suivi statut (nouveau→contacté→réservé/perdu/archivé) | `app/(partner)/leads.tsx` | FINIE | Filtres + détail + `setLeadStatus` (`partnerService.ts:194`). Jamais d'identité pilote ni télémétrie (header l.4-8, RLS) |
| Performance (agrégats leads/offres) | `app/(partner)/performance.tsx` | FINIE | Dérivé de `listMyLeads`+`listMyOffers` (l.63), lecture seule, zéro nouvelle table |
| Mes rapports B2B (partagés par OXV) | `app/(partner)/rapports.tsx` | À FINIR | **Pas d'état erreur** : seulement loading+vide (l.23-40, 55-60) ; `listMySharedReports` avale l'erreur → erreur réseau = « Aucun rapport ». À corriger |
| Facturation | `app/(partner)/facturation.tsx` | À FINIR | Placeholder assumé et honnête (header l.2-8 : « OXV n'encaisse rien ») ; paiement Stripe + RIB/QR SEPA **PAS COMMENCÉS** (confirmé : aucun code paiement partenaire) |
| **Mon point sur la carte** (nouveau, 2026-07-17) | `app/(partner)/point.tsx` (531 l.) | À VÉRIFIER | Code complet : catégories fondateur (l.47), géoloc appareil avec fallback saisie (l.116-140), validation lat/lon (l.152-160), `is_published:false` forcé côté service (`socialPingsService.ts:341`) + RLS (migration `20260716200000...sql:71`). **Jamais éprouvé en réel** ; application de la migration en prod invérifiable depuis le repo (INCONNU) ; types Supabase non régénérés (casts `as never`, `socialPingsService.ts:310-311, 380`) |

**Boucle lead complète et branchée bout en bout** : pilote consent (`requestPartnerContact`, `partnerService.ts:358-377`, appelé depuis `app/(app)/partenaires.tsx:71` et `app/(app)/coachs.tsx:206`) → partenaire suit (`leads.tsx`) → admin supervise (`countLeadsByStatus`, `partnerService.ts:427`).

## 2. ADMIN — 29 écrans (hub 21 entrées `app/(admin)/index.tsx:22-128` + 2 accès contextuels : `b2b-rapport` via `evenements/[id].tsx:257`, `analyse-session/[id]` via `qualite-data.tsx:143`)

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Hub admin | `index.tsx` | FINIE | 21 entrées, navigation statique |
| Tour de contrôle du jour (événements, présences, sessions, anomalies) | `tour-controle.tsx` + `adminControlTowerService.ts:45-88` | FINIE | Agrégats réels ; lecture seule |
| **Points de la carte + file de validation partenaire** | `points-carte.tsx` (CRUD l.153-229 ; « Valider » l.198-209, 535-543 ; `listPendingPartnerPings` `socialPingsService.ts:360-367`, `publishPing` :377-380) | CRUD admin : FINIE · file de validation : À VÉRIFIER | Workflow complet côté code ; même dépendance migration `partner_id` non vérifiée en prod que `point.tsx` |
| Scan check-in QR (Pass OXV) | `scan-checkin.tsx` (expo-camera l.15, 84-87) | À VÉRIFIER | Le header lui-même (l.5-6) : « la caméra ne se teste que sur device → validation au build ». Check-in manuel de secours existe dans `evenements/[id].tsx` |
| Présences jour J (tables SITE `sessions`/`registrations`) | `presences.tsx` + `attendanceService.ts:50-117` | À VÉRIFIER | Code complet (5 états), aucun faux succès (header l.9-10) ; pointage réel jour J jamais confirmé |
| Utilisateurs — annuaire, rôle audité, suspension, notes | `utilisateurs.tsx`, `utilisateurs/[id].tsx`, `adminUsersService.ts:118-150` | FINIE | Rôle tracé par trigger `admin_audit` (migration 0015) ; suspension horodatée+motif |
| Coachs — liste, promotion/rétrogradation, assignations | `coachs.tsx` (garde-fou rétrogradation l.69-85), `coachs/[id].tsx`, `preparation.tsx:91` | FINIE | Refus de rétrograder si assignations actives |
| Partenaires — valider/désactiver comptes, supervision leads | `partenaires.tsx` + `partnerService.ts:384-444` | FINIE | Statut protégé par trigger admin-only |
| Événements — liste/création/détail + inscriptions + check-in manuel | `evenements.tsx`, `evenements/nouveau.tsx`, `evenements/[id].tsx` | FINIE | Table partagée avec le site (header `evenements.tsx:4`) |
| Feature flags | `feature-flags.tsx` | FINIE | CRUD + switch, RLS `is_admin` |
| Maintenance — kill-switch + version min | `maintenance.tsx` | FINIE | S'applique via MaintenanceGate ; logique versions testée (`appConfigVersion.test.ts`) |
| Qualité data (anomalies sessions → suivre/résoudre) | `qualite-data.tsx` + `adminQualityService.ts` | FINIE | Migration 0016 |
| Analyse session — diagnostic + 3 relances serveur | `analyse-session/[id].tsx` + `adminSessionDiagnosticService.ts:109,124,142` | FINIE | Les 3 edge functions existent dans `supabase/functions/` |
| Support — file P0 + fil + réponse | `support.tsx`, `support/[id].tsx` | FINIE | Migration 0020 |
| Modération (signalements) | `moderation.tsx` | FINIE | Migration 0029 ; aucun masquage automatique (assumé, header l.6-7) |
| Analytique business | `analytique.tsx` + `adminAnalyticsService.ts` | FINIE | Dérivé, zéro schéma, marge anonymisée |
| Boîtiers (parc, santé, affectations) | `devices.tsx` + `adminDevicesService.ts:30-143` | FINIE | Tables `devices`/`device_assignments` |
| Médias par session (upload photo/vidéo) | `sessions-media.tsx` | À VÉRIFIER | Upload image-picker + Storage : dépendant du device, pas de preuve d'usage réel dans le repo |
| Ambassadeurs (activer/révoquer) | `ambassadeurs.tsx` | FINIE | Statut admin-only (RLS + trigger) |
| Belles routes (certification) | `routes-certification.tsx` | FINIE | Migration 0043 |
| Rapport B2B (éditeur + partage au partenaire) | `b2b-rapport.tsx` + `b2bReportService.ts:54-132` | FINIE | Compteurs snapshotés depuis `event_registrations` |
| Inspecteur circuit | `circuit.tsx` | FINIE | Lecture seule, heatmap historique |
| Préparation (pilotes attendus + KYC) | `preparation.tsx` | À FINIR | **Liste TOUS les `users role='pilot'`** (l.51-56), pas les inscrits de la prochaine session — son propre header (l.4-6) nomme le câblage `registrations` manquant |
| En cours (sessions en roulage) | `en-cours.tsx` | À FINIR | Fetch unique `telemetry_sessions status='recording'` (l.49-54) ; **Realtime non câblé** (header l.5-7 : « à câbler »), pas de rafraîchissement auto |

## 3. PRO (pilote professionnel) — 7 écrans

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Paddock Pro (dernière séance, régularité, circuits) | `app/(pro)/index.tsx` (`computeRegularity`, `fetchSessionLaps`, `loadPilotStats`) | FINIE | Données réelles own-row |
| Performance (agrégats descriptifs) | `performance.tsx` + `statsService.ts` | FINIE | Aucun classement/prédiction (doctrine respectée, header l.4-8) |
| Bibliothèque (recherche circuit/période) | `bibliotheque.tsx` (`fetchAllSessions`/`fetchUsedCircuits`) | FINIE | Tri chronologique, jamais « meilleure séance » |
| Média (consultation) | `media.tsx` (`listAllPilotMedia`) | FINIE | Lecture seule |
| Équipe (déclarer/révoquer entourage) | `equipe.tsx` + `proTeamService.ts` (migration `20260629003753`) | FINIE | Liste sans partage de données (assumé, header l.5-7) ; **partage télémétrie équipe : PAS COMMENCÉ** |
| Partage contrôlé (liens token, liste blanche métriques) | `partage.tsx` + `sharesService` | FINIE | `sharesService.test.ts` existe ; révocable d'un geste |
| Ambassadeur (candidature + bio) | `ambassadeur.tsx` + `ambassadorService.ts` | FINIE | Validation côté admin (`ambassadeurs.tsx`) |

## 4. Signal doctrine + risques transverses

- **Doctrine « partenaire/admin → web à terme » vs réalité** : les 3 espaces vivent entièrement dans l'app aujourd'hui — 44 écrans, ~13 100 lignes de routes — et sont **activement développés** (`point.tsx` modifié le 2026-07-17). Le routage racine est mono-rôle (`app/index.tsx:96-101`) : un compte partner ne voit QUE l'espace partenaire. Aucun début de bascule web dans le repo (INCONNU côté site). Décision fondateur à re-trancher : cet investissement app contredit le handoff refonte V3.
- **Couverture de tests quasi nulle sur ces 3 espaces** : seuls `socialPingsLogic.test.ts` (catégories/labels, pas le workflow d'upsert), `sharesService.test.ts` et `appConfigVersion.test.ts` touchent ce périmètre. **0 test** pour `partnerService`, `adminUsersService`, `coachAdminService`, `attendanceService`, `b2bReportService`, `eventsService`, `adminQualityService`, `adminControlTowerService`.
- **Risque n°1 immédiat** : le couple `point.tsx` ↔ file de validation `points-carte.tsx` repose sur la migration `20260716200000_coach_session_price_and_partner_pings.sql` (colonne `partner_id` + 4 policies RLS). Si elle n'est pas appliquée en prod, l'écran partenaire échoue silencieusement (les services loguent `console.warn` et rendent `[]`). À smoke-tester avec un vrai compte partner avant toute annonce.
- **Types Supabase périmés** : plusieurs services castent en `as never`/`Record<string, unknown>` (`socialPingsService.ts:310, 380`, `adminUsersService.ts:121`) — régénérer les types éliminerait cette zone aveugle du compilateur.

---

# PARTIE 4 — SÉCURITÉ

# Audit SÉCURITÉ — OXV (lecture seule, branch `feat/site-document-emails`)

Périmètre vérifié : 108 fichiers dans `supabase/migrations/` + 6 archivés (`supabase/_archive_pre_timestamp/`), 14 edge functions, `src/`, `app/`, CI. **262 `CREATE POLICY` sur 52 fichiers de migrations** (grep). Limite : l'état RÉEL de la base prod (fouvuqkdxarjpjbqnsjq) n'est pas interrogeable depuis le repo — tout ce qui est « appliqué en prod » repose sur les en-têtes de migrations et `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql` (export du 2026-05-24, « 80+ policies sur 20 tables »).

## 1. RLS — couverture par table

**Aucune table créée dans le repo sans `ENABLE ROW LEVEL SECURITY`.** Croisement exhaustif `CREATE TABLE` (58 tables app) vs `ENABLE ROW LEVEL SECURITY` : 58/58 couvertes. Seul trou historique : `notif_throttle_log`, créée sans RLS puis corrigée (`supabase/migrations/20260530110705_enable_rls_on_notif_throttle_log.sql:1`).

| Domaine | Tables (migrations) | Statut | Manque/note |
|---|---|---|---|
| Cœur pilote (archive 0001-0006) | users, telemetry_sessions, telemetry_frames, laps, circuits, weather_snapshots | FINIE | RLS + policies own-row (`_archive_pre_timestamp/0003_telemetry_sessions.sql:104-145`) ; doublons users nettoyés (`20260525111333_security_hardening.sql:106-121`) |
| Analyses app | app_session_analyses, app_segment_analyses, app_progression_shares, session_intentions | FINIE | Fuite `USING(true)` sur shares corrigée par RPC SECURITY DEFINER token-only (`20260614023457_secure_progression_share_read.sql:15-54`) |
| Coach | coach_pilots, coach_annotations, coach_permissions, coach_messages, coach_roulages, coach_invoices (+11 tables coach_*) | FINIE | Voir cloisonnement §2 |
| Partenaire | partner_accounts, partner_offers, partner_leads | FINIE | Leads = consentement explicite requis (`0017_partner_marketplace_foundation.sql:103-108`) |
| Admin/qualité | devices, device_assignments, data_quality_reports, moderation_reports, support_* | FINIE | Lecture pilote scoped ajoutée (`20260630010000_device_pilot_scoped_read.sql`) |
| Tables site (hors repo app) | admin_audit, articles, documents, email_log, payments, registrations, sessions, vehicles, pricing, media… | À VÉRIFIER | Couvertes par doc 06 + bascule 67 policies `public`→`authenticated` (`20260530111333_rls_policies_public_to_authenticated.sql:4-7`) ; état courant invérifiable depuis ce repo |
| Realtime (live coach) | realtime.messages | FINIE | 4 policies topic-scopées, gated consentement `live_sharing_at` (`20260711181903_live_realtime_authorization.sql:6-53`) |

**Cloisonnement rôles en base (§2)** — vérifié dans les policies :
- **Pilote** : own-row partout (`auth.uid() = user_id/pilot_id`).
- **Coach** : accès GRADUÉ et CONSENTI — `is_coach_of` exige `pilot_consent_at IS NOT NULL` ; frames + métriques virage exigent `is_detailed_coach_of` (niveau `lecture_detaillee`/`programme`, `0014_coach_access_level_graduated.sql:19-51`). Messagerie coach↔pilote conditionnée au binôme actif consenti (`20260711173005_coach_messages_table.sql:21-33`).
- **Partenaire** : lit uniquement SES leads, insertion pilote avec `consent_contact = true` (`0017:101-108`).
- **Admin** : `is_admin()` = `role='admin' OR is_admin=true` (flag honoré, `20260617000000_0041_is_admin_honor_flag.sql:25-35`). **Anti-élévation** : trigger bloquant l'auto-modification de `users.role`/`kyc_status` (`20260620213000_0042_guard_users_role_kyc_and_uuid_searchpath.sql:37-68`) — fermait une vraie faille d'auto-promotion admin.

## 2. Secrets dans le code

| Vérification | Résultat | Preuve |
|---|---|---|
| Clés en dur (`sk_`, `service_role`, `eyJhbGciOi`, `api_key`) dans `src/`+`app/` | **Aucune** — 8 hits, tous commentaires/tests | grep : seuls commentaires (`src/services/accountService.ts:7`, etc.) |
| JWT anon en dur repo entier | **PÉRIMÉ — 1 hit depuis le 18/07/2026** (voir note) | grep repo |

> **Note du 27/07/2026 — la ligne ci-dessus était vraie à sa rédaction, elle ne
> l'est plus.** `supabase/migrations/20260718133742_fix_relay_validate_inscription_jwt.sql:35`
> contient un `eyJhbGciOi`, arrivé avec la reconstitution des 94 migrations.
>
> **La situation reste saine** : il s'agit de la clé **anon**, publique par
> construction — elle est destinée à être embarquée dans les clients. Aucune clé
> `service_role` n'est en dur, ce que la ligne précédente vérifie séparément.
>
> Ce qui est corrigé ici n'est donc pas un risque mais une AFFIRMATION FAUSSE.
> Sur un dépôt public, un tableau de sécurité qui annonce « 0 hit » là où il y en
> a un perd sa valeur de preuve, même quand le hit est inoffensif.
| `.env` committé | Non — seul `.env.example` tracké (placeholders) | `git ls-files` |
| Client app | anon key via `process.env.EXPO_PUBLIC_*`, throw si absent | `src/lib/supabase.ts:15-22` |
| Edge functions | Secrets via `Deno.env.get` uniquement (RESEND, OpenAI, SERVICE_ROLE, INVOKE_SECRET) ; triggers pg_net lisent le secret dans le **Vault** | `send-document-status/index.ts:81-94` ; `20260525150006_0025_notif_triggers_use_vault.sql` |
| URL projet `fouvuqkdxarjpjbqnsjq.supabase.co` en clair | Oui, dans docs/roadmap (14 hits) — non secret (l'anon key ne l'est pas non plus), acceptable | `docs/architecture/04_SUPABASE_CONNECTION_GUIDE.md:33` |

Statut : **FINIE** (hygiène secrets côté repo). Durcissement fonctions : `REVOKE EXECUTE` + `search_path` fixé sur ~12 fonctions (`20260525111333:43-81`, complété `20260615190000`, `20260620213000`).

## 3. Auth — flux réel

- **Login** : email + mot de passe via Supabase Auth (`app/(auth)/login.tsx:26`) ; **aucun mot de passe stocké** — seuls les tokens de session, chiffrés via `expo-secure-store` (`src/lib/supabase.ts:24-36`). Statut : **FINIE**.
- **Lier par code (M3)** : code 8 caractères, 10 min, usage unique → edge `pair-app` (`redeem` → `verifyOtp magiclink`), `verify_jwt=false` car pré-auth, anti-brute-force annoncé 10 req/min/IP (`src/services/pairingService.ts:4-14`, `app/(auth)/lier.tsx`). **À VÉRIFIER** : le source de `pair-app` n'est **pas dans ce repo** (absent de `supabase/functions/`) — rate-limit et consommation du code invérifiables ici (côté site).
- **Gateway edge** : `verify_jwt=true` pour les fonctions appelées par l'app, `false` pour les triggers pg_net avec défense dans le handler (`supabase/config.toml:3-33`). Voir risque n°4 sur le fail-open.

## 4. Storage — buckets et policies

| Bucket | Public | Policies | Statut |
|---|---|---|---|
| `avatars` | oui (intentionnel) | upload/update/delete own ; policy de listing retirée | FINIE (`_archive/0001:95-121`, `20260525111333:91`) |
| `telemetry_raw` | non | 4 policies own-folder ; legacy `telemetry-raw` (tiret) supprimé | FINIE (`20260524182915:9-54`, `20260525111333:99-101`) |
| `pilot-media` | non | owner write (dossier `{uid}/`), SELECT owner OR `is_coach_of` OR admin — URLs signées uniquement | FINIE (`0011_pilot_media_bucket.sql:14-56`) |
| `session-media` | non | SELECT owner/ami/coach/admin, écriture admin only — mais **bucket à créer manuellement au Dashboard** | À VÉRIFIER (`20260526160000:126-135` : « on ne crée PAS le bucket dans cette migration ») |

## 5. Données sensibles

- **IBAN** : aucune colonne `iban/bic` en base (grep = 0 dans migrations) — confirmé par `CONNEXIONS_ET_AUTOMATISATIONS.md:78`. **MAIS** `coach_profiles.payment_link` (texte libre, `20260704150000:14`) est saisi avec le placeholder « IBAN, lien de paiement… » (`app/(coach)/facturation-identite.tsx:205`) et `coach_profiles` porte une policy prod `coach_profiles_read_published USING (is_published=true)` (`0007:13-15`) → **un IBAN saisi là est lisible par TOUT utilisateur authentifié**. Risque n°3.
- **Données médicales** : `blood_type`/`medical_notes` supprimées par migration (`_archive/0002_remove_medical_data.sql:20-23`, appliquée). **Contradiction** : `purge-deleted-accounts/index.ts:144-145` fait `UPDATE users SET blood_type: null, medical_notes: null` — si les colonnes sont vraiment tombées en prod, cet UPDATE échoue (PostgREST : colonne inconnue) ; si elles existent encore, des données de santé subsistent en prod. Risque n°2, tranchant à vérifier en base.
- **PII clients privatisation** : `sessions.private_client_name/contact` — fuite anon fermée (vue `sessions_public` sans PII ni lignes privées, `20260615183000:15-37`) mais **tout pilote authentifié lit encore ces colonnes** — « résidu assumé » documenté (`20260615175209:8-11`). Risque n°1.

## 6. RGPD

| Droit | Implémentation | Statut |
|---|---|---|
| Export (art. 20) | `dataExportService` + share sheet, 3 points d'entrée (`app/(app)/consentements.tsx:166`, `donnees-securite.tsx:119`, `settings.tsx:340`) | À VÉRIFIER (jamais éprouvé utilisateur réel documenté) |
| Effacement (art. 17) | Demande J+30 (`src/services/accountService.ts:29-50`, vérifie l'écriture effective) + purge serveur : auth.users, scrub PII, storage `telemetry_raw`+`pilot-media` (`purge-deleted-accounts/index.ts:122-124`), Bearer Vault fail-closed (`:81`) | À VÉRIFIER (cron pg_cron à configurer manuellement, `README.md:63`) |
| Consentements | Centre unifié PR-38 : IA débrief (opt-out), IA coach (opt-in), audience (opt-out), retrait aussi simple que l'octroi (`consentements.tsx:1-66`) ; pacte horodaté (`20260524215816_0010_users_pact_acceptance.sql`) | FINIE |
| Opt-in Pavillon | `pavilion_name_optin` défaut **false** + horodatage auto par trigger (`20260717000000_profil_pavillon.sql:30-51`), appliquée prod 2026-07-17 | FINIE côté base — chemin de lecture TV côté site **PAS COMMENCÉ** (noté `:3-6`) |

## 7. Tests RLS

`src/__tests__/rls/` : **17 fichiers de test + setup, 85 cas** (grep `it(`), couvrant coach (annotations, sessions, accès gradué, IA, cycles), pilote (friendships 11 cas, notes, setups, signatures), partner, admin, events, B2B, support, modération, **matrice de rôles** (`roleMatrixRLS.test.ts`). Exécution sur projet Supabase de test séparé via `TEST_SUPABASE_URL`/`TEST_SUPABASE_SERVICE_KEY` (`setup.ts:22-27`). **MAIS** : le job CI `rls` sort **vert avec un simple notice si les secrets sont absents** (`.github/workflows/check.yml:85-91`). Impossible de vérifier depuis le repo si les 3 secrets GitHub sont provisionnés → l'exécution effective des 85 tests est **INCONNUE**. Statut : code FINI, exécution À VÉRIFIER.

## RISQUES RESTANTS (classés)

1. **PII interne — `sessions.private_client_name/contact` lisibles par tout compte authentifié** (`20260615175209:15-17`, `USING (true)`). Résidu documenté ; correctif connu (REVOKE colonne + RPC admin) jamais appliqué (`_pending_site_coordination/README.md`, draft SUPERSEDED).
2. **Données de santé — incohérence purge vs schéma** : `purge-deleted-accounts` scrub `blood_type`/`medical_notes` censées supprimées en 0002. Soit colonnes médicales encore en prod (RGPD), soit purge cassée au runtime. Vérifier en base + retirer ces 2 champs de l'UPDATE.
3. **IBAN coach potentiellement world-readable (authenticated)** via `coach_profiles.payment_link` + policy `read_published`. Prévoir colonne dédiée à RLS stricte (le doc `CONNEXIONS_ET_AUTOMATISATIONS.md:101` le prescrivait déjà).
4. **Edge functions fail-open** : les 4 `notify-*` laissent passer sans auth si `EDGE_FUNCTIONS_INVOKE_SECRET` absent (`notify-pilot-coach-annotated/index.ts:53-60`) ; `cron-analyze-pending-sessions` est **totalement ouvert si `CRON_TOKEN` non défini** (`index.ts:63-70`, verify_jwt=false, écrit via service_role) — et l'exemple pg_cron du header n'envoie même pas le token (`:16-20`). Passer au fail-closed (pattern `send-document-status:82`).
5. **Tests RLS peut-être jamais exécutés** : job CI vert trompeur sans secrets ; 85 cas dormants tant que la branche de test n'est pas provisionnée.
6. **`pair-app` hors repo** : porte d'entrée d'authentification (émission de magiclink) dont le code, le rate-limit et l'expiration ne sont pas auditables ici.
7. **Bucket `session-media`** : policies présentes, création du bucket manuelle au Dashboard — existence/flags prod invérifiables depuis le repo.
8. **Écart repo ↔ prod** : plusieurs migrations appliquées « via MCP » ou SQL Editor hors `schema_migrations` (`20260615183000:11-12`) ; sans accès DB, la conformité prod = ce repo reste une hypothèse. Un dump `pg_policies` frais (doc 06 date du 2026-05-24) est recommandé.

---

# PARTIE 5 — FIABILITÉ

# Audit FIABILITÉ — OXV app (branche `feat/site-document-emails`, 2026-07-18)

Méthode : lecture seule du repo, preuves = chemins exacts + commandes. Jest exécuté réellement (`node node_modules/jest/bin/jest.js`).

---

## 1. Chaîne de capture post-durcissement

| Fonctionnalité | Écran(s)/fichier(s) | Statut | Manque/note |
|---|---|---|---|
| File de sync fichier local-first (1 op = 1 fichier JSON, FIFO strict, écriture atomique .tmp→rename) | `src/services/captureSyncQueue.ts` (1 209 l.) | À VÉRIFIER | 52 tests unitaires (`src/services/__tests__/captureSyncQueue.test.ts`, 1 342 l.) mais jamais éprouvée sur device en conditions piste |
| Idempotence trames : UPSERT onConflict `(session_id, elapsed_ms)` ignoreDuplicates + garde 42P10 → repli insert, ré-armé sur 23505 | `captureSyncQueue.ts:591-601`, `writeIdempotent` :538-567 | À VÉRIFIER | Migrations UNIQUE **appliquées en prod le 2026-07-16** (commit `5a0e2f0` : `20260715120000_valencia_telemetry_frames_unique.sql` + `20260716120000_valencia_laps_unique.sql`, audit préalable 53 trames/0 doublon). Jamais exercée avec un vrai flux 25 Hz |
| Idempotence tours : UPSERT `(session_id, lap_number)` | `captureSyncQueue.ts:614-624` | À VÉRIFIER | Idem — corrige le doublement historique des tours au rejeu (commentaire :606-612) |
| Classification erreurs en liste blanche (DROP seulement SQLSTATE 22/23 sauf 23503/23505, 42, PGRST202/205 ; inconnu = transitoire ; `create_session` jamais droppée) | `captureSyncQueue.ts:439-491` | À VÉRIFIER | Testée unitairement ; quarantaine `capture-queue/quarantine/` au lieu de suppression (:315-325) |
| Drain coalescé (déclencheur concurrent rejoué, pas avalé) + arrêt au 1er échec réseau | `processQueue` :840-862, `drainOnce` :749-813 | À VÉRIFIER | `ubx_upload` = op feuille sautée (10 tentatives max puis quarantaine, :780-801) |
| Reprise au boot + retour réseau | `app/_layout.tsx:48` (`resumeUnsyncedCaptures`), `src/lib/netinfo.ts:36-43` (`processQueue` sur reconnexion NetInfo) | À VÉRIFIER | Branché aux 3 déclencheurs (boot, réseau, démarrage capture `captureSessionService.ts:316`) |
| Reconnexion BLE illimitée pendant capture (backoff 2s→30s plafonné, jamais d'abandon en mode capture) | `src/ble/reconnectPolicy.ts` (pur, 8 tests), armée à `captureSessionService.ts:404` (`setUnlimitedReconnect(true)`) | À VÉRIFIER | Statuts `recording/interrupted/lost` + timeout long 15 min (`LONG_INTERRUPT_TIMEOUT_MS` :132) + trou horodaté (`logLinkGap` :497-502). Jamais testé avec vraie coupure radio |
| Keep-awake pendant capture | `captureSessionService.ts:104-120` (tag `oxv-capture`), armé :406, libéré :485/544/729/823 ; garde de génération multi-captures :530-556 | À VÉRIFIER | Mocké en test (`captureSessionService.test.ts:59-64`) ; l'effet réel (écran allumé 20 min, radio non coupée) exige le device |
| Rétention .ubx : GC par âge 7 j, 3 verrous (file non vide / référencé / âge illisible ⇒ conserver) | `gcOldCaptures` :981-1006 | À VÉRIFIER | Testé unitairement (tests :1053-1113) |
| Réimport .ubx → frames (anti-join sur `itow_ms`, recalage d'ancre, allocation sans collision) | `reimportUbxToFrames` :1116-1209 | À VÉRIFIER | Outil manuel de secours ; refus explicite si trames legacy sans itow_ms (:1145-1152) |
| Ligne d'arrivée Valencia + Haute Saintonge en base | commit `5a0e2f0` : Ricardo Tormo créé (porte 39.483568/-0.631076, cap 55,2°), Haute Saintonge recalibrée (l'ancienne ligne était à 231 m) | À VÉRIFIER | SQL **exécuté en prod** (contrairement à la note MEMORY antérieure). Reste : franchissement de porte réel |

**Reste à valider TERRAIN (smoke test, `docs/SMOKE_TEST_DEVICE.md:340-365`)** : (1) 0 doublon `(session_id, elapsed_ms)` après une vraie séance ; (2) détection de tours par porte sur circuit réel (la voie des stands exclue) ; (3) débit ≥ 20 Hz à l'armement ; (4) keep-awake 20 min sans coupure radio ; (5) parcours survie hors-ligne complet (mode avion → capture → retour réseau → drain). Attention : `debug-capture.tsx` est `__DEV__` only (ligne 6) — inutilisable sur un build preview.

**Verdict global chaîne de capture : À VÉRIFIER** — code complet, durci par vérif adversariale (17 findings corrigés, commits `b6c1ee2`/`5cb86ba`/`3c89996`), prod migrée, **zéro passage terrain**.

---

## 2. Tests — comptes réels

Commande : `node node_modules/jest/bin/jest.js --listTests | wc -l` → **98 suites**. Run complet (34,8 s, exit 0) :

```
Test Suites: 17 skipped, 81 passed, 81 of 98 total
Tests:       85 skipped, 837 passed, 922 total
Snapshots:   1 passed
```

- Les **17 suites skippées = les 17 tests RLS** (`src/__tests__/rls/*.test.ts`), gated par `RLS_TEST_ENABLED ? describe : describe.skip` (ex. `coachSessionsRLS.test.ts:26`) — la sécurité RLS n'est **pas vérifiée en CI par défaut**.
- Couverture par zone : **57 fichiers de test pour 137 fichiers dans `src/services/`** (~42 %), parser UBX, circuit/calibration, trackviz, utils, `reconnectPolicy` (pur), gardes doctrine (`doctrineGuard.test.ts`, `silence.test.ts`).
- **Non couvert** : les **173 écrans** de `app/` (0 test d'écran, 1 seul snapshot), les **5 stores Zustand** (0 test), `bluetoothService.ts` lui-même (seule sa politique pure est testée), `captureMode.ts` (écrivain .ubx local), les hooks (1 seul : `useDetailLevel`).

---

## 3. Gestion d'erreurs

| Patron | Preuve | Constat |
|---|---|---|
| `StateWrapper` 5 états (nominal/loading/empty/offline/error + retry) | `src/ui/StateWrapper.tsx` ; **67/173 écrans** l'utilisent (217 occurrences) | Adoption forte côté coach/admin/partner, faible côté pilote |
| ErrorBoundary global + Sentry | `src/components/ErrorBoundary.tsx:35-43`, monté `app/_layout.tsx` | Couvre les crashs de rendu uniquement |
| Écrans pilote à états manuels | `bilan.tsx:102-103,367,376` (loading+error OK) ; `debrief.tsx:56` (loading seul) | Hétérogène |
| **Avalement silencieux** | **72 occurrences** de `catch {}` / `.catch(() => undefined)` dans 41 fichiers (hors tests). Ex. `data-lab.tsx:635,655,673,689` : tous les fetchs avalés, **aucun état d'erreur** — écran partiellement vide sans explication ; idem `carnet.tsx:338` | Zones qui échouent en silence : oui, principalement Data Lab, Carnet, et la plupart des best-effort services |
| Erreurs services jamais remontées | `captureException` appelé **1 seule fois** dans tout le code (ErrorBoundary) — `grep -rn captureException` | 272 `console.warn` + 16 `console.error` dans `src/` restent invisibles hors debugger |

---

## 4. Offline

| Capacité | Fichier(s) | Statut |
|---|---|---|
| Write-path capture complet hors-ligne (session, intention, trames, tours, clôture, upload) | `captureSyncQueue.ts` + `captureSessionService.ts:270-316` (démarrage sans réseau garanti) | À VÉRIFIER (cf. §1) |
| 6 actions unitaires différées (pacte, CGU, notif lue, marqueur, niveau) | `src/services/offlineQueue.ts:21-27` (MMKV) | À FINIR — **5 tentatives puis perte définitive, pas de DLQ** (assumé :13-15) |
| Détection réseau + flush auto au retour | `src/lib/netinfo.ts` (NetInfo → 2 files) | FINIE (logique) |
| Bannière hors-ligne globale | `app/_layout.tsx:162` + `src/components/OfflineBanner.tsx` | FINIE |
| **Lectures hors-ligne** | Cache MMKV TTL : **utilisé uniquement par `circuitsService.ts`** (4 appels `cacheGet/cacheSet`) ; WatermelonDB **absent** de `package.json` malgré CLAUDE.md | À FINIR — quasi tous les écrans lisent Supabase en direct : hors-ligne = écrans vides/spinners, l'état `offline` de StateWrapper n'a presque jamais de « dernière lecture » à montrer |

---

## 5. Monitoring

| Outil | Preuve | Statut |
|---|---|---|
| Sentry | `src/lib/sentry.ts` : init conditionnel DSN, no-op en dev ; `initSentry()` appelé `app/_layout.tsx:27`. **`EXPO_PUBLIC_SENTRY_DSN` absent de `eas.json`** (seul `PLAUSIBLE_DOMAIN` y figure :23,36). Plugin sourcemaps **retiré** en sem 14 (commentaire sentry.ts:9-15) | À FINIR — câblé mais **inactif en build** tant que le DSN n'est pas fourni (secret EAS : INCONNU) ; sans plugin, pas de sourcemaps → stacks illisibles |
| Plausible | `src/services/analyticsService.ts` (opt-out MMKV, zéro PII), domaine `oxvehicle.fr` dans `eas.json` preview+prod | FINIE (logique) — mais **7 événements seulement** (`analyticsEvents.ts:24-40`), 6 fichiers émetteurs. Aucun événement d'échec technique (le `capture_echouee` existe mais un seul call site) |
| Logs | 272 `console.warn` `[OXV]…` | Locaux uniquement, aucun transport distant |

---

## 6. Performance

| Sujet | Preuve | Constat |
|---|---|---|
| Virtualisation de listes | `grep FlatList app/` → **0 écran** ; 35 écrans `ScrollView` ; seul `src/components/motion/Stagger.tsx` importe FlatList | Risque : toute liste non bornée rendue en `.map()` monte intégralement (ex. `bilan.tsx` 1 428 l., 13 `.map(`) |
| Pagination frames (plafond PostgREST 1000) | Paginé correctement : `analyzeSessionService.ts:404`, `captureSyncQueue.ts:1057`, `dataExportService.ts:171`, `sessionTelemetryService.ts:70` (le commentaire :55 documente le piège) | OK sur les chemins critiques |
| Limites assumées non paginées | `coachService.ts:54` et `cornerDeepDiveService.ts:74` : `.limit(1000)` sur `telemetry_frames` (échantillon voulu) ; `loadLapFrames` `.limit(2000)` :143 | Acceptable (échantillonnage), mais un tour > 2000 trames (> 80 s à 25 Hz) serait tronqué |
| Liste sessions | `sessionsService.ts:203` : `limit ?? 50` avec range | OK |
| Animations | 49 sites `useNativeDriver: true` vs **19 `useNativeDriver: false`** ; `react-native-reanimated` absent | Les 19 animations JS-thread (layout/height) peuvent saccader pendant un drain réseau lourd |
| Flush capture | Lots bornés `FLUSH_EVERY_FRAMES=50` / 4 s, backlog-only anti-effondrement (`captureSessionService.ts:560+`) | Conçu pour 25 Hz ; non mesuré sur device |

---

## Risques classés

1. **CRITIQUE — Zéro validation terrain de la chaîne de capture.** Tout le durcissement Valencia (file, idempotence, reconnexion, keep-awake, porte de détection) n'a jamais vu un RaceBox réel sur circuit. Un défaut de débit BLE, de porte mal calée ou de keep-awake iOS ne sera découvert que le jour J. Checklist prête : `docs/SMOKE_TEST_DEVICE.md:340-365`.
2. **ÉLEVÉ — Monitoring aveugle en prod.** Sentry sans DSN dans `eas.json`, `captureException` appelé une seule fois, 272 warns locaux : un échec de sync sur le device d'un pilote est indétectable à distance. Les quarantaines (`capture-queue/quarantine/`) ne remontent nulle part.
3. **ÉLEVÉ — 17 suites RLS skippées par défaut.** La matrice de sécurité (922 − 837 = 85 tests) ne tourne pas sans `RLS_TEST_ENABLED` ; aucune preuve dans le repo d'une exécution récente.
4. **MOYEN — Échecs silencieux côté pilote.** 72 catch muets ; Data Lab et Carnet n'ont pas d'état d'erreur : un échec réseau y ressemble à « pas de données ».
5. **MOYEN — Lectures online-only.** Sans cache généralisé (WatermelonDB jamais installé, cache MMKV limité aux circuits), l'app au paddock sans 4G est essentiellement vide hors capture.
6. **FAIBLE — offlineQueue perd après 5 tentatives** (assumé, actions optionnelles) ; **FAIBLE — listes non virtualisées** (volumes actuels faibles) ; **FAIBLE — 19 animations non natives**.

---

# PARTIE 6 — CONNEXIONS EXTERNES & INFRASTRUCTURE

# Audit — Connexions externes & infra (repo `oxv-app`, branche `feat/site-document-emails`)

Méthode : grep exhaustif sur `src/` + `app/` + `supabase/` (hors `__tests__`), lecture des 14 edge functions du repo, croisement avec l'état RÉEL de production via MCP Supabase (`list_edge_functions`, `list_tables`, projet `fouvuqkdxarjpjbqnsjq`).

---

## 1. Supabase

### 1.1 Tables utilisées par l'app

**68 tables/vues distinctes** référencées par `.from('…')` dans `src/` + `app/` hors tests (commande : `grep -rho "\.from('[a-z_]*'" src app --exclude-dir=__tests__ | sort -u | wc -l` → 68). Croisement avec la prod (`list_tables`, ~100 tables public) : **toutes existent** — `coach_pilots_view` est une vue (absente de `list_tables`, normal).

Top usages (occurrences tous fichiers) : `telemetry_sessions` 68, `users` 59, `app_session_analyses` 24, `coach_annotations` 23, `pilot_friendships` 22, `pilot_development_cycles` 19, `telemetry_frames` 17, `events` 16, `support_tickets` 15…

| Point | Preuve | Statut | Manque/note |
|---|---|---|---|
| 68 tables branchées, toutes présentes en prod | grep ci-dessus + `list_tables` MCP | FINIE (côté câblage) | — |
| `events` / `event_registrations` encore utilisées par l'app | 16 + 13 occurrences ; commentaire prod sur la table : « DEPRECATED — A1 verrouille (2026-06-30). Canonique = public.sessions » | À FINIR | Migration code app vers `sessions`/`registrations` planifiée (`docs/site/PR_SITE_DEPRECATE_EVENTS.md`) mais pas faite |
| RPC appelées | `log_coach_view` (src/services/coachService.ts:271, pilotNotesService.ts:128, pilotSignatureSnapshotService.ts:178), `get_shared_progression` (sharesService.ts:167), `coach_ai_consent` (app/(coach)/assistant.tsx:370) | FINIE | — |
| Migration en quarantaine | `supabase/_pending_site_coordination/20260614121000_sessions_mask_private_client_pii.sql` — README la marque **SUPERSEDED, ne pas appliquer** | À FINIR | Fichier à supprimer par son auteur (dit le README lui-même) |

### 1.2 Edge functions — repo (14) vs production (32)

**Les 14 fonctions du repo sont toutes implémentées** (71 à 390 lignes, aucune coquille vide) et **toutes déployées ACTIVE en prod** :

| Fonction (repo) | Lignes | Rôle | Secrets consommés | Statut |
|---|---|---|---|---|
| `compute-session-insights` | 166 | calcule/upsert `session_insights` (seule voie d'écriture, RLS service_role) | SUPABASE_URL, SERVICE_ROLE | À VÉRIFIER (v3 divergente en prod, cf. risques) |
| `cron-analyze-pending-sessions` | 200 | rattrapage analyses (pg_cron horaire) | + `CRON_TOKEN` **optionnel** (index.ts:64-70 : garde sautée si non défini) | À VÉRIFIER |
| `generate-debrief-ai` | 390 | debrief J+1 OpenAI, payload non nominatif, lexique interdit + retry + refus 422 | + `OPENAI_API_KEY` | FINIE (garde-fou doctrinal vérifié dans le code) |
| `coach-ai-draft` | 230 | brouillon IA coach : gate `coach_ai_consent` fail-closed, RLS via JWT coach, filtre verbes interdits, audit `admin_audit` | + `OPENAI_API_KEY`, ANON_KEY | FINIE |
| `coach-ai-validate` | 136 | brouillon → annotation validée | ANON_KEY, SERVICE_ROLE | À VÉRIFIER |
| `purge-deleted-accounts` | 173 | effacement RGPD anonymiser-et-purger | `EDGE_FUNCTIONS_INVOKE_SECRET` — **fail-closed** (index.ts:81) | À VÉRIFIER — en-tête dit « DRAFT — À VALIDER JURIDIQUEMENT… AVANT tout déploiement » or elle est **déployée ACTIVE v4** en prod (dormante sans secret) |
| `send-coach-invitation` | 126 | email Resend invitation coach | `RESEND_API_KEY` | FINIE |
| `send-document-status` | 147 | email Resend validation/refus document (branche courante) | `EDGE_FUNCTIONS_INVOKE_SECRET` **fail-closed** (503 si absent, index.ts:81-83) + `RESEND_API_KEY` ; trigger `20260630160000_document_status_email_trigger.sql` | À VÉRIFIER (jamais éprouvée bout-en-bout ? INCONNU) |
| `notify-coach-session-analyzed` | 169 | push Expo (trigger pg_net) | secret — **fail-open** : garde désactivée + warn si secret absent (index.ts:49) | À VÉRIFIER |
| `notify-pilot-coach-annotated` | 170 | idem | idem fail-open (index.ts:59) | À VÉRIFIER |
| `notify-pilot-friend-request` / `-accepted` | 147/133 | idem | idem fail-open (:51 chacun) | À VÉRIFIER |
| `notify-pilot-coach-assigned` | 77 | push pilote « coach assigné » | **AUCUNE garde interne** — repose 100 % sur le gateway | voir RISQUE MAJEUR §5 |
| `notify-coach-consent-received` | 71 | push coach « consentement reçu » | **AUCUNE garde interne** | voir RISQUE MAJEUR §5 |

**18 fonctions déployées en prod SANS source dans ce repo** (côté site/autre repo) : `ritual_dispatcher`, `ritual_dryrun`, `resend_webhook`, `validate-inscription`, `compute-session-insights-v3`, `detect-circuit-corners`, `send-contact-ack`, `admin-review-inscription`, `geocode`, `send-booking-confirmation`, `send-payment-confirmed`, `notify-admin-lead`, `pair-app`, `generate-invoice`, `eligibility-reminders`, `feedback-request`, `newsletter-push`, `send-application-ack`. L'app **invoque** `pair-app` (src/services/pairingService.ts:33) dont la source n'est pas ici → dérive de version possible, INCONNU sur son contenu réel.

### 1.3 Realtime

2 topics **privés** (`private: true`, autorisation par RLS `realtime.messages`, migration `20260711181903_live_realtime_authorization.sql`) : `live:roster:<coachId>` et `live:session:<sessionId>` (src/services/liveSessionService.ts:30, 61, 128, 149). Consommateurs : `app/(coach)/en-direct.tsx`, `src/hooks/useLiveRoster.ts`, `usePilotLive.ts`, `liveRelayRunner.ts`. Statut : **À VÉRIFIER** (jamais prouvé multi-devices terrain dans ce repo).

### 1.4 Storage — 5 buckets

| Bucket | Fichier | Usage |
|---|---|---|
| `telemetry_raw` | src/services/telemetryStorage.ts:20 | upload .ubx `<userId>/<sessionId>.ubx` |
| `session-media` | src/services/sessionMediaService.ts:59 | photos/vidéos session |
| `pilot-media` | src/services/pilotMediaService.ts:26 | médias pilote, URLs signées |
| `coach-media` | src/services/coachMediaService.ts:22 | médias coach |
| `coach-audio` | src/services/coachAudioService.ts:19 | audio coach |

---

## 2. APIs tierces — URL par URL

| Service | URL exacte | Fichier:ligne | Clé/env | Risque |
|---|---|---|---|---|
| Open-Meteo | `https://api.open-meteo.com/v1/forecast` | src/services/weatherService.ts:12 | aucune (gratuit) | faible ; cache mémoire 10 min ; consommé par carnet/conditions/preparation.tsx |
| Overpass/OSM | `https://overpass-api.de/api/interpreter` | src/services/routing/scenicPoiService.ts:11 | aucune | fair-use instance publique (self-host « phase 2 » en commentaire) ; consommé par app/(app)/creer-route.tsx:154 |
| OSM API | `https://api.openstreetmap.org/api/0.6/way/{id}/full.json` | src/circuit/circuitGenerator.ts:93 | aucune | faible ; consommé par creer-trace.tsx:63 |
| GraphHopper | `https://graphhopper.com/api/1/route` (POST + custom_model) | src/services/routing/scenicRouteService.ts:154 | `EXPO_PUBLIC_GRAPHHOPPER_KEY` — **vide = feature désactivée** (retour null, :179-182) | **JAMAIS validé avec une vraie clé** — le commentaire :18-20 le dit : « à confirmer avec une vraie clé ». Statut : À VÉRIFIER |
| Kurviger (fallback) | `https://api.kurviger.de/v1/route` | scenicRouteService.ts:121 | `EXPO_PUBLIC_KURVIGER_KEY` — **absent de .env.example** (0 occurrence) | doc env incomplète ; jamais testé |
| Plausible | `https://plausible.io/api/event` | src/services/analyticsService.ts:25 | `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` (inactif si vide) + opt-out MMKV | faible ; zéro PII vérifié dans le code ; activé en preview/prod via eas.json |
| OpenAI | `https://api.openai.com/v1/chat/completions`, modèle **gpt-4o-mini hardcodé** | coach-ai-draft/index.ts:24-25, generate-debrief-ai/index.ts:43-45 | `OPENAI_API_KEY` (secret edge, 500 si absent) | gardes doctrinales serveur vérifiées (lexique + retry + 422) ; `.env.example` dit `OPENAI_MODEL=gpt-4o` → **jamais lu par le code**, doc trompeuse |
| Resend | `https://api.resend.com/emails` | send-coach-invitation/index.ts:22, send-document-status/index.ts:18 | `RESEND_API_KEY` | from hardcodé `OXV <contact@oxvehicle.fr>` (send-document-status:19) — `RESEND_FROM_EMAIL/NAME` de .env.example **morts** |
| Expo Push | `https://exp.host/--/api/v2/push/send` | 6 fonctions notify-* | aucune clé (token par user) | cf. risque verify_jwt §5 |
| Sentry | DSN via `EXPO_PUBLIC_SENTRY_DSN` | src/lib/sentry.ts:27 | no-op si `__DEV__` ou DSN vide | plugin config retiré (conflit Gradle sem 14) → **pas d'upload de sourcemaps** — assumé dans le commentaire :9-16 |
| Google Maps Android | clé injectée au build | app.config.js:26-37 | `GOOGLE_MAPS_ANDROID_KEY` (EAS secret ou .env) | sans clé : cartes Android grises (fallback documenté) ; iOS = Apple Maps sans clé |

Aucun autre `fetch(` externe trouvé (grep https:// exhaustif sur src/app/supabase/functions). Pas de Stripe/PayPal côté app : le paiement coach est un simple `Linking.openURL(invoice.paymentLink)` (app/(app)/mon-coach.tsx:511) — lien fourni par le coach, **aucun encaissement in-app**.

---

## 3. EAS / Expo

| Point | Preuve | Statut |
|---|---|---|
| 3 profils build : development (dev-client, apk), preview (internal, apk), production (app-bundle) | eas.json | FINIE |
| Seule env EAS : `EXPO_PUBLIC_PLAUSIBLE_DOMAIN=oxvehicle.fr` (preview + production) | eas.json build.preview.env / build.production.env | FINIE — **toutes les autres EXPO_PUBLIC_* (Supabase URL/key, GraphHopper, Sentry) doivent venir d'EAS secrets ou .env : INCONNU si configurées côté EAS** |
| OTA updates : **absent** — `expo-updates` nulle part (grep package.json + app.json = 0) | grep | PAS COMMENCÉE (choix ou oubli : INCONNU) |
| Push : plugin `expo-notifications` (channel `debrief`, `enableBackgroundRemoteNotifications: false`), token stocké dans `users.expo_push_token` | app.json:103-110, src/services/pushNotificationsService.ts:99-117 | FINIE côté app ; silence en piste implémenté via `notificationBehaviorForState` |
| projectId EAS `d168d639-…`, owner `oxv`, appVersionSource remote | app.json:120, eas.json | FINIE |
| CI GitHub Actions : typecheck + lint + prettier + jest ; tests RLS skippés sans secrets (`TEST_SUPABASE_URL/ANON_KEY/SERVICE_KEY`) | .github/workflows/check.yml | FINIE |

---

## 4. Points de contact avec oxvehicle.fr

| Connexion | Fichier(s) | Statut | Manque/note |
|---|---|---|---|
| Appairage site→app (code 8 car. → magiclink) | src/services/pairingService.ts:33 → edge `pair-app` (déployée v2, **source hors repo**) ; tables `app_pairing_codes`/`app_pairing_redeem_attempts` en prod | À VÉRIFIER | source edge non versionnée ici ; test bout-en-bout réel INCONNU |
| Partage progression `oxvehicle.fr/share/{token}` | sharesService.ts:58 + RPC `get_shared_progression` (:167) | À FINIR | la page `/share/{token}` côté site : existence INCONNUE depuis ce repo (« ou un futur micro-site », sharesService.ts:7) |
| Catalogue partenaires | `partner_offers`/`partner_accounts`/`partner_leads` (13/13/12 occ.) ; app/(app)/catalogue.tsx, partenaire/[id].tsx | FINIE côté app | 0 ligne `partner_offers` en prod → catalogue vide tant que le site n'alimente pas |
| Vue AR in-lens | `https://app.oxvehicle.fr/ar-view` WebView, app/(coach)/ar.tsx:84 | À FINIR | le commentaire :81-83 dit « peut ne pas être encore en ligne » — repli sobre géré ; route site à construire |
| Emails documents (branche courante) | edge `send-document-status` + trigger sur `public.documents` (table site, 5 lignes prod) | À VÉRIFIER | dépend du secret Vault + de l'UPDATE admin côté site |
| TV Pavillon | `design-retours/maquettes-tv/tv-accueil.html` (429 lignes, commit 8fe0cd6) | PAS COMMENCÉE (code) | maquette statique uniquement, rien de branché |
| Snippets circuit à porter au site | `web-snippets/` (app/circuit, components/CircuitMap, data/hauteSaintonge.ts…) | À FINIR | livrable pour le site, intégration côté site INCONNUE |
| Handle partagé site/app | `users.public_handle` (mémo fondateur) — validation dans src/utils/validation.ts | À VÉRIFIER | pas d'API dédiée, simple colonne partagée |

---

## 5. Variables d'environnement — consommation réelle

Consommées par le code (grep `process.env.` exhaustif) : `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` (src/lib/supabase.ts:15-16, throw si absentes), `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` (analyticsService.ts:30), `EXPO_PUBLIC_SENTRY_DSN` (sentry.ts:27), `EXPO_PUBLIC_ROUTING_PROVIDER`/`GRAPHHOPPER_KEY`/`KURVIGER_KEY` (scenicRouteService.ts:31-33), `GOOGLE_MAPS_ANDROID_KEY` (app.config.js:26), `TEST_SUPABASE_*` (tests RLS). Côté edge : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `CRON_TOKEN`, `EDGE_FUNCTIONS_INVOKE_SECRET` (liste exacte par fonction relevée).

**Variables MORTES dans .env.example** (0 consommateur, grep vide) : `OXV_WEB_URL`, `RACEBOX_SERVICE_UUID` (hardcodé src/types/telemetry.ts:14), `FLIC_SERVICE_UUID`, `ELEVENLABS_API_KEY`/`VOICE_ID`, `OPENAI_MODEL`, `RESEND_FROM_EMAIL`/`NAME`, `EXPO_PUBLIC_BUNDLE_ID`/`APP_VERSION`/`BUILD_NUMBER`, `SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY` (versions sans préfixe), `NODE_ENV`, `DEBUG`. **Manquante** : `EXPO_PUBLIC_KURVIGER_KEY`.

---

## 6. Risques classés

| # | Risque | Preuve | Gravité |
|---|---|---|---|
| 1 | **Dérive verify_jwt prod vs repo** : `notify-pilot-coach-assigned` et `notify-coach-consent-received` sont déployées avec `verify_jwt: false` en prod (list_edge_functions MCP) alors que `supabase/config.toml` déclare `true` et que les handlers n'ont **aucune garde interne** (lecture service_role + push). Un POST anonyme forgé `{pilotId}` peut spammer un pilote de pushs « Un coach vous suit. » | config.toml vs sortie MCP ; notify-pilot-coach-assigned/index.ts:22-66 | **HAUTE** — redéployer avec verify_jwt=true ou ajouter la garde secret |
| 2 | 4 fonctions notify-* trigger : garde secret **fail-open** si `EDGE_FUNCTIONS_INVOKE_SECRET` non posé (warn + continue) — et elles sont en verify_jwt=false | index.ts:49/:59/:51/:51 | MOYENNE (dépend de la présence du secret en prod : INCONNU) |
| 3 | `compute-session-insights` (repo) vs `compute-session-insights-v3` (prod, source hors repo) : l'app invoque la v1 (analyzeSessionService.ts:167) ; divergence moteur 7 vs 13 virages assumée en commentaire mais **2 moteurs actifs** | en-tête compute-session-insights + list MCP | MOYENNE |
| 4 | `purge-deleted-accounts` : header « DRAFT — À VALIDER JURIDIQUEMENT » mais déployée ACTIVE v4 (dormante fail-closed sans secret) | index.ts:4-8 + list MCP | MOYENNE (juridique) |
| 5 | `cron-analyze-pending-sessions` : `CRON_TOKEN` optionnel — sans lui, endpoint public verify_jwt=false qui écrit des analyses via service_role | index.ts:64-70 + config.toml | MOYENNE |
| 6 | GraphHopper/Kurviger : code complet mais jamais exercé avec une clé réelle (aveu en commentaire), clé absente de l'env | scenicRouteService.ts:18-20, .env.example | FAIBLE (feature dégradée proprement en null) |
| 7 | Tables DEPRECATED `events`/`event_registrations` encore câblées (29 occurrences) | grep + commentaires prod | FAIBLE-MOYENNE (dette planifiée) |
| 8 | 18 edge functions prod sans source dans ce repo (dont `pair-app` invoquée par l'app) — auditabilité et rollback impossibles depuis ici | list MCP vs `ls supabase/functions` | MOYENNE |

---

# SYNTHÈSE DE PILOTAGE

## Prod Supabase — état vérifié le 18/07

- **Advisors sécurité : 70** — 6 ERROR (les vues `*_public` SECURITY DEFINER :
  sessions_public, qdi_public, testimonials_public, crews_public,
  session_availability, plateau_members_public — elles servent le SITE ; à
  convertir en `security_invoker` ou à borner), 62 WARN (dont : policy « always
  true » sur `corporate_leads` à resserrer ; buckets `coach-media` et
  `partner-media` publics en LISTING ; 2 fonctions à `search_path` non figé,
  dont `set_pavilion_optin_at` posée hier), 2 INFO.
- **32 edge functions ACTIVE** — les « boucles de suivi » sont plus avancées que
  le code app ne le laissait voir : suite notify-* (ami demandé/accepté, coach
  assigné, consentement, séance analysée/annotée, lead admin), chaîne e-mails
  Resend (contact, candidature, documents, réservation, paiement, newsletter,
  relances éligibilité, feedback), `pair-app` (appairage app↔site), rituels
  (dispatcher + dryrun), `generate-invoice`, `purge-deleted-accounts` (RGPD),
  `geocode`, insights (v1+v3), `detect-circuit-corners`, IA gardée
  (draft/validate + debrief). Le repo app ne versionne qu'une partie d'entre
  elles — la source de plusieurs vit côté site : point de traçabilité à fermer.
- **Base calibrée pour le terrain** : 2 circuits à détection par PORTE (Haute
  Saintonge ligne officielle + 15 m ; Ricardo Tormo ligne officielle + 10 m +
  centerline 135 pts), idempotence trames + tours (contraintes UNIQUE posées),
  prix coach à la session, workflow points partenaires (création → validation
  admin), profil Pavillon (bio, N° voiture unique, opt-in horodaté RGPD).

## Les 5 risques majeurs, classés

1. **La chaîne de capture n'a jamais vu une vraie séance de bout en bout.**
   Tout le durcissement (offline-first, reconnexion illimitée, idempotence,
   porte) est testé unitairement (837 verts) et contre-vérifié adversarialement
   (17 findings corrigés), mais le smoke test terrain
   (`docs/SMOKE_TEST_DEVICE.md`) n'a pas été exécuté. C'est LE risque n°1 et le
   prochain geste utile.
2. **Le live coach (P5) et le debrief temps réel n'ont jamais tourné à deux
   appareils** (presence + realtime OK sur le papier, jamais éprouvés).
3. **6 vues SECURITY DEFINER en ERROR** côté advisors — elles contournent la
   RLS par conception pour le site ; chacune doit être soit passée en
   `security_invoker`, soit auditée colonne par colonne.
4. **Pas de crash reporting en prod** (Sentry câblé nulle part — seul Plausible
   analytics) : une panne terrain sera invisible.
5. **Dépendance à un seul appareil provisionné** (l'iPhone du fondateur) et
   à un seul environnement : pas d'iPad dans le profil (console coach tablette
   jamais vue en natif), pas d'Android testé.

## Ce qui reste, par horizon

**Avant la prochaine journée circuit (bloquant terrain)** :
smoke test device complet (survie hors-ligne 5 étapes + test de la porte aux
stands + ≥20 Hz) ; attribution des premiers N° de voiture (geste admin).

**Décisions fondateur en attente** : statut « Membre Fondateur » (TODO_ARBITRAGE) ;
RIB + QR SEPA coach (schéma IBAN) ; vues `*_public` (risque n°3) ; rétention
waivers D4 + relecture avocat (P3, gaté OFF) ; activation Stripe post-SIRET (août).

**Côté site (repo oxv-site, hors app)** : vue Pavillon TV filtrée par opt-in
(la RLS own-only bloque la lecture des noms — consigné) ; implémentation
tv-accueil (maquette livrée) + tv-coach (à dessiner) ; page handle partagé
(doc de coordination livrée).

**Améliorations non bloquantes** : passe a11y (47 findings low) ; pré-sélection
du comparateur depuis le panel de cartes (TODO_LOT_SUIVANT) ; câblage réel des
6 lectures Insights post-Valence ; notifications push app (expo-notifications
présent, envoi métier non câblé côté app — la suite notify-* serveur existe).

## Verdict d'ensemble

En 8 semaines : une plateforme 4 rôles (pilote/coach/partenaire/admin) de 171
écrans au canon graphique unifié, un write-path télémétrique durci et
adversarialement vérifié, une base production calibrée au mètre près pour deux
circuits, un modèle économique sans encaissement OXV (doctrine préservée), et
une identité produit (miroir, jamais coach) qui a survécu à toutes les vagues
de features. Le projet est passé de « app compagnon » à « plateforme OXV ».
Ce qui sépare l'état actuel d'un produit éprouvé n'est plus du code : c'est
UNE JOURNÉE DE PISTE avec un RaceBox, un iPhone, et la checklist de smoke test.
