# Vision « Studio Coach » — réconciliation avec l'existant et la doctrine

> Vision fondateur (2026-07-04) pour l'espace Coach premium : Studio
> télémétrique, débriefing interactif, CRM, monétisation. Ce document mappe
> chaque brique sur ce qui EXISTE déjà, signale les CONFLITS de doctrine, et
> propose un plan. **Rien n'est construit avant arbitrage des conflits.**

## 1. Ce qui existe déjà (l'espace coach est à ~65 % de cette vision)

| Vision | Déjà en place | Écran / brique |
|--------|---------------|----------------|
| Superposition tour pilote vs référence | ✅ | `comparer.tsx`, `comparer-pilotes.tsx` |
| Analyse data (freinage, G, trajectoire) | ✅ | `carte`, `virage`, GGViz, les 6 lectures |
| Diagramme G-G / enveloppe adhérence | ✅ | `GGViz` (lecture insight) |
| QDI automatique | ✅ | M1 (radar 5 branches, déterministe) |
| Smart Flagging (virages où ça chute) | ✅ partiel | `app_session_analyses.next_focus_corner_index` + key moments |
| Marqueurs / mémos vocaux sur le circuit | ✅ | `annoter.tsx` (texte + audio via expo-av) |
| Consigne ciblée au pilote (post-session) | ✅ | `priorites.tsx` (Focus), CoachBand côté pilote |
| CRM pilote (historique, réglages) | ✅ | `pilote/[id].tsx`, `contexte.tsx` |
| Carnet de notes / blocages | ✅ | `carnet` (pilote), notes coach |
| Business / CA / tarifs | ✅ partiel | `business.tsx` (gaté `can_view_business_dashboard`) |
| Facture PDF | ✅ infra | edge `generate-invoice` (déployée) |
| Gestion parc + batteries | ✅ | `admin/devices`, `device_health_logs`, alias flotte (M7.2) |
| Statut « qui est en piste / stands » | ✅ | `admin/tour-controle` (factuel) |
| Rapport de performance PDF | ✅ infra | `bilanPdfExportService` |

## 2. CONFLITS DURS (à trancher AVANT de construire)

### C1 — Live Leaderboard classant les pilotes par QDI
> **Percute le garde-fou n°1** : « aucune comparaison de deux pilotes par score ;
> tri par récence uniquement ». Un classement live des pilotes par QDI EST la
> comparaison inter-pilotes proscrite.
- **Autorisé** : une console coach montrant *qui est en piste / aux stands /
  nb de tours* (factuel, comme `tour-controle`).
- **Proscrit tel quel** : le *ranking par QDI*. Options : (a) garder proscrit,
  (b) autoriser un affichage COACH-privé non partagé aux pilotes, (c) remplacer
  le rang par un état individuel (« QDI de CHAQUE pilote vs SON propre historique »).

### C2 — Consigne au pilote pendant le run (HUD / radio / broadcast)
> **Percute le Principe 3 « Silence en piste »** : pendant que le véhicule roule,
> aucun écran/notification côté pilote.
- **Autorisé** : « Focus Target » entre deux runs (le pilote lit avant de repartir).
- **Proscrit** : pousser une consigne sur l'app pilote / un HUD PENDANT le run.
- Nuance : le *coach* peut voir des choses en direct sur SA tablette (pas le pilote).
  Le « broadcast fin de session dans 5 min » est une notification pilote **au
  stand**, pas en piste — acceptable si ciblée hors-roulage.

### C3 — Diagnostic causal automatique poussé (« Cause : réaccélération tardive »)
> **Décision 2026-07-04** : l'IA débriefe/calcule mais ne COACHE pas ; les
> conclusions appartiennent au coach humain (ou à une suggestion qu'il valide).
- **Autorisé** : Smart Flagging *factuel* (« Virage 2 : plus forte chute de QDI »).
- **À encadrer** : l'attribution de CAUSE (« réaccélération trop tardive ») doit
  être soit du coach, soit une **suggestion IA validée** (pipeline assistant
  existant), jamais une affirmation automatique présentée comme vérité.

### C4 — « Profil Psychologique » caché au pilote
> **Risque RGPD** : des inférences personnelles (« sur-conduit sous pression »)
> restent des **données personnelles du pilote** ; le droit d'accès s'applique.
> Un profil structurellement « caché » est exposé juridiquement.
- **Autorisé** : notes de travail privées du coach (comme un carnet).
- **À cadrer** : pas de catégorie « profil psychologique » opaque ; les notes
  restent accessibles au pilote sur demande (droit RGPD), et ne stockent pas de
  données sensibles (santé mentale) sans base légale.

### C5 — Sous-virage/survirage « via angle de braquage »
> **Honnêteté capteurs** : le boîtier (RaceBox Mini, GPS+IMU 25 Hz) n'a **pas de
> capteur d'angle volant**. Le lacet (yaw) est mesuré (gyro), pas le braquage.
- **Faisable** : estimer l'équilibre par le lacet vs le lacet attendu
  (vitesse/G latéral) — un proxy honnête.
- **Interdit** : afficher « angle de braquage » comme une mesure. Le bloc méthode
  doit dire que c'est une estimation (comme le proxy QDI).

## 3. DÉPENDANCES (bloquent l'activation, pas la construction)

- **Paiement in-app / déverrouillage / factures** : **SIRET requis** (décision M2 :
  « rien ne s'active avant le SIRET »). On peut construire derrière un feature
  flag ; rien n'encaisse tant que le SIRET n'est pas là. Stripe Connect (marketplace
  Phase 2) partiellement en place.
- **Décharges (waivers) e-sign** : nouveau, **légalement sensible** — nécessite le
  texte juridique validé + capture de signature + stockage horodaté.
- **Split-screen vidéo/data** : nécessite une intégration caméra (non faite) ;
  la banque média existe (`session-media`).
- **Live en direct (leaderboard, G-G live, QDI temps réel)** : le RaceBox
  **enregistre puis synchronise** — le « temps réel via cellulaire » est une
  autre architecture (streaming) non en place. Le « à chaud » actuel = sync à
  l'arrêt moteur (déjà le workflow visé).
- **Balise HUD** : matériel non intégré.

## 4. Plan par phases proposé (après arbitrage des conflits)

- **P0 — Assembler l'existant en « Studio »** (zéro schéma, zéro conflit) : réunir
  comparer + G-G + carte + annoter + Smart Flagging factuel + QDI dans un parcours
  coach fluide (le workflow 6 étapes). Fort ROI, faisable tout de suite.
- **P1 — Débriefing 2.0** : marqueurs sur circuit (existe) + suggestion IA validée
  pour la cause (encadré C3).
- **P2 — Monétisation** : préparer paiement/facture derrière feature flag (gaté SIRET).
- **P3 — Waivers e-sign** (légal à valider).
- **P4 — Console de direction** : version *factuelle* (statut, pas ranking — C1).
- **P5 — Vidéo/HUD/live** : dépendances matérielles + architecture streaming.

## 5. Décisions ACTÉES (fondateur, 2026-07-04)
1. **C1 — Console = état individuel, PAS de rang.** Factuel (en piste/stands/tours)
   + QDI de chaque pilote vs SON propre historique. Aucun classement inter-pilotes.
2. **C2 — Consigne pilote = entre les runs seulement.** Silence en piste tenu ;
   HUD pendant le run écarté.
3. **C3 — Smart Flagging = FAIT + suggestion IA validée par le coach.** L'appli
   signale le fait (virage à plus forte chute) ; la CAUSE est une suggestion IA
   que le coach valide/édite avant le pilote. L'IA n'affirme jamais seule.
4. **C4 — Notes privées accessibles (RGPD).** Pas de « profil psycho » opaque ;
   notes de travail du coach, accessibles au pilote sur demande, sans données
   sensibles sans base légale. *(défaut appliqué)*
5. **C5 — Équilibre par proxy lacet assumé.** Pas d'« angle volant » (capteur
   absent) ; estimation lacet vs attendu, dite dans le bloc méthode. *(défaut appliqué)*
6. **Monétisation coach — paiement DIRECT au coach, HORS OXV (2026-07-04).**
   OXV n'encaisse ni ne facture la prestation (pas d'intermédiaire de paiement).
   L'app = outil de suivi (montant + statut réglé + lien de paiement du coach).
   Rému OXV côté coach = abonnement SaaS. Le SIRET OXV ne bloque pas cette part.

## 6. Construit / en cours
- **P0 (cœur) — Smart Flagging factuel** ✅ : `coachTriageLogic` (pur, testé) +
  `coachTriageService` + `coachStudioService.getStudioSession` (agrégation
  triage + QDI + marges + moments-clés). FAIT seul (C3). UI avec la refonte.
- **P1 — Débriefing 2.0** : backend PRÊT (le triage donne le cornerIndex,
  `annoter` l'accepte, l'assistant IA suggère la cause validée coach). Reste =
  câblage UI (avec la refonte).
- **P4 — Console factuelle** ✅ : `coachConsoleService` + `coachConsoleLogic`
  (pur, testé) — statut par pilote + tendance vs SA propre séance. Aucun rang (C1).
- **P5 — Vidéo/HUD/live** : BLOQUÉ (caméra, matériel HUD, architecture streaming
  absente). À rouvrir quand les dépendances physiques existent.

## 7. STOP-schéma — propositions P2 & P3 (à valider, RIEN appliqué)

Constat : `payments`/`invoices`/`generate-invoice` existent mais sont liés aux
INSCRIPTIONS (track day), pas aux prestations coach ; `coaching_bookings` n'a ni
montant ni paiement. Donc :

### P2 — Prestation coach : MODÈLE CORRIGÉ (2026-07-04, décision fondateur)
> **Le paiement de la prestation va DIRECTEMENT au coach — il NE passe PAS par
> OXV.** OXV n'est ni encaisseur, ni facturier, ni intermédiaire de paiement de
> la prestation (on évite le statut réglementé de prestataire de paiement). La
> rémunération d'OXV côté coach reste l'ABONNEMENT SaaS (450 €/saison), qui, lui,
> passe par nous. Le SIRET OXV ne bloque donc PAS la prestation coach (c'est la
> structure du COACH qui facture son pilote).

Conséquence : PAS de lien vers `payments`/`invoices` OXV, PAS de génération de
facture OXV pour la prestation. L'app est un **outil de suivi** pour le coach,
pas un canal de paiement. Schéma minimal (additif) :
```sql
-- Suivi de la prestation par le COACH (montant pour SON usage, statut qu'IL gère).
alter table public.coaching_bookings
  add column if not exists amount_cents integer,           -- prix convenu (tracking coach)
  add column if not exists billing_status text default 'none'
    check (billing_status in ('none','quote','settled'));  -- 'settled' = coach a été payé (hors app)
-- Lien de paiement PROPRE au coach (Lydia/Stripe/PayPal…), sur son profil.
alter table public.coach_profiles
  add column if not exists payment_link text;
```
- Le pilote paie via le **lien propre du coach** (ou tout moyen hors app) ; le
  coach marque `settled`. Aucun flux d'argent ne transite par OXV.
- **À TRANCHER (question fondateur)** : l'app aide-t-elle le coach à éditer SA
  propre facture (coach = vendeur, sa structure), ou reste-t-elle hors facturation
  (le coach facture avec ses propres outils) ?
- Ne touche PAS `payments`/`invoices` (réservés inscriptions/abonnements OXV). Pas
  de coordination site paiement requise.

### P3 — Waivers e-sign (table neuve — nécessite le TEXTE JURIDIQUE)
```sql
create table if not exists public.waivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),      -- le pilote signataire
  collected_by uuid references auth.users(id),          -- le coach/admin qui recueille
  document_key text not null,                           -- ex. 'decharge_responsabilite'
  document_version text not null,                       -- version du texte signé
  signed_at timestamptz not null default now(),
  signature_path text,                                  -- image de signature (bucket privé)
  evidence jsonb,                                        -- ip/user-agent (preuve)
  created_at timestamptz not null default now()
);
alter table public.waivers enable row level security;
create policy waivers_owner_select on public.waivers for select using (user_id = auth.uid());
create policy waivers_collector_select on public.waivers for select using (collected_by = auth.uid());
create policy waivers_admin_all on public.waivers for all using (is_admin());
create policy waivers_insert_self_or_collector on public.waivers for insert
  with check (user_id = auth.uid() or collected_by = auth.uid());
```
⚠ **Dépendance légale** : le contenu de la décharge + son versionnage doivent
être fournis/validés par le fondateur avant toute mise en service.
