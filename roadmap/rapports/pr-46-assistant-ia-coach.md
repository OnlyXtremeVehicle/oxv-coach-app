# PR-46 — Assistant IA coach (version durcie, M3, C-1)

**Milestone** : M3 (innovation V4) · **Date** : 2026-06-28 · **Branche** : `main`
**Méthode** : conception via workflow (8 agents : comprendre infra IA+coach+doctrine+spec → concevoir → critique adversariale 3 lentilles), puis build durci selon les correctifs de la critique.

## Intention

Une IA qui **pré-rédige** une observation descriptive par virage. Le coach
**relit, édite, valide**. Le brouillon validé devient une annotation
`coach_annotations` (canal existant lu par le pilote). **Le pilote ne voit jamais
le brouillon brut.** L'IA propose, le coach décide.

## La critique adversariale a trouvé de vraies failles — toutes corrigées

| Faille (sévérité) | Correctif livré |
|---|---|
| 🔴 Exfiltration cross-pilote via l'edge (`service_role` sans contrôle d'appelant) | L'edge lit via le **JWT du coach** — la RLS bloque l'exfiltration **par construction**. Gate `coach_ai_consent` (rpc, fail-closed) en 1ère ligne. |
| 🔴 Mauvais consentement, défaut-ON/fail-open | Flag **dédié `users.coach_ai_enabled`, opt-in défaut OFF**, vérifié serveur, `coalesce(...,false)`. |
| 🟠 Auto-publication par UPDATE direct (filtre seulement à la génération) | RLS **scindée** : le coach ne peut pas poser `status='validated'` (WITH CHECK `in (draft,discarded)`). La validation passe par l'edge `coach-ai-validate` qui **re-filtre le texte édité** côté serveur. |
| 🟠 `coach_annotations` (canal pilote) sans filtre exécutable (trou **préexistant**) | **Trigger PL/pgSQL `coach_annotation_doctrine_guard`** : toute note PARTAGÉE prescriptive est refusée en base, quelle que soit son origine. |
| 🟠 Niveau coach non gardé (segments détaillés) | Tout passe par `is_detailed_coach_of` (lecture_detaillee/programme). |
| 🟡 Provenance non propagée au pilote | Colonne `coach_annotations.ai_assisted` + mention « Assistée par IA, validée par votre coach » sur le zoom virage. |

## Schéma (migration `0026_coach_ai_drafts`, appliquée en prod)

- `coach_ai_drafts` (FK `auth.users`, corner 1..7, `generated_text` ≤1000, `status`
  draft/validated/discarded, `provenance`, `resulting_annotation_id`→coach_annotations,
  CHECKs de cohérence). RLS **scindée** SELECT/INSERT(`status='draft'`)/UPDATE
  (`status in draft,discarded`)/DELETE, gardée par `is_detailed_coach_of` ; admin
  SELECT seul ; pilote/partenaire **aucune policy**.
- `users.coach_ai_enabled` (opt-in défaut false) + helper `coach_ai_consent` (fail-closed).
- `coach_annotations.ai_assisted` (transparence).
- Trigger doctrinal exécutable sur `coach_annotations` (regex vérifié en base :
  prescriptif → rejeté, descriptif → autorisé).

`database.types.ts` régénéré (+77/-0). Advisors : aucune alerte propre à la feature
(le WARN `coach_ai_consent` SECURITY DEFINER = pattern identique à `is_coach_of`).

## Edge functions (déployées, ACTIVE, verify_jwt=true)

- **`coach-ai-draft`** : authz JWT + gate consentement fail-closed + lecture
  factuelle non-nominative (circuit + grandeurs du virage) + prompt anti-prescriptif
  (gpt-4o-mini) + filtre serveur (retry, refus 422 + audit) → insert `draft`.
- **`coach-ai-validate`** : authz JWT + **re-filtre du texte édité** → (service_role)
  crée l'annotation `ai_assisted` + marque le brouillon `validated`.

## App

- `src/services/coachAiService.ts` (requestDraft/listMyDrafts/discardDraft/validateDraft).
- `app/(coach)/assistant.tsx` (sélection pilote/séance/virage → proposer → relire/éditer
  → valider/rejeter) + lien depuis le hub coach.
- `src/services/coachAnnotationsService.ts` : garde `isDoctrineSafe` app (UX) sur les
  notes partagées (défense en profondeur ; le trigger DB reste le rempart).
- `app/(app)/settings.tsx` : opt-in pilote « Assistant IA de mon coach » (défaut OFF).
- `app/(app)/virage.tsx` : mention de provenance IA sur l'annotation partagée.

## Vérifié

- `tsc` clean · `eslint`/`prettier`/`format:check` clean · `doctrine` 134 fichiers OK.
- `npx jest` : **918 passed, 0 échec** (anti-divergence étendue au lexique coach ;
  garde-fou SQL re-vérifié en base).
- Tests RLS `coachAiRLS.test.ts` : 9 cas (insert détaillé OK ; auto-validation bloquée ;
  rejet OK ; lecture_simple refusée ; pilote/partenaire aveugles ; trigger doctrinal :
  partagé prescriptif refusé, partagé descriptif OK, privé prescriptif toléré).

## Garde-fous doctrine

Validation humaine obligatoire · filtre serveur AVANT l'œil du coach **et** re-filtre
du texte édité · trigger DB sur le canal pilote · post-session uniquement · provenance
déclarée au pilote · le pilote ne voit jamais le brouillon · consentement dédié fail-closed
· payload non-nominatif · vouvoiement, pas d'emoji.

## Reste / suite M3

- Tester sur device avec un vrai compte coach + pilote opt-in (le feature est dormant
  par défaut).
- Tranches M3 restantes : programmes adaptatifs, jumeau numérique, modération.
