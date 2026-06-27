# Parcours utilisateurs

> Document de cadrage. Réf. nav et rôles : `00_PLATEFORME_OXV.md`. Zones pilote : `01_ORGANISATION_PRODUIT.md`. Écrans réels : `02_AUDIT_ROUTES.md`. Périmètre V1/V1.5 : `03_MVP_SCOPE.md`. Loi design : `04_DESIGN_CANON.md`.
> Objet : décrire les parcours complets par rôle. Chaque étape = **écran réel** (route existante) + **action utilisateur** + **réaction système** (service / table / RPC réels). Ce document sert Claude Code : on ne théorise pas, on cite le code en place.

---

## 0. Conventions de lecture

- **Écran** = route réelle (`app/(app)/*`, `app/(coach)/*`, `app/(admin)/*`) ou écran net-neuf clairement marqué.
- **Système** = service `src/services/*`, table ou vue `src/types/database.types.ts`, ou RPC Supabase. Cité tel quel.
- **V1.5+** = hors MVP, marqué explicitement. Ne pas coder en PR 1–7.
- **[NET-NEUF]** = écran ou table inexistant. Toute **table nouvelle** est marquée **« nécessite accord Gabin »** — aucun schéma n'est présenté comme acquis.
- Doctrine appliquée partout : l'app **montre, ne dirige pas**. Côté pilote, aucun verbe prescriptif (freinez, corrigez, vous devez, évitez, erreur, mauvais). Or = donnée. Rouge = coach / REC. Vouvoiement. Aucun emoji. **Silence total en piste.**

---

## 1. Parcours Pilote

Le parcours de référence va du compte vide au cycle de coaching. Il traverse les 5 zones (Paddock · Session · Bilan · Progression · Club) et le Compte (icône haut-droite). Les étapes V1.5+ sont signalées et ne bloquent pas le MVP.

### 1.1 Création de compte et onboarding

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 1 | Auth (entrée app) | Saisit email + mot de passe, valide | Supabase Auth crée la session ; ligne `users` (role `pilot` par défaut, enum `user_role`) |
| 2 | Onboarding | Renseigne prénom, handle, préférences | `onboardingService` ; écriture `users` ; validation handle via `src/utils/validation.ts` |
| 3 | `profil` | Complète le profil pilote | `pilotProfileService` → `users` / `pilot_sheets` |
| 4 | Véhicule **(V1.5+ Garage)** | Déclare un véhicule | `vehicles` (existe déjà) ; l'espace **Garage** complet est V1.5 (`03_MVP_SCOPE`) |

Doctrine : l'onboarding pose le ton OXV (vouvoiement, sobriété). Aucune promesse de performance, aucune gamification d'accueil.

### 1.2 Inscription à une session et arrivée circuit

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 5 | Paddock (`index`, état « hors événement ») | Voit dernier bilan + progression ; aucune session en cours | Paddock contextuel (PR 2) : 1 action principale selon le moment |
| 6 | Inscription événement | Demande à participer à un track day | `demandes_inscription` (demande) puis `registrations` (inscription confirmée) ; le web public porte l'acquisition (cf. `18_APP_VS_WEB` à écrire) |
| 7 | **Pass OXV [NET-NEUF, V1.5+]** | Présente son QR à l'arrivée | QR événement ; **table dédiée à définir — nécessite accord Gabin** |
| 8 | Paddock (état « arrivée circuit ») | Voit « Connecter l'équipement » | Action principale contextuelle = jumeler le boîtier |

### 1.3 Rouler — le flux Session (silence en piste)

Flux linéaire : **Équipement → Placement → Capture → Retour stands → Bilan prêt**.

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 9 | `equipement` | Lance la connexion RaceBox | `src/ble/bluetoothService.ts` (scan + connexion BLE) ; états d'erreur BLE explicites (que s'est-il passé / qu'est-ce qui est préservé / que faire) |
| 10 | `placement` | Confirme le placement du boîtier | Vérification signal ; pré-armement capture |
| 11 | `roulage` (**état EN PISTE**) | Roule | **UI éteinte.** Fond quasi pur, voyant REC rouge (`#C8102E`) qui pulse, « L'app s'efface. ». **Pas de tab bar, pas de données, pas de son, pas de notif.** Le parser `src/ubx/parser.ts` ingère les trames ; `sessionTelemetryService` / `telemetryStorage` persistent (offline-first) |
| 12 | `entre-runs` | Revient aux stands entre deux runs | Reprise d'UI minimale ; détection de tours `src/utils/lapDetection.ts` → `laps` |
| 13 | `pilotage-fini` | Termine la journée | Clôture la session ; `telemetry_sessions` finalisée |
| 14 | `bilan-pret` | Voit « Découvrir mon bilan » | Transition ; mini-instrument (marge globale) ; `marginCalculator` |

Doctrine : pendant l'étape 11, **aucun écran utile, aucune notification, aucun son** (cf. `04_DESIGN_CANON §6`). C'est la règle non négociable du silence.

### 1.4 Comprendre — le Bilan et le Data Lab

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 15 | `bilan` (cœur) | Lit son bilan | **Un seul chiffre dominant** (marge globale, or) + phrase miroir + 2 constats (« à observer » or / « à conserver » vert) ; `analyzeSessionService`, `sessionInsightsEngine`, `app_session_analyses`, `session_insights` |
| 16 | `bilan` → bande coach | Voit la bande coach (si note) | Bande **rouge** = seul espace prescriptif ; question ouverte, jamais d'ordre |
| 17 | Data Lab (assemblage **[NET-NEUF]** des sous-vues) | Ouvre la lecture détaillée au toucher | Regroupe `carte`, `virage`, `virage-comparer`, `tours`, `heatmap`, `replay`, `telemetry`, `insights`, `insight/[reading]` ; services `cornerDeepDiveService`, `segmentAnalysesService`, `brakingPointsService` |
| 18 | `debrief` | Consulte le débrief J+1 | `debriefGenerator` ; vocabulaire « à creuser la prochaine fois » (`prochaine-fois`) |
| 19 | `partage` / `carte-trophee` | Génère un « OXV Moment » | `sharesService` → `app_progression_shares` ; page publique `share/[token]` |

Doctrine : ordre de révélation **retenir → où regarder → pourquoi → détails sur demande**. Un seul chiffre dominant par écran. Vocabulaire interdit côté pilote (freinez / corrigez / mauvais / erreur).

### 1.5 Partager au coach et recevoir une note

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 20 | `coachs` (marketplace) | Découvre les coachs publiés | `coachMarketplaceService.listPublishedCoaches` ; `coach_profiles`, vue `coach_public_card` |
| 21 | `coach/[id]` | Consulte une fiche + avis | `getCoachProfile` ; `coach_reviews` ; disponibilités `coach_availability` |
| 22 | `mes-demandes` | Demande un coaching | Crée la demande de coaching ; affiliation portée par `coach_pilots` (vue `coach_pilots_view`) |
| 23 | `donnees-securite` (Compte) / consentement | Donne son consentement de partage data | `pilotConsentService` ; `coach_permissions` (RPC `coach_has_permission`). Le coach ne lit la data **qu'après consentement** |
| 24 | `mon-coach` | Reçoit la note du coach | Bande coach sur le `bilan` ; `coach_annotations`, `coach_pilot_highlight` ; notif « après note coach → Lire la note » (cf. `14_NOTIFICATIONS` à écrire) |

### 1.6 Suivre le cycle et réserver

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 25 | `progression` | Lit son évolution | `statsService`, vues `day_rollups` / `history_rollups` / `stats_dashboard` ; **aucun classement, aucune comparaison non consentie** |
| 26 | `signature` / `regularite` | Consulte sa signature et l'indice de constance | `pilotSignatureService`, `regularityService` |
| 27 | `comparateur` | Compare soi vs soi | Comparateur **personnel** uniquement |
| 28 | `cote-a-cote/[friendId]` | Compare avec un ami (consenti) | `friendshipsService` → `pilot_friendships` ; RPC `are_friends` ; comparaison **consentie** seulement |
| 29 | Cycles / objectifs **(V1.5+ Développement)** | Suit son programme | `pilotGoalsService` → `pilot_goals` / `pilot_goal_events` ; couche Développement (passeport, cycles, carnet) = V1.5 |
| 30 | `coach/[id]` → réserver **(V1.5+)** | Réserve un créneau coach | `requestBooking` → `coaching_bookings` ; **paiement Stripe = V2** (`03_MVP_SCOPE`) |

---

## 2. Parcours Coach — `app/(coach)`

L'espace coach existe déjà et est riche. Phrase nord : « Le coach voit la profondeur. » Le coach lit, annote, programme — **jamais** il ne contourne le consentement pilote.

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 1 | `(coach)/profil` | Crée / édite son profil public | `coachProfileService` → `coach_profiles` |
| 2 | Validation admin | Attend la validation OXV | Statut de publication ; côté admin `coachAdminService` (voir §3) ; vue `coach_public_card` une fois publié |
| 3 | `(coach)/demandes` | Voit les demandes pilotes | `coachMarketplaceService.listCoachBookings` ; demandes d'affiliation et de réservation |
| 4 | `(coach)/demandes` → accepter | Accepte une affiliation | Crée le lien `coach_pilots` (vue `coach_pilots_view`) ; `respondToBooking` pour les réservations (`coaching_bookings`) |
| 5 | `(coach)/index` | Voit sa file de pilotes priorisée | `coachCurationService`, `coachReadingService` ; priorités `(coach)/priorites` |
| 6 | `(coach)/pilote/[id]` | Ouvre un pilote affilié | Vérifie le consentement (`coach_permissions`, RPC `coach_has_permission`) avant tout accès data |
| 7 | `(coach)/lecture` | Lit une session | `coachReadingService` / `coachReadingLogic` ; contexte session `coach_session_context` ; `coachSessionContextService` |
| 8 | `(coach)/annoter` | Annote un virage / segment (overlay) | `coachAnnotationsService` → `coach_annotations` ; gabarits `(coach)/gabarits` → `coach_annotation_template` ; repères `(coach)/reperes`, `repere/[index]` → `coach_corner_reference` |
| 9 | `(coach)/comparer` / `comparer-pilotes` | Compare tours ou pilotes | `coachReferenceService` ; comparaison réservée au coach (côté pilote, jamais de classement) |
| 10 | Programme / cycles **(V1.5+)** | Construit un programme | `pilotGoals` côté coach via `coach_objectives` / `coach_objective_events` ; Programme coach = V1.5 (`03_MVP_SCOPE`) |
| 11 | `(coach)/annoter` → note | Envoie une note au pilote | `coach_annotations` + `coach_pilot_highlight` ; s'affiche en **bande coach rouge** sur le `bilan` pilote. **Seul espace prescriptif de l'app**, formulé en question ouverte |
| 12 | `(coach)/roulages`, `roulages/[id]`, `roulages/nouveau` | Suit l'évolution / consigne ses propres roulages | `coach_roulages` |
| 13 | `(coach)/disponibilites` | Gère ses créneaux | `createAvailability` / `listMyAvailability` / `updateAvailabilityStatus` → `coach_availability` |
| 14 | `(coach)/demandes` → réservation **(V1.5+)** | Répond à une réservation | `respondToBooking` → `coaching_bookings` ; commission OXV = monétisation (V2 paiement Stripe) |
| 15 | `(coach)/business` | Suit son activité | `coachBusinessService` ; `(coach)/ar` (overlay AR), `(coach)/contexte` annexes |

Doctrine côté coach : le coach **peut** être prescriptif (c'est son métier), mais uniquement dans la bande coach, et toujours dans un cadre de consentement (`17_JURIDIQUE_COACH_DATA` à écrire). L'app pilote, elle, reste un miroir.

---

## 3. Parcours Admin — `app/(admin)`

Phrase nord : « L'admin voit le système. » Opérations événement, équipements, qualité data, validation coachs et partenaires. Plusieurs briques sont **net-neuves** (cf. `02_AUDIT_ROUTES` : manquent qualité data, incidents, partenaires-validation, reporting).

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 1 | Créer un événement **[NET-NEUF]** | Crée un track day | Le portail web admin portera les opérations lourdes (reco `18_APP_VS_WEB`) ; **table événement à confirmer — nécessite accord Gabin** ; lié à `registrations` / `demandes_inscription` |
| 2 | `(admin)/preparation` | Prépare l'événement | Vue préparation ; pilotes attendus |
| 3 | `(admin)/preparation` → valider pilotes | Valide les inscriptions | RPC `admin_validate_inscription` ; revue demande via `admin_review_demande` ; tables `demandes_inscription`, `registrations` ; trace `admin_audit` |
| 4 | Affecter un RaceBox **[NET-NEUF]** | Attribue un boîtier à un pilote | Affectation équipement ; **table d'inventaire boîtiers à définir — nécessite accord Gabin** |
| 5 | `(admin)/en-cours` | Suit les connexions en direct | Suivi opérationnel ; sessions actives `telemetry_sessions` |
| 6 | Qualité data **[NET-NEUF]** | Vérifie la qualité des captures | Contrôle complétude / intégrité ; s'appuie sur `telemetry_sessions` / `telemetry_frames` / `laps` ; **écran net-neuf** |
| 7 | Incidents **[NET-NEUF]** | Journalise un incident | **Écran et table incidents à définir — nécessite accord Gabin** |
| 8 | `(admin)/coachs`, `coachs/[id]` | Valide / gère les coachs | `coachAdminService` ; publication `coach_profiles` → `coach_public_card` |
| 9 | Partenaires — validation **[NET-NEUF]** | Valide un partenaire | `partners` (existe) ; RPC `is_partner` ; **écran de validation net-neuf** ; `(admin)/points-carte` rattaché à La carte OXV |
| 10 | `(admin)/sessions-media` | Gère les médias d'événement | `session_media`, `media` ; `sessionMediaService` |
| 11 | `(admin)/circuit`, `routes-certification` | Gère circuit et certifie les tracés | `circuits`, `circuit_services` ; `scenic_routes` (belles routes V1.5) |
| 12 | `(admin)/analytique` + Reporting **[NET-NEUF]** | Lit l'analytique / produit un reporting | `analyticsService` ; **reporting consolidé net-neuf** (probablement web, cf. `18_APP_VS_WEB`) |

---

## 4. Parcours Partenaire — `app/(partner)` **[NET-NEUF intégral]**

L'espace partenaire **n'existe pas** (`02_AUDIT_ROUTES`). Phrase nord : « Le partenaire voit les opportunités. » V1 = annuaire ; V1.5 = offres / leads / réservations / performance.

| # | Écran | Action utilisateur | Réaction système |
|---|---|---|---|
| 1 | Profil partenaire **[NET-NEUF]** | Crée son profil | S'appuie sur `partners` (champs `partner_type`, `is_official_partner`, `circuit_id` existants) ; **tout écran à créer ; rôle `partner` déjà dans l'enum `user_role`** |
| 2 | Validation admin | Attend la validation OXV | Validé côté admin (§3.9) ; RPC `is_partner` |
| 3 | Visibilité événement (V1) | Apparaît dans l'annuaire / La carte OXV | `placesService`, `ecosystemService` ; `(app)/carte-oxv` côté pilote ; `(admin)/points-carte` |
| 4 | Offre **[NET-NEUF, V1.5+]** | Publie une offre | **Table offres à définir — nécessite accord Gabin** ; réservable côté pilote dans Club (V1.5) |
| 5 | Lead **[NET-NEUF, V1.5+]** | Reçoit un lead | `corporate_leads` (existe) à relier ; **flux lead partenaire à confirmer — nécessite accord Gabin** |
| 6 | Traiter un lead **[NET-NEUF, V1.5+]** | Qualifie / répond | Statut de lead ; vraisemblablement portail web (`18_APP_VS_WEB`) |
| 7 | Performance **[NET-NEUF, V1.5+]** | Lit sa visibilité / ses conversions | Reporting partenaire ; monétisation lead / abonnement / commission (`03_MVP_SCOPE`, V2) |

---

## 5. Synthèse — table par parcours et statut

| Rôle | Du… au… | Écrans réels mobilisés | Net-neuf majeur | V1.5+ |
|---|---|---|---|---|
| Pilote | compte → cycle | `index`, `equipement`→`bilan-pret`, `bilan`, sous-vues Data Lab, `progression`, `coachs`, `mon-coach` | Data Lab (assemblage), Pass OXV | Pass OXV, Garage, Cycles, réservation, paiement (V2) |
| Coach | profil → évolution | `(coach)/profil`, `demandes`, `pilote/[id]`, `lecture`, `annoter`, `disponibilites`, `business` | overlay annotation assemblé | Programme/cycles, réservation, Stripe (V2) |
| Admin | événement → reporting | `(admin)/preparation`, `en-cours`, `coachs`, `sessions-media`, `circuit`, `analytique` | qualité data, incidents, validation partenaire, reporting, création événement | portail web admin |
| Partenaire | profil → performance | (aucun — annuaire via `carte-oxv` pilote) | **tout l'espace** | offres, leads, performance |

---

## 6. Garde-fous transverses (rappel)

- **Silence en piste** : l'étape de roulage n'affiche rien, ne notifie rien, ne sonne pas. Vérifié dans tout parcours pilote.
- **Consentement avant data coach** : aucun écran coach ne lit une session pilote sans `coach_permissions` (RPC `coach_has_permission`).
- **Or = donnée, rouge = coach/REC**, jamais sur la nav (actif `#F8F9FA` / inactif `#54545C`).
- **Aucun classement** côté pilote ; comparaisons uniquement personnelles ou consenties (`pilot_friendships`).
- **Schéma Supabase** : chaque table marquée **[NET-NEUF]** « nécessite accord Gabin » avant toute migration. Aucune n'est acquise.
