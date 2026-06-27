# App mobile vs portail web

> Stratégie de répartition entre les trois canaux d'OXV Platform : **app mobile** (Expo / React Native), **portail web** (back-office opérations + espace partenaire — à construire), **site public** (oxvehicle.fr — acquisition, réservation, vitrine).
> Réf. : `00_PLATEFORME_OXV.md §8` (« app mobile = terrain pilote + lecture coach rapide ; web = opérations lourdes + partenaires + business ; site public = acquisition + réservation + vitrine »), `01_ORGANISATION_PRODUIT.md`, `02_AUDIT_ROUTES.md`, `03_MVP_SCOPE.md`.
> Statut : **cadrage** (avant code). Aucune décision ci-dessous ne crée de schéma : les tables citées existent déjà (cf. `src/types/database.types.ts`). Toute table **net-neuve** est signalée « nécessite accord Gabin ».

---

## 0. Pourquoi ce document

Le plan empile des surfaces : bilan pilote, lecture coach, opérations admin, annuaire partenaire, réservation, paiement, création d'événements. La tentation est de tout faire entrer dans le mobile. Ce serait une erreur de doctrine **et** d'architecture :

- **Doctrine** : l'app pilote est un **miroir terrain** — calme, contextuelle, silencieuse en piste. Y greffer un tableur d'opérations ou un CRM partenaire la dénature.
- **Architecture** : les opérations lourdes (saisie longue, multi-écrans, exports, validation, facturation) sont pénibles au pouce et inadaptées à un usage paddock.

La règle directrice (`00 §1`) — *simple en surface, puissant en profondeur* — se traduit ici par : **chaque canal porte ce pour quoi il est bon, et rien d'autre.**

---

## 1. Questions tranchées

Six arbitrages bloquants. Chaque réponse cite la surface réelle (route existante ou table) et marque le canal **primaire**.

### 1.1 Réservation pilote (track day) — **où ?**

**Site public** (réservation/paiement) · **app mobile** = consultation + Pass OXV (V1.5).

- La donnée existe : table `registrations` (`offer_type`, `price_deposit`/`price_total`, `deposit_paid_at`/`balance_paid_at`, `slot_choice`, `insurance_option`, `heritage_pack_id`), adossée à `payments` (Stripe) et `pricing`.
- Le **funnel d'achat** (choix d'offre, acompte, assurance, CGV, paiement carte) appartient au **site public** : c'est de l'acquisition, soumis à un parcours marketing et juridique qui n'a pas sa place dans l'app pilote.
- L'**app mobile** affiche la sortie réservée dans le **Paddock** (« prochaine sortie », compte à rebours — `01 §Paddock`) et, en V1.5, présente le **Pass OXV** (QR événement). Elle ne porte **pas** le checkout en V1.
- `demandes_inscription` (demande d'inscription revue par admin via `admin_review_demande` / `admin_validate_inscription`) = également un parcours site public → back-office, pas mobile.

> **Implication** : aucun écran de paiement track day dans le mobile V1. Le mobile lit `registrations`, il ne les crée pas.

### 1.2 Inscription partenaire — **où ?**

**Portail web** (à construire) · jamais dans l'app pilote.

- Table `partners` : `owner_id`, `is_published`, `is_official_partner`, `partner_type`, `contact_email`, `media`, `lat`/`lon`. Le champ `owner_id` indique déjà une intention de **self-service partenaire**.
- L'inscription/édition d'une fiche partenaire (description, logo, offres, géoloc, publication) est une **opération longue** → **portail web partenaire** (espace `(partner)` net-neuf, prévu V1.5 côté dashboard — `02 §Écrans net-neufs`, `03`).
- Côté **app pilote**, les partenaires apparaissent **en lecture seule** dans **Club** (« partenaires autour du prochain événement », La carte OXV — `01 §Club`), alimentés par `partners` filtrés sur `is_published = true`.
- Les leads B2B (`corporate_leads`, `contact_messages`) arrivent par le **site public** (formulaire) et se traitent en **back-office web**.

> **Implication** : l'app mobile ne crée ni n'édite aucune fiche partenaire. Elle consomme l'annuaire.

### 1.3 Profil coach — **où ?**

**Double canal, rôles distincts** : édition pro = **app mobile espace `(coach)`** ; consultation pilote = **app mobile espace `(app)`** ; back-office de validation = **portail web admin**.

- Le coach **travaille déjà dans le mobile** : espace `(coach)` riche (`index`, `lecture`, `annoter`, `comparer`, `comparer-pilotes`, `contexte`, `demandes`, `disponibilites`, `gabarits`, `priorites`, `reperes`, `roulages`, `business`, `ar`, `profil`). Tables `coach_profiles`, `coach_availability`, `coach_pilots`, `coach_annotations`, `coach_reading_weights`.
- L'édition du **profil coach** et la gestion des **disponibilités** (`coach_availability`, écran `disponibilites` — déjà livré, cf. commit `e24f2dc`) restent dans le **mobile** : c'est de la **lecture/annotation rapide sur le terrain**, cœur du métier coach, conforme à la phrase nord (« le coach voit la profondeur »).
- Le pilote **consulte** la fiche coach dans **Club** : `mon-coach`, `coachs`, `coach/[id]` (`02 §Pilote`), via `coach_public_card` / `coachProfileService.ts` / `coachMarketplaceService.ts`.
- La **validation/modération** d'un coach (activation, conformité, qualité) relève de l'**admin** : écran `(admin)/coachs` + `(admin)/coachs/[id]` existent déjà en mobile, mais le **reporting et la curation lourde** ont vocation à migrer **web** (cf. §1.4).

> **Implication** : le profil coach reste éditable en mobile (usage terrain). Aucun « espace pro coach » web n'est requis en V1.

### 1.4 Admin — **mobile ou web ?**

**Mobile** = opérations **terrain le jour J** (existant, à garder) · **Web** = opérations **lourdes** (cible, à construire après V1).

- L'espace `(admin)` mobile existe et sert le **terrain** : `operations` (`preparation`, `en-cours`), `circuit`, `points-carte`, `sessions-media`, `routes-certification`, `coachs`, `analytique`. Ces écrans sont pertinents au paddock (préparer une journée, suivre l'en-cours, jumeler des équipements).
- Mais le **back-office lourd** n'a pas sa place au pouce : validation des `demandes_inscription`, gestion `payments`/refunds (Stripe), **qualité data** (`telemetry_sessions`, `telemetry_frames`, `sessions`), **incidents**, **validation partenaires** (`partners.is_published`), **reporting** (vues `stats_dashboard`, `day_rollups`, `history_rollups`). `02 §Admin` note explicitement ces manques (« qualité data, incidents, partenaires, reporting »).
- Reco : **garder l'admin terrain en mobile**, **construire l'admin lourd en web** (saisie longue, tableaux, exports, multi-fenêtres). Le portail web admin est marqué « Plus tard » dans `03` — donc **post-V1**, après le dashboard partenaire.

> **Implication** : on ne gonfle pas l'admin mobile avec du reporting/facturation. Ce qui est lourd attend le portail web.

### 1.5 Paiement — **où ?**

**Site public** (track day, acompte/solde) et **portail web** (régularisations, refunds) · **app mobile = jamais de checkout en V1**.

- `payments` est **adossé à Stripe** (`stripe_payment_intent_id`, `stripe_charge_id`, `stripe_invoice_id`, `payment_method`, `status`). Le paiement track day se fait à la réservation, sur le **site public** (§1.1).
- Le **paiement coach intégré (Stripe)** et la **commission partenaires** sont explicitement classés **V2** dans `03` — donc **hors V1**, et hors mobile pour l'instant. En V1.5, la **réservation coach** (`coaching_bookings`) peut exister **sans paiement in-app** (mise en relation, créneau retenu sur `coach_availability`).
- Raison de fond : un paiement in-app mobile déclenche les **commissions de store** (Apple/Google ~30 %) pour les biens numériques, et complexifie la conformité. Le **web/site** échappe à cette contrainte. Décision paiement in-app = **à soumettre à Gabin** le moment venu.

> **Implication** : aucun formulaire de carte dans le mobile V1. Le mobile peut **afficher un statut** de paiement (lecture `registrations`/`payments`), pas l'encaisser.

### 1.6 Création d'événements (track days) — **où ?**

**Portail web** (cible) · **app mobile admin** = lecture + préparation terrain seulement.

- Les `sessions` (au sens événement track day — à ne pas confondre avec `telemetry_sessions`) et leur `pricing`, `slot_choice`, fenêtres de réservation, sont des **objets de planification** : création/édition longue, multi-champs, calendrier → **portail web admin**.
- L'app **admin mobile** prépare l'événement **le jour J** (`preparation`, `en-cours`) et consulte, mais **ne crée pas** le catalogue d'événements à froid.
- Tant que le portail web n'existe pas, la création passe par l'outillage Supabase/back-office actuel de Gabin (hors app). **Aucune table net-neuve requise.**

> **Implication** : pas d'éditeur de création d'événement dans le mobile.

---

## 2. Recommandation — rôle de chaque canal

| Canal | Vocation | Public | Ne porte PAS |
|---|---|---|---|
| **App mobile** (Expo/RN) | Expérience **pilote terrain** (préparer, rouler en silence, comprendre le bilan, évoluer, club) + **lecture/annotation coach rapide** + **opérations admin du jour J** | Pilote, Coach, Admin (terrain) | Checkout, CRM, reporting lourd, création d'événements, édition fiche partenaire |
| **Portail web** (à construire) | **Opérations lourdes** (qualité data, incidents, validation inscriptions/partenaires, reporting, facturation/refunds) + **espace partenaire** (fiche, offres, leads) + **création d'événements** | Admin, Partenaire | Données télémétriques fines pilote (restent dans l'app), expérience de roulage |
| **Site public** (oxvehicle.fr) | **Acquisition** + **réservation/paiement track day** + **vitrine** (offres, circuit, coachs, partenaires) + collecte leads | Prospects, pilotes (achat) | Bilan post-session, annotation coach, opérations internes |

**Phrase de répartition** (à graver) :
> Le **site** fait venir et fait payer. Le **mobile** fait vivre la journée et lire la session. Le **web** fait tourner les opérations et le business.

Cohérence avec les **4 comptes** (`00 §2`) :

| Compte | App mobile | Portail web | Site public |
|---|---|---|---|
| **Pilote** | **primaire** (tout le parcours terrain) | — | secondaire (réserver, payer, s'inscrire) |
| **Coach** | **primaire** (lecture, annotation, dispos, profil) | secondaire (V2 : facturation, reporting business) | vitrine (fiche publique marketing) |
| **Admin** | terrain le jour J | **primaire** (opérations lourdes, qualité data, validation) | — |
| **Partenaire** | — (apparaît seulement en lecture côté pilote) | **primaire** (fiche, offres, leads, perf) | vitrine (apparaît dans l'annuaire) |

---

## 3. Tableau Fonction × Canal

Légende : **●** primaire · **○** secondaire (lecture/relais) · **—** absent. Surfaces réelles citées (route `(app)`/`(coach)`/`(admin)` ou table).

| Fonction | Mobile | Web | Site | Surface réelle |
|---|:--:|:--:|:--:|---|
| Préparer une session (équipement) | ● | — | — | `(app)/equipement` |
| Rouler en piste (silence total) | ● | — | — | `(app)/roulage` (UI éteinte, voyant REC) |
| Bilan post-session (marge globale) | ● | — | — | `(app)/bilan`, `app_session_analyses` |
| Data Lab (carte, virages, tours, heatmap, replay) | ● | — | — | `(app)/carte,virage,tours,heatmap,replay,telemetry` |
| Progression / signature / régularité | ● | — | — | `(app)/progression`, `pilotSignatureService`, `regularityService` |
| Comparateur personnel (soi vs soi) | ● | — | — | `(app)/comparateur` |
| Club : mon coach / découverte coachs | ● | — | ○ (vitrine) | `(app)/mon-coach,coachs,coach/[id]` |
| Annoter une session pilote (coach) | ● | — | — | `(coach)/annoter`, `coach_annotations` |
| Lecture priorisée des sessions affiliées (coach) | ● | — | — | `(coach)/lecture,priorites`, `coachReadingService` |
| Disponibilités coach | ● | — | — | `(coach)/disponibilites`, `coach_availability` |
| Profil coach (édition pro) | ● | — | ○ (fiche publique) | `(coach)/profil`, `coach_profiles` |
| Business coach (suivi activité) | ● | ○ (V2 reporting) | — | `(coach)/business`, `coachBusinessService` |
| Opérations événement (jour J) | ● | ○ | — | `(admin)/preparation,en-cours` |
| Qualité data (sessions/frames) | ○ | ● | — | `telemetry_sessions`, `telemetry_frames`, `sessions` |
| Validation inscriptions | — | ● | ○ (formulaire) | `demandes_inscription`, `admin_validate_inscription` |
| Validation / modération partenaires | ○ | ● | — | `partners.is_published`, `(admin)/coachs` (motif) |
| Reporting / dashboard business | — | ● | — | `stats_dashboard`, `day_rollups`, `history_rollups` |
| **Réservation track day** | ○ (lecture) | ○ (régul.) | ● | `registrations`, `pricing`, `sessions` |
| **Paiement (Stripe)** | — | ○ (refunds) | ● | `payments` |
| **Inscription partenaire (fiche)** | — | ● | — | `partners` (`owner_id`) — espace `(partner)` net-neuf |
| Offres / leads partenaires | ○ (lecture V1.5) | ● | ○ (affichage) | `partners`, `corporate_leads`, `contact_messages` |
| **Création d'événements** | ○ (lecture) | ● | — | `sessions`, `pricing` |
| Pass OXV (QR événement) | ● (V1.5) | — | ○ (génération) | net-neuf — **nécessite accord Gabin** |
| Vitrine / contenu éditorial | — | — | ● | `articles` |
| Médias d'événement / OXV Moment | ● (partage) | ○ (admin upload) | ○ (galerie publique) | `(app)/partage,carte-trophee`, `session_media`, `media` |

> **Lecture du tableau** : tout ce qui est **●** en mobile sert le **terrain** ou le **post-session**. Tout ce qui est **●** en web est **lourd, administratif ou commercial**. Le site concentre **acquisition + transaction**. Aucune fonction n'est **●** sur deux canaux à la fois — un seul canal porte la responsabilité, les autres relaient en lecture.

---

## 4. Implications — ce qui N'est PAS dans le mobile

Liste explicite, à opposer à toute demande de fonctionnalité future.

**Jamais dans l'app mobile (V1, et probablement au-delà)** :

1. **Aucun checkout / formulaire de carte.** Le paiement track day = site public ; coach/partenaire = V2, à soumettre. Évite les commissions de store et la conformité PCI in-app.
2. **Aucune création/édition de fiche partenaire.** `partners` se gère au portail web (`owner_id` = self-service web). Le mobile lit `is_published = true`.
3. **Aucune création d'événement track day.** `sessions` + `pricing` se créent en back-office web. Le mobile admin prépare le jour J, il ne bâtit pas le catalogue.
4. **Aucun reporting / dashboard business lourd.** `stats_dashboard`, rollups, exports comptables → web. L'`analytique` admin mobile reste une **lecture terrain** légère.
5. **Aucune validation administrative longue.** `demandes_inscription`, refunds `payments`, modération partenaires → web.
6. **Aucun CRM / gestion de leads partenaires.** `corporate_leads`, `contact_messages` → back-office web ; entrée par formulaire site.
7. **Aucune saisie multi-écrans à froid au bureau.** Tout ce qui se fait mieux assis devant un grand écran reste web.

**Reste pleinement dans le mobile** : le parcours pilote complet (Paddock → Session → Bilan → Progression → Club + Compte), la lecture/annotation/dispos coach, et les opérations admin du **jour de l'événement**.

**Garde-fous transverses** (rappel `00 §5`, doctrine) :

- L'app **montre, ne dirige pas** : aucun verbe prescriptif côté pilote, y compris dans les écrans de relais (réservation, statut paiement) — formulation neutre et factuelle.
- **Silence total en piste** : aucun canal ne pousse de notification pendant le roulage (`01 §Session`).
- **Or = donnée**, **rouge = coach/REC**, un seul chiffre dominant/écran — sur **tous** les canaux qui afficheront de la donnée pilote.
- **Vouvoiement**, **aucun emoji**, partout.

---

## 5. Dépendances net-neuves à soumettre

| Élément | Canal | Statut schéma |
|---|---|---|
| Espace `(partner)` (dashboard, offres, leads) | Web (+ relais lecture mobile) | tables `partners`/`corporate_leads` **existent** ; objets « offres » dédiés = **nécessite accord Gabin** |
| Portail web admin (qualité data, incidents, reporting) | Web | s'appuie sur tables/vues **existantes** ; éventuelle table `incidents` = **nécessite accord Gabin** |
| Pass OXV (QR événement) | Mobile (V1.5) | table/colonne dédiée = **nécessite accord Gabin** |
| Réservation coach (`coaching_bookings`) sans paiement | Mobile (V1.5) | table **existe** (`coaching_bookings`, `coach_availability`) — pas de schéma neuf |

> Aucune ligne ci-dessus n'est acquise. Tout ajout de schéma Supabase passe par l'accord explicite de Gabin (`00 §6`).
