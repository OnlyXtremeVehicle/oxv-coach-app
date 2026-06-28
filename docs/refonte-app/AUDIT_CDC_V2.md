# Audit d'écart — Repo OXV réel ⇄ Cahier des charges exécutable V2

> Source : `OXV_Platform_Cahier_des_Charges_Executable_V2.docx` (30 sections, T01-T13, PROMPT 1-5).
> Méthode : workflow multi-agents (8 dimensions auditées en parallèle → synthèse priorisée →
> critique de complétude adversariale). **Claims structurants vérifiés en code** (cités).
> Date : 2026-06-28. Aucun code modifié, aucun schéma touché par cet audit.

---

## Verdict — readiness V1 alpha (Valence, juillet 2026)

**PARTIELLEMENT PRÊTE.** Le noyau MVP strict (§1) — boucle pilote *capture → bilan → Data Lab*,
espace coach avec consentement RLS, admin de session — est **implémenté et fidèle à la doctrine**
(miroir descriptif, vouvoiement, zéro verbe prescriptif vérifié en code, un chiffre/écran,
EmptyState honnêtes, télémétrie jamais exposée au partenaire par *deny-by-default*).

**Deux bloqueurs P0** (doctrine / sécurité) empêchent la sortie d'alpha, plus **un jalon** dépendant du terrain :

| # | Bloqueur | DoD | Statut |
|---|---|---|---|
| **P0-1** | Silence en piste non garanti (handler de notif) | §30.3 / Principe 3 | **FERMÉ** — PR-A (`315ba93`), cf. [pr-09](../../roadmap/rapports/pr-09-coach-graded-access.md) |
| **P0-2** | Contrat de lecture coach aplati + tests RLS 3/60 | §30.2 / §6 / §23 | **CŒUR FERMÉ** — PR-B (gradué, migration `0014`). Reste P1 : étendre la matrice de tests RLS |
| **Jalon** | Build preview iOS+Android + test terrain bout-en-bout | §30.8-9 | dépend de Valence (non codable) |

> **Réserve transverse** : `telemetry_frames = 0` en prod → toute la profondeur Data Lab tourne en
> **mode DÉMO** jusqu'à la première capture à Valence. La chaîne complète n'est pas validable avant.

L'espace partenaire, devices/qualité-data, Passeport/Pass OXV, Data Lab unifié **ne bloquent pas
l'alpha** (P1/P2, cohérent backlog §19).

---

## P0 — bloqueurs alpha

### P0-1 · Passerelle « silence en piste » sur le handler de notifications  *(S, zéro schéma)*
- **Existe** : `pushNotificationsService.ts` L34-40 — `setNotificationHandler` renvoie
  `{shouldShowAlert:true, …}` **en dur**. La tab bar est bien masquée en `S6_roulage`
  (`appMap.shouldShowTabBar`), le son est déjà coupé.
- **Manque** : `handleNotification` **ne consulte jamais l'état pilote**. Un push *remote*
  (coach/ami) reçu en roulage afficherait une bannière → **violation Principe 3** (non négociable).
  Aucun garde-fou non plus côté programmation locale (le service note L12-14 que c'est « la
  responsabilité de l'appelant », jamais vérifiée).
- **Correctif** : brancher `handleNotification` sur le store d'état pilote → `shouldShowAlert/Sound/Badge = false`
  en roulage ; idem garde-fou sur `scheduleSessionReminder/Debrief`. Test « push reçu en S6 ne s'affiche pas ».
  **Aucun accord requis** (bug doctrine). À faire **avant tout test terrain**.

### P0-2 · Contrat de lecture coach gradué + tests RLS par rôle  *(S→M, schéma si gradué — DÉCISION GABIN)*
- **Existe** : accès **binaire** `coach_pilots.active + pilot_consent_at`, gate `is_coach_of()`
  (`SECURITY DEFINER`) — coupe immédiatement à la révocation (couvre §10.1 cas 1&2). RLS active sur **60/60** tables.
- **Manque** : `coach_pilots` **n'a pas de colonne `level`** (vérifié `database.types.ts` L1120-1133) ;
  `telemetry_sessions_coach_select` **et** `telemetry_frames_coach_select` utilisent tous deux
  `is_coach_of()` **sans niveau** (migration `20260525114148` L116-129). Donc **tout coach consenti
  voit TOUTES les frames**, contrairement à §23 (frames seulement si `lecture_detaillee/programme`).
  Et seules **3 tables sur 60** ont un test RLS (`coachSessions`, `coachAnnotations`, `pilotFriendships`).
- **Décision Gabin requise** : **(a)** conserver le binaire (plus simple, conforme MVP — *documenter + tester*)
  **ou (b)** ajouter `coach_pilots.level` + policies frames≠sessions différenciées (*migration prod → accord*).
- **Dans les deux cas** : étendre la suite RLS (`src/__tests__/rls/`) aux tables sensibles non couvertes
  (`app_session_analyses`, `telemetry_frames` accès ami, `session_media`, `pilot_goals`, `duels`, `coach_*`),
  matrice rôle-par-rôle incluant « partner ne voit jamais de télémétrie » et « admin pas de lecture sauvage des frames ».

---

## P1 — post-alpha proche (backlog §19)

| Item | Existe déjà | Manque | Effort | Schéma |
|---|---|---|---|---|
| **Instrumentation KPI §27** — **FAIT (PR-C)** | `OxvEvent` catalogue + 6 events câblés (`onboarding_termine`, `capture_reussie/echouee`, `bilan_ouvert`, `datalab_couche_ouverte`, `coach_consentement_donne`, `coach_note_envoyee`) | Reste : config `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` (sinon no-op) ; `data_anomaly_rate`/`partner_lead_rate` attendent leurs tables | — | non |
| **Audit changement de rôle** — **FAIT (PR-A')** | trigger `trg_audit_user_role_change` → `admin_audit` (migration `0015`) | — | — | — |
| **Admin Qualité Data** — **FAIT (PR-D)** | écran `qualite-data` + `adminQualityService` (détection dérivée) + table `data_quality_reports` (migration `0016`) | Reste : notif admin « Anomalie data » ; `data_anomaly_rate` mesurable une fois des reports créés | — | — |
| **Tables `devices` + `device_assignments`** — **FAIT (PR-D)** | tables créées + `source_device_id` (migration `0016`) | Reste : écran Équipements (CRUD/affectations) — ébauche, tables prêtes | — | — |
| **`dataLabService` (orchestrateur)** — **FAIT (PR-E)** | agrégateur `getDataLabSessionView` + `dataLabLogic` (pur, testé) ; `data-lab.tsx` affiche état vide honnête + disponibilité par couche | Reste : workspace unifié (graphes synchronisés sur une même vue) — refinement build | — | non |
| **File de lecture coach §6.2** — **FAIT (PR-E)** | écran `(coach)/file-lecture` (À lire / déjà lues, dérivé des annotations) + lien hub coach | Reste : filtres anomalie/média, deep-link session, hub « Piste » pilote | — | non |
| **`coachAccessService`** | contrôle d'accès 100% en RLS | Pas de service `{accessLevel, allowed}` testable au niveau code (couplé à P0-2) | S | non |

---

## P2 / later — V1.5+

- **`src/navigation/spaces.ts` + maps par rôle** (T02) : multi-espaces déjà via groupes expo-router + role-guards ;
  manque la couche déclarative `pilotMap/coachMap/adminMap/partnerMap` (artefact spec, pas une réécriture). *(P2)*
- **Passeport OXV + Pass OXV §25** : passeport éclaté (signature/progression/profil) ; **Pass OXV totalement absent**
  (écran/route/service/QR check-in). *(P2/V1.5, schéma)*
- **Programmes/cycles coach + `developmentCycleService`** : `coach_objectives` existe mais **orpheline** (aucun service) ;
  pas de cycle à étapes. Risque double source de vérité (`pilot_goals` vs `coach_objectives`). *(P2)*
- **Demande d'affiliation pilote↔coach + accès borné événement** : affiliation admin-driven ; pas de `valid_from/valid_until`. *(P2, schéma)*
- **`oxvMomentService` nommé + note vocale coach (`audio_url`) + comparaison tour-vs-tour** : rendu OXV Moment existe
  (`carte-trophee`) mais service non unifié ; `virage-comparer` compare 2 *sessions* au lieu de 2 *tours*. *(cosmétique/V1.5)*
- **Modèle économique + portail web partenaire §9/§17** : hors app RN par design (micro-entreprise étape A). *(later, schéma)*
- **Quiet hours / geofence arrivée / galerie événement / vidéo embarquée synchronisée** : V1.5 explicite « ne pas bloquer V1 ». *(later)*

---

## Le plus gros manque structurel — Espace Partenaire  *(FONDATION FAITE — PR-F1)*

> **PR-F1 livré** (décision Gabin : marketplace complète + dashboard RN, sans encaissement) :
> tables `partner_accounts`/`partner_offers`/`partner_leads` (migration `0017`, RLS stricte +
> lead consenti), espace `(partner)/` + guard `role='partner'` + dashboard + tests RLS positifs/négatifs.
> **F2/F3/F4 livrés** : offres CRUD partenaire · pilote « demander contact » (lead consenti) · validation
> admin + supervision leads. **Boucle marketplace complète** (sans encaissement in-app).
> Détail : [pr-14](../../roadmap/rapports/pr-14-partner-foundation.md) · [pr-15](../../roadmap/rapports/pr-15-partner-offers.md) · [pr-16](../../roadmap/rapports/pr-16-partner-pilot-lead.md) · [pr-17](../../roadmap/rapports/pr-17-partner-admin.md).


- **Existe** : enum `user_role` inclut `'partner'` + helper `is_partner()` ; annuaire écosystème fonctionnel
  (`circuit_services` + `ecosystemService` + zone Club + `carte-oxv`) ; règle d'or « partenaire ne voit jamais
  la télémétrie » **respectée par construction** (aucune policy partner sur `telemetry_*`).
- **Manque** : **aucun** groupe `app/(partner)/`, aucun Partner Dashboard (T11 non commencé), aucun guard `role='partner'` ;
  tables `partner_offers` et `partner_leads` (consent_contact/channel/status) **absentes** → pas de `partnerLeadService`,
  pas de parcours pilote « demander contact », pas de KPI `partner_lead_rate`, pas de validation admin d'offres.
- **Décisions Gabin requises avant toute table** : (1) revient-on sur « annuaire sans encaissement » (contrainte
  micro-entreprise) ? (2) dashboard partenaire en **app RN** ou en **portail web** (§17) ? (3) réconcilier les **deux
  notions « partner »** (annuaire circuit `circuit_services` vs compte business). Le **seul** morceau réellement P1 est
  le **consentement RGPD du lead** *si* une offre est exposée ; le reste est P2/later.

---

## Décisions à acter (vous) — avant d'avancer

1. **Modèle d'accès coach** : binaire (garder + documenter + tester) **ou** gradué (`coach_pilots.level` + policies). → conditionne P0-2.
2. **Nommage `(app)` = pilote** : recommandé **garder** (`(app)`≡pilot, documenter la table de correspondance) plutôt que
   renommer ~57 routes + deep links. Mappings prod confirmés : `profiles`=`users`, `coach_affiliations`=`coach_pilots`,
   `lap_summaries`=`laps`, `audit_logs`=`admin_audit`, `events`=`sessions`, `corner_metrics`≈`app_segment_analyses`.
3. **Périmètre partenaire** : annuaire seul vs marketplace ; app RN vs portail web.
4. **Repousser explicitement** devices / Pass OXV / Passeport en V1.5 pour sécuriser l'alpha.

---

## Séquence de PR recommandée

| PR | Scope | P | Schéma | Accord |
|---|---|---|---|---|
| **PR-A** | Passerelle silence en piste (handler + garde-fous locaux + test) | P0 | non | **non** |
| **PR-B** | Décision modèle coach + tests RLS rôle-par-rôle (matrice 60 tables sensibles) | P0 | si gradué | **oui** |
| **PR-C** | Instrumentation KPI §27 (events aux moments clés, opt-out respecté) | P1 | non | non |
| **PR-A'** | Trigger `admin_audit` sur changement de rôle (cas §10.1.4, modèle existant) | P1 | oui (trigger) | oui |
| **PR-D** | Admin Qualité Data + `devices`/`device_assignments` (4 tables) | P1 | **oui** | **oui** |
| **PR-E** | `dataLabService` (agrégateur) + file de lecture coach | P1 | non | non |
| **PR-F** | Espace Partenaire (selon décisions produit) | P1/P2 | **oui** | **oui** |

> Méthode projet respectée : 1 PR = 1 scope validé, schéma uniquement avec accord, doctrine en garde-fou.
> Seuls **PR-A** et **PR-B** sont des bloqueurs alpha réels ; le reste est post-alpha cohérent avec §19.

---

## Annexe — claims vérifiés en code (par la critique)

`app/(partner)/` et `src/navigation/` absents (`ls`) · handler de notif inconditionnel
(`pushNotificationsService.ts` L34-40, commentaire L12-14) · `coach_pilots` sans `level/valid_from/valid_until`
(`database.types.ts` L1120-1133) · RLS frames≠sessions non différenciée (migration `20260525114148` L116-129) ·
3 suites RLS seulement · `trackEvent` appelé uniquement pour `app_ouverte` (`app/_layout.tsx`) ·
`devices/device_assignments/data_quality_reports/partner_offers/partner_leads` absents des types ·
`promoteToCoach/demoteToPilot` sans insert `admin_audit` (`coachAdminService.ts` L281) ·
`carte-trophee` = OXV Moment (rendu réel, pas un stub). Aucun « présent » faux détecté ; aucune section CDC laissée hors-audit.
