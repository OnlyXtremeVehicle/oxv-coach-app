# OXV — Cartographie fonctionnelle par rôle (2026-07-07)

> Généré par analyse du code réel (workflow 5 agents). Plateforme **mono-rôle** :
> `public.users.role ∈ {pilot, coach, partner, admin}` (+ `pro_pilot`). Le routing
> (`app/index.tsx`) envoie chaque rôle dans son espace. Supabase projet
> `fouvuqkdxarjpjbqnsjq` (eu-west-1 / Frankfurt), **partagé avec le site oxvehicle.fr**.

---

## 1. PILOTE — « le miroir de conduite » (`app/(app)/`)

**Objectif de l'espace** : après chaque séance, une lecture posée et qualitative de sa
conduite. *Miroir, pas coach* : décrit, ne prescrit jamais. Sécurité > perf,
silence en piste, un seul chiffre dominant, or = donnée, **self-only** (soi contre
soi, jamais de rang inter-pilotes), **QDI 5 branches jamais composite** (T6).

### A. Le miroir (lecture post-séance)
| Fonction | Écran | Objectif | Supabase |
|---|---|---|---|
| Paddock (accueil) | `index` | Entrée narrative selon l'état (S5 silence / S4 countdown / passif) ; chiffre roi = régularité au tour | `telemetry_sessions`, `laps` |
| Trace narrative | `trace` | Un seul fait dominant (best-lap) + moment retenu, portes vers le détail | `telemetry_sessions`, `trace_narratives` |
| Bilan de séance | `bilan` | 1re vraie lecture : instrument régularité + meilleur tour + 4 piliers + moments factuels | `app_session_analyses`, `app_segment_analyses`, `telemetry_frames` |
| Signature de pilotage | `signature` | Portrait neutre du style + **radar QDI 5 branches** (self-reference) + empreinte dans le temps | `qdi` (app_session_analyses.qdi), `app_segment_analyses`, `pilot_signature_snapshots` |
| Progression | `progression` | Courbe du meilleur tour séance après séance (soi contre soi, jamais une note) | `telemetry_sessions.best_lap_seconds` |
| Régularité / Constance | `regularite` | Écart-type des tours (dispersion) + barres par tour | `laps` |
| Empreinte saison | `empreinte-saison` | Constats juxtaposés séance après séance, **jamais une courbe d'évolution** | `pilot_signature_snapshots` |
| Passeport / Statistiques | `passeport`, `stats` | Identité piste cumulative + agrégats larges (soi seul) | `telemetry_sessions`, snapshots |

### B. Data Lab (analyse approfondie, sous le Bilan)
| Fonction | Écran | Objectif |
|---|---|---|
| Index Data Lab | `data-lab` | Menu neutre des 7+ lectures ; confiance de lecture affichée |
| Carte du circuit | `carte` | Tracé + trajectoire GPS réelle + virages coloriés par marge (rouge→ambre canon) |
| Zoom virage | `virage` | Vitesses entrée/apex/sortie, forces G, écart au tracé de référence |
| Comparer un virage | `virage-comparer` | Deux tours côte à côte sur un même virage |
| Tour par tour | `tours` | Chronos, delta vs best, best-lap en or |
| Carte de chaleur | `heatmap` | Vitesse froid→chaud (jamais rouge) |
| Rejouer un tour | `replay` | Scrub manuel du tour (pas d'autoplay) |
| Télémétrie | `telemetry` | Diagramme G-G, trace vitesse, throttle/brake |
| Insights | `insights` | Lectures qualitatives narratives |
| Comparateur | `comparateur` | 2 sessions du pilote comparées |

### C. Ressenti & réflexion (subjectif, jamais suggéré)
`conditions` (faits météo + ressenti libre) · `carnet` (page blanche, zéro suggestion) ·
`prochaine-fois` · `objectifs` (repères perso) · `entre-runs` · `pilotage-fini` ·
`debrief-presentiel` (notes partagées coach+pilote).

### D. Équipe & social (self-only strict)
`amis` (par @handle, aucun score) · `cote-a-cote/[friendId]` (2 sessions d'amis, aucun gagnant) ·
`mon-coach` (**consentement RGPD** : toggle par coach) · `debrief-presentiel`.

### E. Découverte / marketplace
`partenaires` (offres publiées, demande opt-in de contact) · `roulages` (invitations coach, accepter/décliner) ·
découverte coachs (fiche publique).

### F. Événement / logistique jour J
`preparation` (checklist, météo) · `placement` (zone/voie) · `pass-oxv` · `carte-licence` ·
`carte-oxv` (carte piste temps réel) · `pilotage-fini`.

### G. Médias & partage
`session-media/[id]` (galerie OXV) · `carte-trophee` (souvenir partageable) · `belle-route` / `mes-routes` (routes touristiques).

### H. Compte & réglages (hub icône Compte)
`compte`, `profil`, `settings`, `notifications`, `consentements` / `donnees-securite` (RGPD, export, appareils),
`garage` (véhicules), `mon-equipement` / `equipement` (boîtier RaceBox : jumelage, santé),
`circuits` / `circuit/[id]`, `support/[id]` / `mes-demandes`.

---

## 2. COACH — « le miroir de guidance » (`app/(coach)/`)

**Objectif** : lire les séances de SES pilotes (consentis), annoter, orienter — **sans
remplacer le miroir**. La voix du coach apparaît côté pilote *attribuée* (bande rouge).
Le coach est humain : il peut viser ; l'app ne prescrit jamais à sa place.

| Fonction | Écran | Objectif | Lien inter-rôle |
|---|---|---|---|
| Hub / Poste de pilotage | `index` | Pilotes assignés + alertes 24h + accès outils | lit le 1er niveau du pilote |
| File de lecture | `file-lecture` | Séances à lire (statut lu/archivé), entrée Studio/Rapport | `coach_queue` |
| **Studio** | `studio` | Lecture télémétrique dense : radar QDI + triage + marges + moments | `getStudioSession` (P0) |
| **Triage** | `triage` | Carte + liste : virages classés par marge, « où regarder » (fait seul, C3) | `coachTriageService` |
| **Débrief** (présentation) | `debrief` | Vue calme lecture seule à montrer au pilote côte à côte | `getStudioSession` |
| **Rapport PDF** | `rapport` | Le coach rédige SON bilan → PDF (QDI + faits + bilan attribué), envoi pilote | `coachReportPdfService` (expo-print) |
| **Plan d'objectifs** | `plan` | Assigne des objectifs mesurables (métrique+direction+cible) au pilote | `coach_objectives` |
| Annoter | `annoter` | Note sur un virage (texte + mémo vocal), visible pilote si partagée | `coach_annotations`, audio |
| Priorités | `priorites` | Virages mis en avant sur le bilan du pilote | `coach_pilot_highlight` |
| Repères de virage | `reperes` | Points de freinage/vitesse de référence, superposés côté pilote | `coach_corner_reference` |
| Ma lecture | `lecture` | Pondère 4 composantes → sa grille, affichée séparément côté pilote | `coach_reading_weights` |
| Gabarits | `gabarits` | Textes réutilisables (confort de saisie) | `coach_annotation_template` |
| Assistant IA (C-1) | `assistant` | L'IA pré-rédige une observation factuelle → le coach valide (jamais auto-publié) | `coach_ai_drafts` |
| Programmes (C-2) | `cycles` | Cycles qualitatifs pour un pilote niveau 'programme' | `pilot_development_cycles`, `cycle_steps` |
| Fiche pilote (**CRM**) | `pilote/[id]` | Sessions + notes partagées + empreintes + véhicule (lecture seule) | `coach_pilots_view`, `pilot_notes` |
| Contexte | `contexte` | Cadrage non-confidentiel de la séance (niveau, objectif, conditions) | `coach_session_context` |
| Comparer / Comparer-pilotes | `comparer`, `comparer-pilotes` | 2 séances ou 2 pilotes (pas de rang, factuel) | analyses |
| Fiche coach (profil public) | `profil` | Bio, photo, tarifs — publiée pour les pilotes | `coach_profiles`, `coach_public_card` |
| Disponibilités / Demandes | `disponibilites`, `demandes` | Créneaux ouverts + boîte de réception des demandes | `coach_availability`, `coaching_bookings` |
| **Calendrier** | `calendrier` | Agenda : séances confirmées + créneaux à venir | `coaching_bookings` + `coach_availability` |
| **Facturation** (P2) | `facturation` | Le CHOIX d'aider à établir SES factures (émetteur = coach, paiement direct) | `coach_invoices`, `coach_profiles` |
| Business / Roulages | `business`, `roulages` | Activité (revenus cumulés) + gestion de roulages-coach | `coach_roulages` |
| Vue AR (aperçu E0.1) | `ar` | Faits au bord de piste (lunettes Ray-Ban), jamais un miroir en roulage | WebView |

---

## 3. PARTENAIRE — B2B marketplace (`app/(partner)/`)

**Objectif** : un partenaire (garage, photographe, hôtel, école…) publie des offres et
reçoit des **leads consentis** — **sans jamais voir la télémétrie ni l'identité** du pilote.

| Fonction | Écran | Objectif | Lien |
|---|---|---|---|
| Tableau de bord | `index` | Statut compte + nb offres + leads nouveaux | pilote découvre les partenaires validés |
| Mes offres | `offres` | CRUD offres (prix affiché, quota, validité, catégorie) | pilote consulte via `(app)/partenaires` |
| Mes leads | `leads` | Demandes de contact CONSENTIES (jamais d'identité/télémétrie) | `partner_leads` (pilote crée le lead) |
| Performance | `performance` | Agrégats dérivés (demandes par statut), pas de donnée pilote | — |
| Ma fiche | `profil` | Zone desservie + description publiée | pilote voit la fiche enrichie |
| Facturation | `facturation` | Transparent : prix affiché, non encaissé (Stripe = phase future) | — |
| Mes rapports (B2B) | `rapports` | Rapports d'événement partagés par l'admin (inscrits/présents) | **admin** génère le rapport |

Côté pilote : `(app)/partenaires.tsx` = découverte + demande opt-in.
Côté admin : `(admin)/partenaires.tsx` = **validation** des comptes (pending→validated).

---

## 4. ADMIN — la régie (`app/(admin)/`)

**Objectif** : opérer la plateforme. `is_admin()` (SECURITY DEFINER) contourne la RLS.
Identité de rôle cyan.

**Opérationnel jour J** : `tour-controle` (photo du jour) · `preparation` (inscrits, KYC, promotion coach) ·
`en-cours` (sessions en roulage) · `scan-checkin` (QR Pass OXV) · `presences` (pointage → KPI site) ·
`devices` (parc RaceBox, santé, alias) · `evenements` (créer/gérer, inscriptions).

**Données & qualité** : `qualite-data` (frames/analyses manquantes) · `sessions-media` (dépôt photos/vidéos) ·
`analytique` (métriques business) · `circuit` (topologie Haute-Saintonge).

**Communauté & modération** : `utilisateurs` (annuaire, audit, suspension) · `coachs` (assignations, rétrogradation) ·
`partenaires` (validation) · `moderation` (signalements) · `support` (tickets P0→P3) · `ambassadeurs` ·
`routes-certification` (belles routes) · `points-carte` (La carte OXV publique) · `b2b-rapport` (éditeur rapport partenaire).

**Système** : `maintenance` (kill-switch + version min) · `feature-flags` (active/désactive fonctions & algos).

---

## 5. CONNEXIONS INTER-RÔLES (tables pivots + RLS + consentement)

| De → Vers | Mécanisme | Objectif |
|---|---|---|
| **Pilote → Coach** | `coach_pilots` (pivot) + **consentement RGPD** `pilot_consent_at` ; fonction `is_coach_of(pilot)` (SECURITY DEFINER) | Autoriser un coach à LIRE la télémétrie/analyses du pilote consenti (7 policies SELECT) |
| **Coach → Pilote** | `coach_annotations` / `coach_pilot_highlight` / `coach_reading_weights` / `coach_corner_reference` / `coach_objectives` (unidirectionnel) | Partager observations attribuées (bande rouge), jamais des instructions de l'app |
| **Pilote ↔ Partenaire** | `partner_leads` (pivot) + `consent_contact=true` ; offres visibles si `partner_status=validated` | Le pilote signale un intérêt ; le partenaire le contacte — **jamais d'identité/télémétrie** |
| **Coach ↔ Coach** | `coaching_bookings` + `coach_availability` (marketplace Phase 1) | Un coach réserve le coaching d'un autre coach |
| **Pilote → Admin** | `moderation_reports` (polymorphe : coach_review, partner_offer) | Signaler du contenu ; suivre le statut |
| **Admin → Tous** | `is_admin()` (RLS bypass) | Valide `coach_pilots`, `partner_accounts`, modère, gère événements/devices |

**Garde-fous RLS** : le coach ne lit JAMAIS email/tel/KYC ; le partenaire ne voit JAMAIS la
télémétrie ; le pilote ne voit QUE ses données. Aucun rang inter-pilotes nulle part.

---

## 6. SUPABASE — architecture

- **Projet** `fouvuqkdxarjpjbqnsjq` (eu-west-1). RLS activée par rôle (`user_role` enum).
- **Tables pivots** : `coach_pilots`, `partner_leads`, `coaching_bookings`.
- **Fonction clé** : `is_coach_of(pilot_uuid)` (STABLE, SECURITY DEFINER) — utilisée par 7 policies SELECT (télémétrie, analyses, véhicules, partages).
- **RPC** : `next_coach_invoice_number(coach, year)` (facturation, séquence par coach).
- **Buckets Storage** : privés, **signés à la demande** (jamais publics par défaut) — médias pilote/coach/session.
- **Edge Functions** : rituels J-7/J-2/J-1 (génération OpenAI + ElevenLabs, envoi Resend, webhooks `apply_resend_event`) ; `generate-debrief-ai` ; `send-coach-invitation`.
- **Auth** : `supabase.auth` + email vérifié + 2FA optionnel (`two_factor_enabled`).

---

## 7. SITE oxvehicle.fr — liaisons (Supabase PARTAGÉ)

- **Même projet Supabase** que l'app. Le site possède `registrations` (attended/cancelled),
  `sessions` (date, circuit_id, event_id), `events` (draft/public/closed/finished), `circuits`.
- **App écrit** `telemetry_sessions` → le **site lit** pour afficher la progression du pilote
  (paliers Access → Signature → Heritage selon le nb de séances).
- **App lit** `events`/`registrations` du site → écran check-in jour J (`attendanceService`,
  `attended_at`).
- **Deep links** `oxv://` (app) / `oxvcoach://` — ouvrent l'app depuis le site ou un lien partagé
  (ex. appairage coach `oxv://lier?code=`).
- **QDI méthodologie partagée** (5 branches, jamais composite) : trajectoire 30 % · fluidité 25 % ·
  freinage 20 % · accélération 15 % · régularité 10 % — cf. `docs/architecture/08_CONNEXION_PROGRESSION_SITE_APP.md`.
- **`circuit_id`** (FK circuits) sur `sessions` : à renseigner à la création d'une journée côté site.
- **Plausible** (`EXPO_PUBLIC_PLAUSIBLE_DOMAIN=oxvehicle.fr`) : analytique anonyme partagée.
- **Doctrine commune** : pas de leaderboard, progression personnelle uniquement.

---

*Nombres de fonctionnalités relevées : pilote 53 · coach 25 · partenaire 9 · admin 22.*
