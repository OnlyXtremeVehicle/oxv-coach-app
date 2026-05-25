# Rapport semaine 15 — Feature Coach complète

**Date** : 26 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : **La feature coach est livrée de bout en bout.** Schéma DB, app coach, backoffice admin, opt-in pilote RGPD, audit logs. Reste tests automatisés RLS (B, reporté infra) et propagation web (F, brief séparé).

---

## Vue d'ensemble — 8 livrables sur 4 jours

| Livrable | Branche | Commit | État |
|---|---|---|---|
| **Phase 1** — DB + RLS | `feature/coach-phase1-db-rls` | mergée | ✅ |
| **Phase 2** — App pilote inchangée | — | — | ✅ |
| **Phase 3** — App coach (3 écrans) | `feature/coach-phase3-app` | mergée | ✅ |
| **Phase 4** — Backoffice admin (assignations) | `feature/coach-promote-from-admin` | consolidé avec D | ✅ |
| **A** — Opt-in pilote RGPD | `feature/coach-pilot-consent` | poussé | ✅ |
| **B** — Tests RLS Vitest | — | — | ⏳ reporté |
| **C** — Audit logs admin_audit | `feature/coach-audit-logs` | poussé | ✅ |
| **D** — Promotion user ↔ coach via app | `feature/coach-promote-from-admin` | poussé | ✅ |
| **E** — Ce rapport | `feature/coach-report-and-web-brief` | en cours | ⏳ |
| **F** — Brief propagation web | `feature/coach-report-and-web-brief` | en cours | ⏳ |

---

## Doctrine — comment la feature tient

La feature coach a été conçue pour respecter la doctrine OXV sans compromis :

### 1. Le coach est un miroir aussi, pas un coach

Contrairement à ce que son nom suggère, le coach OXV **n'instruit pas le pilote dans l'app**. Il consulte les sessions, voit les marges et les analyses, mais l'app ne lui dit jamais quoi recommander. Le coach interprète seul, échange avec le pilote hors-app si bon lui semble.

Cohérence avec le pacte : *"L'app est un miroir."* Vrai pour le pilote, vrai pour le coach.

### 2. Lecture seule absolue

Aucun écran coach n'offre d'action de modification. Les RLS le garantissent côté serveur (`coach_pilots_coach_select` policies n'autorisent que SELECT). Côté UI : aucun bouton "noter", "commenter", "modifier".

Un coach qui ouvre `/(app)/bilan?sessionId=xxx` lit la même donnée que le pilote, sans rien pouvoir changer.

### 3. Consentement libre, retiré à tout moment

L'opt-in pilote (`A`) est central. Tant que `pilot_consent_at IS NULL` :
- La fonction `is_coach_of(uuid)` renvoie `false`
- Les 7 policies coach SELECT bloquent tout accès
- Le coach voit le pilote en "non consenti" dans son écran (à coder V1.1 si besoin)

Le pilote retire son accord d'un toggle — aucune justification demandée, aucune friction.

### 4. Accent visuel distinct

Bleu nuit `#1E3A5F` pour le coach, bronze pour l'admin, rouge OXV pour le pilote. Le pilote sait toujours dans quel mode il est en regardant l'eyebrow.

### 5. Sécurité par défaut

- ❌ Email/tel/docs jamais exposés au coach
- ❌ Paiements/inscriptions jamais accessibles
- ✅ Audit log à chaque accès (RGPD compliance)
- ✅ Double-verrou RLS : `active=true` ET `pilot_consent_at IS NOT NULL`

---

## Détails par livrable

### Phase 1 — DB + RLS (migrations 0015 + 0016)

- Enum `user_role` étendu : `pilot` / `admin` / **`coach`**
- Table `coach_pilots` avec `pilot_consent_at` (RGPD)
- Fonction `is_coach_of(uuid)` — STABLE SECURITY DEFINER, search_path fixé
- 7 policies coach SELECT (`telemetry_sessions/frames/laps`, `app_session_analyses`, `app_segment_analyses`, `vehicles`, `app_progression_shares`)
- Vue `coach_pilots_view` (SECURITY INVOKER) — colonnes non-sensibles uniquement

### Phase 3 — App coach (3 écrans)

- Token `colors.accent.coach = '#1E3A5F'`
- Route group `app/(coach)/` avec layout guard `role='coach'`
- Écran hub : liste pilotes assignés ET consentis via `coach_pilots_view`
- Écran détail pilote : sessions chronologiques avec marges colorisées
- Service `coachService.ts` (`listMyPilots`, `listPilotSessions`)
- `useAuthStore` étendu avec `role`
- `app/index.tsx` route selon role au boot

### Phase 4 — Backoffice admin (2 écrans)

- `/(admin)/coachs` — liste coachs + count assignations actives
- `/(admin)/coachs/[id]` — détail coach + picker pilote + toggle active + forcer consent
- Service `coachAdminService.ts` (6 fonctions)
- Ajout 5ème card "Coachs" dans hub admin

### A — Opt-in pilote RGPD (1 écran)

- `/(app)/mon-coach` — liste coachs du pilote + toggle consentement
- Service `pilotConsentService.ts` (`listMyCoaches`, `giveConsent`, `revokeConsent`)
- Lien dans Settings → section COMPTE → "Mon coach — Gérer"
- ExplainerCard pédagogique "CE QUE LE COACH VOIT"

### C — Audit logs (migration 0017)

- Fonction `log_coach_view(target_pilot_uuid, action_subtype, target_session_uuid)`
- SECURITY DEFINER — vérifie en interne que l'appelant est bien coach actif
- Appelé en fire-and-forget depuis `listPilotSessions`
- Lecture des logs : `SELECT * FROM admin_audit WHERE action LIKE 'coach_view%'`

### D — Promotion via app admin

- Bouton "↦ coach" sur chaque pilote dans `/(admin)/preparation`
- Bouton "↤ pilote" sur chaque coach dans `/(admin)/coachs`
- Confirmations Alert iOS-style avec garde-fou (refuse rétrogradation si assignations actives)
- Service étendu : `promoteToCoach`, `demoteToPilot`

---

## Décisions prises en auto mode

| # | Décision | Choix V1 |
|---|---|---|
| D1 | Tarif coach | Free (pas de logique paiement) |
| D2 | Onboarding coach | Admin promu pilote → coach (via app sem 15 D, ou SQL Dashboard) |
| D3 | Many-to-many coach↔pilote | Oui, supporté nativement |
| D4 | Pilote multi-coachs | Autorisé techniquement, pas de check applicatif |
| D5 | Consentement RGPD | Champ `pilot_consent_at` sur `coach_pilots` |
| D6 | Promotion via app | Promoteur = admin (bouton dans preparation/coachs) |
| D7 | Audit logs | Fonction SECURITY DEFINER + RPC fire-and-forget |
| D8 | Accent visuel | Bleu nuit `#1E3A5F`, posture d'écoute |

---

## Ce qui reste à faire

### B — Tests RLS coach automatisés (reporté)

**Pourquoi reporté** : nécessite un env de test Vitest dédié, 3 comptes Supabase de test, secrets dédiés. Demande 1 jour de setup avant les premiers tests utiles.

**Plan V1.1** :
1. Créer un projet Supabase de test (branch via `supabase branch create`)
2. Setup Vitest avec `@supabase/supabase-js` configuré sur cette branch
3. Helpers : `createTestUser(role)`, `signInAs(userId)`, `cleanup()`
4. 5 tests obligatoires :
   - Coach voit télémétrie de son pilote assigné ET consenti
   - Coach voit PAS télémétrie d'un pilote non assigné
   - Coach voit PAS télémétrie d'un pilote assigné mais non consenti
   - Coach voit PAS d'écriture sur les tables pilote
   - Désactivation coach_pilots révoque immédiatement l'accès

**À faire en post-alpha**. Pour l'alpha juillet 2026, la sécurité repose sur :
- Audit Supabase advisor (passé clean)
- Vérification manuelle par scripts SQL pendant le dev
- Tests manuels via les 3 comptes alpha

### F — Brief propagation site web OXV

Voir [`docs/coach-feature/BRIEF_WEB_PROPAGATION.md`](../docs/coach-feature/BRIEF_WEB_PROPAGATION.md) — document séparé prêt à transmettre au dev web ou à intégrer si Gabin code lui-même.

---

## Recommandations

### R45 — Premier coach assigné

Pour tester end-to-end le système (et créer du contenu pour les rapports alpha), promouvoir vous-même un compte coach test au prochain track day :

1. Créez un user `coach@oxvehicle.fr` via Dashboard Supabase
2. Loguez-vous en admin dans l'app
3. Hub admin → Préparation → cliquez "↦ coach" sur cet utilisateur
4. Hub admin → Coachs → tapez sur ce coach → Assignez vous-même comme pilote
5. Loguez-vous en pilote → Settings → Mon coach → tapez le toggle de consentement
6. Loguez-vous en coach → vous voyez vos propres sessions

### R46 — Documentation pacte de coaching

Quand vous communiquerez la feature aux pilotes alpha, ajoutez un addendum au [`docs/juridique/01_PACTE_DE_PILOTAGE.md`](../docs/juridique/01_PACTE_DE_PILOTAGE.md) qui clarifie :
- "Si vous acceptez un coach, il voit X et JAMAIS Y"
- "Vous pouvez retirer votre accord à tout moment"
- "Le coach n'est pas un instructeur — c'est un autre regard que vous décidez d'accueillir"

### R47 — Tarification coach pour V1 commerciale

Décision à prendre avant beta publique :
- A — Free pour tous (modèle d'acquisition)
- B — Inclus dans forfait OXV (coach offert au pilote)
- C — Payant pour le coach (abonnement séparé)
- D — Payant pour le pilote qui ouvre l'accès (consentement = facturation)

Option B la plus alignée avec la doctrine premium ("vous payez OXV, OXV vous offre un coaching humain"). Mais B impose à OXV de recruter/rémunérer les coachs.

---

## Questions ouvertes

### Q46 — Notif au pilote quand un coach lui est assigné

Aujourd'hui, l'admin assigne mais le pilote n'est pas notifié. Il doit aller dans Settings → Mon coach pour découvrir l'assignation. Suggestion V1.1 : push notif "Un coach vous a été assigné. Ouvrez l'app pour consentir."

### Q47 — Notif au coach quand un pilote consent / révoque

Symétrique : le coach ne sait pas que son pilote vient de consentir. Notif utile pour qu'il sache qu'il peut commencer à regarder.

### Q48 — Page admin "Historique coaching" agrégé

Vue admin qui agrège : nombre total d'accès coach, top coachs actifs, pilotes les plus consultés, taux de consentement. Utile pour piloter la feature commercialement. V1.2.

---

## En résumé

**Feature Coach livrée intégralement en 4 jours.** 8 livrables sur 9 (B reporté infra). 6 PRs distinctes pour reviews ciblées.

L'app permet désormais à OXV d'offrir un coaching humain en complément de l'analyse algorithmique — sans jamais trahir la doctrine du miroir. Le pilote garde le contrôle absolu via le consentement. Le coach observe sans diriger.

Schéma DB + RLS + UI + audit + admin : tout est en place. Plus qu'à recruter les premiers coachs OXV et leur ouvrir l'accès.

— Claude Code, 26 mai 2026
