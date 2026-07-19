# OXV APP V2 — DOSSIER MAÎTRE D'EXÉCUTION
### Architecture d'expérience · 38 écrans détaillés · 15 nouveautés positionnées · Plan de lots
### Document de référence pour Claude Code — 18/07/2026

---

# 0. MODE D'EMPLOI CLAUDE CODE (règles absolues)

1. **Zéro sur l'expérience, pas sur le code.** Les 137 services de `src/services/` ne sont JAMAIS modifiés dans un lot d'écran. Toute évolution service/DB = lot backend séparé. Les 837 tests restent verts à chaque commit.
2. **Un lot = un commit.** Grep doctrine avant chaque push (lexique proscrit : conseiller, améliorer, corriger, devriez, meilleur que… — liste verrouillée dans `aiSafetyFilter.ts`). `tsc --noEmit` = 0 erreur.
3. **Routes v2 dans `app/(app2)/`** le temps de la migration ; redirects v1→v2 posés au lot L6 ; suppression v1 seulement après validation fondateur.
4. **Chaque écran v2 embarque `StateView`** (squelette / vide / erreur / hors-ligne + retry). Fin des catch muets : toute erreur de fetch alimente l'état erreur.
5. **FlatList** sur toute liste non bornée. **Reanimated** pour toute animation (installé au L0).
6. **Tables site** : le canonique est `sessions`/`registrations` — la table `events` est DEPRECATED, aucun nouveau code ne s'y branche.
7. **Avant tout travail sur une table dont la structure est incertaine** (crews, payments, pricing côté site) : inspection réelle via Supabase MCP, jamais de supposition.
8. **Flags fail-closed** : toute fonctionnalité gatée (paiement, biométrie, décharge, fondateurs) vérifie son flag SUR l'écran, pas seulement à l'entrée de navigation (leçon du trou coach_billing).
9. **Doctrine Miroir partout côté pilote** : faits, jamais de conseil, jamais de comparaison à autrui avec gagnant, biométrie jamais en roulage ni sur écran public.

## Gates externes (rien ne s'active sans)
| Gate | Bloque | Levée par |
|---|---|---|
| SIRET → Stripe | A1 paiement, facturation coach | août 2026 |
| Validation avocat | décharge (`pilot_waivers`), consentement biométrie (BIO-0), CGV paiement | RDV semaine 21/07 |
| Décision classement | écran paddock TV (board) | fondateur |
| Smoke test terrain | lots frames-dépendants (L3, B1, B4), live réel | 1 journée piste |

---

# 1. DESIGN SYSTEM V2 — **DA INSTRUMENT** (figée par le fondateur 18/07 — lot L0)

> Direction retenue parmi 3 explorées (Monolithe / Instrument / Lumière) : **Instrument** — titane froid, cadrans, aiguilles, or Heritage dans son élément (horlogerie), avec la discipline Monolithe (retenue, hairlines). Emprunt Lumière au backlog : mode paddock clair jour J (post-v2.0).

## Couleurs
```
bg.base #14151A · bg.card #1B1D24 (bord #2A2D38) · bg.card2 #232630 (bord #3A3E4C)
hairline #22242C (listes, séparateurs)
accent #C8102E (UN par zone : CentralButton, millièmes, arcs, CTA)
text.hi #E8E9ED · text.mid #A9ADBB · text.low #7A7E8C · text.dim #5A5E6C
heritage #C4A459 (texte #E8DCB8) — TIER HERITAGE EXCLUSIVEMENT, en bordures/aiguilles/texte, jamais en grands fonds
QDI (données seulement, jamais fonds) :
  Trajectoire #60A5FA · Fluidité #FFB703 · Freinage #E63946
  Accélération #4ADE80 · Régularité #C084FC
```
## Typo
**Michroma** (display : titres de porte, 1/écran max — remplace Syncopate dans l'app ; le logotype OXV de marque est inchangé) · Inter (corps) · JetBrains Mono (toute donnée chiffrée, eyebrows letterspacing 2-3px, millièmes en accent).

## Règles cadran (anti-gadget, non négociables)
1 cadran max par écran · un cadran encode toujours une progression réelle (countdown, remplissage de séance, pack Heritage x/4), jamais décoratif · aiguille = valeur instantanée, arc = cumul · aucune texture métal/reflet/vis — le titane est une palette, pas un skeuomorphisme · hairlines pour les listes, cartes pour les objets.

## 13 composants noyau (lot L0, `src/ui/v2/`)
`ChronoHero` · `RadarQdi` · `PillarBar` · `TraceCircuit` (+ prop `annotationBand` séparée, bord or si annotation coach) · `SessionCard` · `StatCell` · `SectionHeader` · `Sheet` · `StateView` · `HeritageBand` (bord or, sans fond) · `CentralButton` (3 états) · `BiometryStrip` · **`Dial`** (le composant signature : arc + aiguille sweep spring).

## Motion (Reanimated)
Portes fade+slide 250 ms · sweep d'aiguille 800 ms spring (Dial au mount) · CentralButton pulse 1,2 s en capture · stagger cartes 40 ms · compteur roulant millièmes (Bilan) · tracé radar 600 ms · squelettes shimmer.

---

# 2. NAVIGATION — 5 PORTES · BOUTON CENTRAL DYNAMIQUE

```
MIROIR        DATA        [ ● ]         CLUB        VOUS
présent      séances    (3 états)     les autres   identité
```
**Le bouton central raconte où en est le pilote — 3 états (décision fondateur 18/07)** :
| État | Condition | Libellé | Action |
|---|---|---|---|
| **RÉSERVER** | aucune inscription à venir (`getMyNextTrackDay` = null) | RÉSERVER (rouge, calendrier) | → flux A1 réservation (flag `app_payments` ; avant activation : → catalogue journées lecture seule + contact) |
| **PRÉPARER** | inscription ≤ J-3 | J-3 · J-2 · J-1 (countdown) | → REC/Préparation (checklist, météo, convoi C2) |
| **REC** | jour J sur place / capture | REC (pulse en capture) | → flux capture (state machine intacte) |
Source d'état : `getMyNextTrackDay` + `useAppStateStore` (S5/S6). Composant `CentralButton` (remplace `RecButton` au L0). Hors jour J le centre de l'app est le moteur de vente ; jour J il redevient l'acte. Détails secondaires en `Sheet`, plus en écrans pleins.

---

# 3. PORTE MIROIR — le présent (3 écrans · lot L1)

## 3.1 Accueil Miroir — `app/(app2)/index.tsx`
**Rôle** : le présent du pilote. Première impression App Store. **Deux visages (décision fondateur 18/07)** — le Miroir s'adapte au temps du pilote :
- **Mode après-séance** (séance < 7 j) : héros = dernière séance (chrono, tracé), signature, fait narratif.
- **Mode entre-journées** (sinon) : héros = **compte à rebours de la prochaine journée** (« J-12 · Haute Saintonge ») ou carte RÉSERVER si rien au calendrier ; signature ; un fait de saison (`loadPilotStats`) ; activité du groupe (A3 : « Pierre a roulé jeudi », opt-in). Le vide devient de l'attente.
Les 3 modes capture existants (silence S5 / countdown / passif) restent prioritaires par-dessus.
**Absorbe** : index, trace, aperçus signature/progression.
**Sections (ordre, selon mode)** :
1. Header : eyebrow PADDOCK rouge (or HERITAGE si tier Heritage — lire `registrations.offer_type` comme le fait `loadPassport`), titre MIROIR Michroma, avatar → VOUS.
2. Héros selon mode : `SessionCard` large (après-séance, tap → Bilan) OU countdown/RÉSERVER (entre-journées, tap → REC/Préparation ou flux A1).
3. Signature compacte : `RadarQdi` 5 axes couleurs QDI + « vous vs vous · 30 j ». Source : `getOrComputeQdiForSession`. Tap → Signature.
4. Un fait : `traceNarrativeService` (après-séance) ou fait de saison (entre-journées).
5. Prochaine journée / réserver : `getMyNextTrackDay` — carte rouge sombre (si pas déjà en héros). 🆕 **A1** CTA « Réserver » (flag `app_payments`).
6. 🆕 **A3** activité du groupe (entre-journées, opt-in, faits sans classement).
7. 🆕 **B3 rituel du jour** : bandeau contextuel (J-3 météo, « bilan prêt ») piloté par notifications reçues.
**Connexions** : → Bilan, Signature, REC, VOUS, Réservation, Club (groupe). ← racine par rôle.

## 3.2 Bilan de séance — `app/(app2)/bilan/[sessionId].tsx`
**Rôle** : LE rendez-vous post-piste (parcours émotionnel n°1).
**Absorbe** : bilan, debrief, debrief-presentiel, bilan-pret.
**Sections** :
1. Header sobre : date · circuit (eyebrow mono) · partage.
2. `ChronoHero` : meilleur tour, millièmes rouges, compteur roulant · tours · km.
3. `TraceCircuit` central (couleur = vitesse si frames) + puces moments-clés (`keyMoments`). **Bande annotation coach SÉPARÉE sous le tracé** (`coach_annotations` via services existants) — jamais dans le tracé.
4. 4 piliers `PillarBar` aux couleurs QDI (`app_session_analyses`, `segmentAnalyses`).
5. 🆕 **BiometryStrip** (si opt-in + données) : FC sous tracé temporel, source watch/polar, indicateur qualité. Service : `biometryService` (BIO-1).
6. Debrief J+1 (IA gardée) : `app_session_analyses.debrief_text` — repli pédagogique existant.
7. Fil présentiel coach↔pilote : `useCoachThread` (`coach_messages`).
8. Souvenirs : médias session (`session-media` RLS) + 🆕 **B1** CTA « Créer la vidéo du tour » (flag, post-frames).
9. Export PDF (`bilanPdfExport`) · partage carte trophée (view-shot).
**Connexions** : ← Accueil, Data hub, Fin de séance, notification B3. → Séance (Data), Galerie, Vidéo (B1).

## 3.3 Signature — `app/(app2)/signature.tsx`
**Rôle** : l'identité de pilotage dans le temps (self-only).
**Absorbe** : signature, empreinte-saison.
**Sections** : radar plein écran 5 axes animé (`qdiLogic`, 4 branches frames-dépendantes se masquent honnêtement) · mini-radars mensuels (`listMonthlyQdi`) · 🆕 **BIO-4** pilier physiologique (opt-in, nom D2 « Aplomb » à confirmer) · vocabulaire figé Cap/Trajectoire/Visée/Plongée/Anticipation.
**Connexions** : ← Accueil, VOUS hub. → Saison.

---

# 4. PORTE DATA — les séances (4 écrans · lot L3, post-terrain)

## 4.1 Data hub — `app/(app2)/data/index.tsx`
**Rôle** : entrer dans ses séances. **Absorbe** : data-lab, cartes.
**Sections** : filtres (circuit/période) · `FlatList` de `SessionCard` (sélection ×2 → barre Comparer, **câbler ENFIN la pré-sélection**, TODO v1) · confiance donnée (`computeDataConfidence`) · export CSV (`dataExportService`).
**Connexions** : → Séance [id], Comparer (avec pré-sélection), Saison.

## 4.2 Séance — `app/(app2)/data/session/[id].tsx` ⭐ l'écran pivot
**Rôle** : UNE séance, tout entière. **Absorbe** : carte, virage, tours, heatmap, replay, telemetry, insights, insight/[reading], conditions, data-lab-canvas.
**Sections scrollables (ancres en header sticky)** :
1. Résumé : `ChronoHero` + stats (`fetchSessionLaps`).
2. Tours : barres delta or/rouge (logique `tours.tsx`, `laps` réels).
3. Tracé & virages : `TraceCircuit` + pastilles marge (`getCornerMarginsZones`) → tap virage = `Sheet` zoom (phases frein/apex/sortie, `cornerDeepDiveService`, audio coach `getAnnotationAudioUrl`).
4. Télémétrie : onglets internes G-G / canaux / heatmap / replay (`loadLapFrames`, `loadSessionTrajectory`, `sessionTelemetryService`) — Skia (data-lab-canvas garde Expo Go).
5. Constats : liste (`session_insights`) → 6 lectures en `Sheet` (**câbler les viz sur frames réelles**, fin des données DÉMO — `*Viz.tsx`).
6. 🆕 **B4 Évolution par virage** : « ce virage sur vos N dernières séances » — superposition self-only des trajectoires (`loadLapFrames` multi-sessions, nouveau `cornerEvolutionService`).
7. 🆕 **BiometryStrip** : FC calée sur le tour sélectionné.
8. Conditions & ressenti : `weather_snapshots` + `pilotNotesService` + 🆕 **B5** « vos chronos par T° piste » (facteurs factuels, `weatherCorrelationService` nouveau, self-only).
**Connexions** : ← hub, Bilan, Saison. → Comparer, Galerie session, Vidéo B1.

## 4.3 Comparer — `app/(app2)/data/comparer.tsx`
**Rôle** : un seul comparateur, 3 modes : 2 séances / 2 tours / 1 ami. **Absorbe** : comparateur, virage-comparer, cote-a-cote. Toujours 4 lignes factuelles, **sans gagnant** (doctrine). Sources : `fetchSessionLaps` ×2, `loadLapFrames` ×2, frames des 2 pilotes (RLS amis).
**Connexions** : ← hub (pré-sélection), Séance, Roulages & amis.

## 4.4 Saison — `app/(app2)/data/saison.tsx`
**Rôle** : le temps long. **Absorbe** : progression, regularite, stats, circuits, circuit/[id].
**Sections** : courbe or meilleur tour (`fetchAllSessions`+`computeRegularity`) · histogramme régularité · stats consolidées (`loadPilotStats`) · records par circuit + circuits roulés/pointillés (`fetchCircuits`) → `Sheet` détail circuit (+ `ecosystemService`).

---

# 5. PORTE REC — rouler (8 écrans · lot L2 · state machine INTACTE)

La machine S5/S6 de `useAppStateStore` et `captureSessionService`/`captureSyncQueue` ne bougent pas d'une ligne. Seule la coque change.

| Écran | Route | Contenu & connexions | 🆕 |
|---|---|---|---|
| Piste hub | `rec/index` | état courant, entrée flux (session/index v1) | **A1** : pas d'inscription → « Réserver une journée » |
| Préparation | `rec/preparation` | météo (`nextTrackDayService`), checklist, créneau, QR Pass | **B2** Live Activity démarrée ici (jour J) |
| Arrivée | `rec/arrivee` | « Vous y êtes » (paddock.tsx, manuel V1, géoloc V2.1) | **C1** « Qui roule aujourd'hui » (opt-in, `registrations`) |
| Équipement | `rec/equipement` | scan RaceBox (`bluetoothService`, `getMyAssignedDevice`) | **BIO** ceinture Polar (coachés) + écran consentement biométrie (BIO-0) + rappel Watch (« lancez un entraînement ») phase A |
| Placement | `rec/placement` | multi-circuit, `captureFinishLineFor` | — |
| Roulage | `rec/roulage` | REC pulsant Reanimated, silence total | — (doctrine : rien d'autre) |
| Entre-runs | `rec/entre-runs` | countdown, note rapide, meilleur tour (`useSessionStore`) | **BIO** restitution FC du run à la pause (`BiometryStrip`, self-only) · **B2** Live Activity mise à jour |
| Fin de séance | `rec/fin` | UN écran à états : pilotage fini → préservation (upload .ubx, timeout 30 s) → bilan prêt → CTA Bilan (fusion des 3 écrans v1, mêmes services) | **BIO-1** : lecture HealthKit post-run déclenchée ici · **D4** bouton « Déclarer un incident » (nouveau `incidentService`, horodaté+photo, → admin) |

Debug-capture/debug-circuit conservés hors nav (`__DEV__`).

---

# 6. PORTE CLUB — les autres (7 écrans · lot L5)

## 6.1 Club hub — `club/index`
Fil : mon coaching (état binôme) · roulages à venir (`roulagesService`) · amis récents · Pass · actualité partenaires · 🆕 **A3 mon groupe** (« le groupe de Pierre — 5 membres », voir 6.8).

## 6.2 Coaching — `club/coaching`
**Absorbe** : coachs, coach/[id] (→`Sheet` fiche+`requestBooking`), mon-coach (consentements `pilotConsentService`, factures `pilotCoachBillingService`, paiement lien externe), mes-demandes (`coaching_bookings`, avis `coach_reviews`). Onglets Trouver / Mon coach / Demandes.

## 6.3 Roulages & amis — `club/roulages`
roulages (invitations accepter/décliner) + amis (@handle, `friendshipsService`, « roulé ensemble ×N ») + → Comparer (mode ami).

## 6.4 Territoire — `club/territoire`
**Absorbe** : carte-oxv (`social_pings`+circuits, garde isExpoGo), belle-route (certifiées), mes-routes, creer-route (GraphHopper/Overpass), creer-trace (import OSM). Onglets Carte / Routes / Créer. 🆕 **C2 Convoi** : lier une route certifiée à une journée (`convoysService` nouveau : route_id × session_id, RDV, participants opt-in) — visible aussi dans Préparation.

## 6.5 Partenaires — `club/partenaires`
catalogue (`listMarketplace`, garde-fou : jamais de push télémétrique) + fiche `Sheet` (`partenaire/[id]`) + lead consenti (`requestPartnerContact`).

## 6.6 Galerie — `club/galerie`
`listAllPilotMedia` + médias par session + carte trophée (view-shot) + partage par lien (scopes, `sharesService`/`get_shared_progression`). 🆕 **B1 Vidéo synchronisée** vit ici et dans Bilan/Séance : `videoOverlayService` nouveau — import vidéo (iPhone/GoPro), sync sur frames par tap-align, overlay chrono/tracé/G (JetBrains Mono, millièmes rouges), export 9:16. Post-frames réelles. 🆕 **C3 Carnet Heritage** : livret de saison PDF or (Heritage only, `bilanPdfExport` étendu + galerie).

## 6.7 Pass OXV — `club/pass`
inscriptions, QR de présence, événements ouverts (côté pilote fini ; scan admin inchangé).

## 6.8 🆕 A3 Groupes (transverse Club)
Parrainage SANS avantage financier : code personnel (VOUS) → filleul lié au groupe du parrain. **Avant tout code : inspecter `crews_public`/tables crews en prod via MCP** ; sinon `crews`(id, name, owner_id) + `crew_members` RLS opt-in. Le groupe apparaît : Club hub, présence jour J (C1, filtre groupe), Convoi (C2), Galerie (album groupe).

---

# 7. PORTE VOUS — l'identité (8 écrans · lot L4)

| Écran | Route | Contenu (services) | 🆕 |
|---|---|---|---|
| Vous hub | `vous/index` | passeport héros (`loadPassport` : palier, records, km) + accès sections | **HeritageBand** or si tier Heritage (exclusif) · **A2** carte « Membre Fondateur 12/30 » ou badge Fondateur (arbitrage tranché ici) · **A3** mon code parrain + mon groupe |
| Profil public | `vous/profil` | consultation+édition fusionnées (bio, réseaux, handle, n° voiture, opt-in Pavillon — migration pavillon appliquée) | — |
| Garage | `vous/garage` | CRUD véhicules, photos réelles, journal réglages | — |
| Carnet | `vous/carnet` | notes+météo (`pilot_notes`) · intentions (`session_intentions`) · objectifs (`pilotGoalsService`, invisible coach) · programme coach lecture (`listSharedCyclesForMe`) — 4 onglets | — |
| Équipement | `vous/equipement` | boîtier (santé/batterie `deviceHealthService`) | **BIO** : état ceinture appairée (coachés) + statut autorisation HealthKit Watch |
| Licence & documents | `vous/documents` | carte FFSA (view-shot), décharge e-sign (flag `pilot_waivers`, texte avocat), Pacte/CGU/confidentialité bundlés | — |
| Réglages | `vous/reglages` | UN écran à sections : notifications (préférences existantes) · consentements (`consentService` : IA débrief/coach, audience, live) · données & sécurité (export `dataExportService`, suppression J+30 `accountService`) · déconnexion | **BIO-0** kind `biometry` (opt-in OFF, retrait 1 geste) · **B3** préférences rituels |
| Support | `vous/support` | tickets + fil (`supportService`) | — |

🆕 **A2 Membre Fondateur** — `vous/fondateur` (sheet) : candidature (motivation, garage, parrain), file « 12/30 » visible, statut. Nouveau `founderService` + table `founder_applications` (RLS own + admin), validation côté admin. Badge profil = l'arbitrage TODO_ARBITRAGE v1, tranché : Fondateur affiché après validation admin.

🆕 **A1 Réservation & paiement** — `vous/../reserver` (flux modal depuis Miroir/REC/hub) :
- Catalogue journées : tables SITE `sessions`+`pricing` (inspecter via MCP) · places restantes (plafond 20) + liste d'attente.
- Paiement : **journées de piste = Stripe** (service physique, pas de commission Apple — PaymentSheet) · **abonnement 99 €/an = In-App Purchase** (numérique, règle Apple) · Heritage 2 490 € = Stripe (pack de sessions physiques). Distinction à faire valider avocat (CGV).
- Écrit dans `registrations`+`payments` (site) — coordination repo site (webhook Stripe existant côté site : `send-payment-confirmed`).
- Flag `app_payments` fail-closed, vérifié SUR chaque écran du flux. Actif au SIRET.

---

# 8. TRANSVERSES SYSTÈME

## B2 Live Activities + widgets iOS
Live Activity jour J (prochain run, countdown, météo, meilleur tour du jour — jamais biométrie) démarrée en Préparation, mise à jour Entre-runs, close Fin. Widget accueil : signature mini + prochaine journée. Cible native (config plugin Expo + extension Swift) — même mécanique que la mini-app Watch (BIO-3).

## B3 Rituels & notifications de cycle de vie
Le serveur EXISTE (`ritual_dispatcher`/`ritual_dryrun`, hors repo app — coordination site). Côté app : enregistrement des catégories, deep links (bilan prêt → Bilan ; J-3 → Préparation), préférences dans Réglages, bandeau contextuel Accueil. Réutiliser `pushNotificationsService` + `notification_preferences`.

## Live & écran paddock (rappel intégration)
Réutiliser `liveRelayRunner` + `live:roster:`/`live:session:` (ne PAS créer coach.{id}). Ajouter : événements `biometry` (gate consentement, canal coach seul) · topic `live:board:<sessionId>` + policy realtime + `stripHealth()` testée · écran TV board (post-décision classement) · brancher `ar.tsx` (Meta = abonné canal coach). Multi-live roulage (D1) = consommateur du même board.

## D2 Bibliothèque de séquences coach (espace coach, post-pilote)
Templates de cycles réutilisables (`pilot_development_cycles` + table `cycle_templates`), application à N pilotes, doctrine coach (prescriptif autorisé côté coach uniquement).

## D3 Mode événement B2B
Journée `sessions.type='b2b'` : roster fermé, branding partenaire discret sur board TV, rapport B2B enrichi (éditeur admin existant `b2bReportService`).

---

# 9. BACKEND — RÉCAPITULATIF DES NOUVEAUTÉS (lots BE séparés)

| Table/objet | Pour | RLS |
|---|---|---|
| `biometry_raw` (ts, hr, rr_ms[], source, quality) | BIO | own-row · coach si `is_detailed_coach_of`+consent biometry · jamais partner/staff · purge 30 j + purge-deleted-accounts |
| kind consentement `biometry` | BIO-0 | centre unifié existant |
| `founder_applications` | A2 | own + admin |
| `crews`/`crew_members` (SI inexistants — inspecter prod d'abord) | A3 | membre lit son groupe, owner gère, opt-in |
| `convoys` (route_id, session_id, rdv, participants) | C2 | inscrits de la journée |
| `incident_reports` (session_id, ts, photo, description) | D4 | own + admin, immuable après envoi |
| `video_overlays` (métadonnées sync) | B1 | own-row |
| `cycle_templates` | D2 | coach owner |
| topic `live:board:` + policies realtime | board | whitelist position/chrono, stripHealth |
| flags : `app_payments`, `biometry`, `founders`, `video_overlay` | gates | fail-closed |
| `cornerEvolutionService`, `weatherCorrelationService`, `biometryService`, `founderService`, `convoysService`, `incidentService`, `videoOverlayService`, `referralService` | services nouveaux | lots BE |

Paiement : AUCUNE table nouvelle côté app — `sessions`/`registrations`/`payments`/`pricing` du site (inspection MCP préalable + correctif Heritage 249 000 cents déjà consigné).

---

# 10. PLAN DE LOTS COMPLET (fusion architecture + nouveautés)

| # | Lot | Contenu | Dépend |
|---|---|---|---|
| 1 | **V2-L0** | Reanimated · tokens DA Instrument · 13 composants noyau (dont Dial) · `(app2)` + redirects | — |
| 2 | **BE-1** | flags · `biometry_raw`+consent kind · `founder_applications` · inspection crews/payments MCP | avocat (biometry) |
| 3 | **V2-L1** | MIROIR (3 écrans) + B3 câblage notifications | L0 |
| 4 | **V2-L2** | REC (8 écrans) + BIO-1 Watch phase A + D4 incident + C1 présence + B2 Live Activity | L0, BE-1, smoke test pour validation |
| 5 | **V2-L4** | VOUS (8 écrans) + A2 fondateurs + A3 code parrain + A1 flux réservation (flag OFF) | L0, BE-1 |
| 6 | **V2-L5** | CLUB (7 écrans) + A3 groupes + C2 convoi + C3 carnet Heritage | L0, BE-1 |
| 7 | **V2-L3** | DATA (4 écrans) + B4 + B5 + câblage 6 viz sur frames réelles | L0, **frames réelles** |
| 8 | **BIO-2** | Polar BLE + greffe liveRelayRunner + vue coach | BE-1, smoke live |
| 9 | **LIVE-B** | `live:board` + écran TV + `ar.tsx` Meta + D1 multi-live | **décision classement** |
| 10 | **BIO-3** | mini-app watchOS (workout auto) | BIO-1 |
| 11 | **B1** | vidéo synchronisée | frames réelles, coût stockage validé |
| 12 | **A1-ON** | activation paiements (Stripe live, IAP abonnement) | **SIRET**, CGV avocat |
| 13 | **V2-L6** | bascule : redirects, suppression v1, BIO-4 pilier Signature | tout |
| — | Coach/Admin v2 | propagation design system | après pilote |

Ordre d'exécution recommandé : 1 → 2 → 3 → 5 → 6 → 4 → (smoke test) → 7 → 8 → 9/10/11 → 12 → 13.

---

# 11. VÉRIFICATION D'EXHAUSTIVITÉ (mapping v1 → v2 contrôlé)

Les 83 fonctionnalités pilote du bilan ont une destination v2 — contrôle fait ligne à ligne : Miroir 14/14 (§3) · Data Lab 12/12 (§4) · Carnet 4/4 (§7 Carnet) · Découverte 21/21 (§6) · Compte 16/16 (§7) · Capture 12/12 (§5) · cartes 1/1 (§4.1). Drops doctrinaux v1 assumés reconduits (état pneus, crédit partenaire galerie, placement paddock). Pas commencées v1 traitées : Fondateur → A2 (tranché) · 2FA + changement mdp → hors périmètre v2.0 (backlog sécurité) · couverture profil → profil v2 (write-path à créer, lot L4).

**Checklist Claude Code avant chaque push** : tsc 0 · jest vert · grep doctrine 0 · flag vérifié sur écran · StateView présent · FlatList listes · aucune modif `src/services/` dans un lot écran · aucune référence `events` dans du code neuf · biométrie absente de board/staff/roulage.

---

*Documents sources : 18-07-2026_BILAN_COMPLET_OXV.md · OXV_APP_V2_ARCHITECTURE_EXPERIENCE.md · OXV_V2_NOUVELLES_FONCTIONNALITES.md · OXV_Biometrie_Deux_Niveaux_Watch_Polar.md · OXV_Ceinture_Protocole_Connexion_Biometrie.md · PROMPT_CLAUDE_CODE_CHAINE_LIVE_OXV.md (canaux corrigés §8) · dossiers avocat/assureur · modèle financier v15.*
