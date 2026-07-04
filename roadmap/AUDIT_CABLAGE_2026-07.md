# Audit de câblage — 2026-07-04 (Lot M0)

> Base de vérité des lots M du PROMPT_APP_OXV_MIRROR_v2. Méthode : 4 passes
> d'exploration (une par espace, fichier en main) + interrogation directe de la
> base prod (edge functions, buckets, policies). Les sur-signalements d'audit
> automatique ont été re-vérifiés à la main quand ils contredisaient l'historique
> connu (2 corrigés, notés en fin de document).

## 0. Synthèse

| Espace | Écrans | Câblés prod | Mock/démo | Stub | Morts |
|--------|--------|-------------|-----------|------|-------|
| Pilote `(app)` | ~74 | ~68 | 2 (insights, insight/[reading] — démo assumée jusqu'à Valence) | 3 (transitions + notifications V1) | 0 |
| Coach `(coach)` | 23 | 22 | 0 | 0 | 0 (1 prototype : ar.tsx) |
| Partenaire `(partner)` | 7 | 7 | 0 | 0 (facturation = placeholder honnête assumé) | 0 |
| Pro `(pro)` | 8 | 8 | 0 | 0 | 0 |
| Admin `(admin)` | 29 | 29 | 0 | 0 | 0 |

**Verdict global : l'app est massivement câblée sur données réelles.** Aucun
écran mort, aucun faux succès UI détecté. Les seuls écrans non câblés sont
volontaires : lectures Insight en mode démo (bannière explicite, données réelles
attendues à Valence), notifications V1 (wiring push connu en attente), deux
écrans de pure transition sans donnée.

## 1. Espace pilote `(app)` — points saillants

- **Parcours nominal complet câblé** : préparation (météo réelle) → équipement
  (BLE réel) → placement/roulage (captureSessionService) → donnees-securite
  (analyse + upload .ubx) → trace/debrief/bilan (services réels).
- **Data Lab intégral câblé** (carte, virage, tours, heatmap, replay, telemetry,
  conditions) sur `telemetry_frames`/services. `data-lab-canvas` (Vue unifiée
  Skia) : câblé mais **build-pending** (garde Expo Go, à vérifier au build 20).
- **MOCK assumés** : `insights.tsx` + `insight/[reading].tsx` (galerie 6
  lectures, DemoBanner, catalogue démo — bascule aux données réelles post-Valence).
- **STUB assumés** : `pilotage-fini` et `bilan-pret` (transitions pures, pas de
  donnée à câbler), `notifications.tsx` (états vides honnêtes, push remote non
  déployé), `legal/[doc]` (docs statiques — normal).
- **Debug** : `debug-capture.tsx`, `debug-circuit.tsx` — `__DEV__` only,
  candidats à l'archivage M7.1.
- ⚠️ **`programme.tsx` consomme `eventsService`** → impacté par la migration M4
  (events → sessions). À recâbler dans le lot M4.
- ⚠️ **`generate-debrief-ai` → `debrief.tsx` : du texte LLM atteint le pilote
  aujourd'hui.** Point n° 1 du lot M-IA (remplacement déterministe).

## 2. Espace coach `(coach)` — points saillants

Tout est câblé prod (23/23), y compris disponibilités, cycles, gabarits,
repères, pondérations de lecture, roulages tarifés (gating permissions),
business dashboard (gating `can_view_business_dashboard`).

### Inventaire IA — AMENDÉ (décision fondateur orale du 2026-07-04, remplace le
### retrait total du prompt v2 : « on garde l'IA si elle ne coache pas mais débriefe »)

Périmètre décidé : **débrief pilote + assistant coach conservés**. Repli en cas
de rejet doctrinal : **bilan déterministe** (fail-closed). Le lot M-IA devient
un lot de VERROUILLAGE (fait, cf. commit associé) :

| Artefact | Chemin | Sort (amendé) |
|----------|--------|----------------|
| Écran assistant | `app/(coach)/assistant.tsx` | **conservé** (brouillons validés par le coach humain) |
| Service | `src/services/coachAiService.ts` | conservé |
| Filtre doctrinal | `src/services/aiSafetyFilter.ts` (~55 termes normalisés) | conservé — source canonique du lexique |
| Bandeau | `src/components/AIReviewBanner.tsx` | conservé |
| Edge fns | `coach-ai-draft`, `coach-ai-validate` | conservées (filtre serveur + validation humaine) |
| Edge fn | `generate-debrief-ai` | **conservée et DURCIE** : lexique intégral porté côté serveur (18 → ~55 termes, matching normalisé sans accents), scan sortie + retry + 422 fail-closed inchangés |
| Repli | `debriefGenerator.generateSafeDebrief` | confirmé : toute erreur/rejet edge → bilan déterministe |
| Ceinture d'affichage | `app/(app)/debrief.tsx` | AJOUTÉE : `isDoctrineSafe` re-filtre le texte persisté avant affichage — rien de prescriptif ne s'affiche, même si un ancien texte non conforme traînait en base |
| Test de parité | `aiSafetyFilter.test.ts` | AJOUTÉ : lit le fichier edge et impose que chaque terme du lexique app y figure |
| Tables | `coach_ai_drafts`, `ai_safety_reviews`, `coach_queue` | toutes conservées (plus aucun drop au programme) |
| Provenance pilote | `debrief.tsx` | déjà en place (« RÉCIT GÉNÉRÉ AUTOMATIQUEMENT » + blocs source/limites) |
| Opt-out RGPD | `users.ai_debrief_enabled` | déjà en place (403 serveur → repli local) |

La frontière doctrinale reste absolue : l'IA **décrit des faits**, ne conseille
JAMAIS ; le conseil est le monopole des coachs humains externes.

Écrans disponibilités/cycles/gabarits : **câblés et fonctionnels** (tables
`coach_availability_slots`, `development_cycles(+steps)`,
`coach_annotation_templates`). La question fondateur n° 6 (garder/retirer) porte
sur de l'**usage**, pas sur de la dette : rien n'est stub.

`ar.tsx` : prototype WebView (`app.oxvehicle.fr/ar-view`), état honnête, hors GA.

## 3. Espaces partenaire + pro — points saillants

- Partner 7/7 câblés : hub, offres (CRUD complet `partner_offers`), leads
  (lecture + update statut `partner_leads`), performance (agrégats locaux),
  rapports B2B (lecture `b2b_event_reports` si `status='shared'`), profil.
- **§148 tenu** : aucun chemin ne mène une donnée pilote individuelle ou de la
  télémétrie à un partenaire. Les leads exposent un flag de consentement, pas
  d'identité étendue.
- **Prix** : `offres.tsx` affiche le prix saisi par le partenaire lui-même
  (affiché, non encaissé). Aucun tarif B2B Mirror affiché (Q10-bis respectée).
  `facturation.tsx` = placeholder honnête, aucun paiement.
- Pro 8/8 câblés ; partage par liens token 192-bit sur whitelist stricte de 5
  métriques factuelles, révocable ; `pro_team_members.access_level='none'`.

## 4. Espace admin — points saillants

29/29 câblés (tour de contrôle, devices, qualité data, diagnostic session,
scan check-in caméra, modération, feature flags, maintenance kill-switch…).

### Devices / RaceBox (base du lot M7.2)
- Table `devices` : `label` (joue le rôle d'alias), `serial`, `type`,
  `health_status`, `battery_status`. **Pas de colonne `alias` ni de numéro de
  flotte dédiés** → M7.2 = migration additive (`alias`, `fleet_number`) ou
  officialisation de `label` (décision à poser, coût quasi nul dans les deux cas).
- Affectations : `device_assignments` (+ lecture RO dans `evenements/[id]`).
  Côté pilote : `mon-equipement.tsx` (« Mon boîtier », `deviceHealthService`,
  RLS pilote scopée posée le 30/06).
- L'écran de scan BLE pilote (`equipement.tsx`) affiche les noms d'usine — le
  mapping alias-par-serial reste à faire (M7.2).

### Écrans sur `events` (impactés M4)
`evenements.tsx`, `evenements/[id]`, `evenements/nouveau`, `scan-checkin`,
`tour-controle` (todayEvents), `analytique` + côté pilote `programme.tsx`,
et services `eventsService`/`adminAnalytics`/`dataExport`/`b2bReport`.

## 5. Edge functions — déployées vs repo

**32 déployées** sur le projet. **14 dans ce repo**, toutes déployées et à jour.

| Groupe | Fonctions | Statut |
|--------|-----------|--------|
| Repo app (14) | coach-ai-draft, coach-ai-validate, compute-session-insights, cron-analyze-pending-sessions, generate-debrief-ai, notify-* (6), purge-deleted-accounts, send-coach-invitation, send-document-status | déployées ✓ |
| Repo site (18) | pair-app ✓, validate-inscription, admin-review-inscription, compute-session-insights-**v3**, detect-circuit-corners, geocode, send-booking-confirmation, send-payment-confirmed, notify-admin-lead, send-contact-ack, send-application-ack, generate-invoice, eligibility-reminders, feedback-request, newsletter-push, resend_webhook, ritual_dispatcher, ritual_dryrun | déployées, sources côté site |

- ✅ **`pair-app` est déployée** → le lot M3 (appairage) peut se câbler tout de suite.
- ⚠️ **`compute-session-insights` ET `compute-session-insights-v3` coexistent.**
  Clarifier laquelle fait foi avant M1 (le cron appelle laquelle ?) — risque de
  pipeline divergent.
- Les fonctions M-IA à retirer sont bien identifiées (3 : draft, validate,
  generate-debrief-ai — la 3ᵉ remplacée, pas supprimée sans successeur).

## 6. Buckets storage et policies

| Bucket | Public | Objets | Policies (résumé) | Verdict |
|--------|--------|--------|--------------------|---------|
| session-media | privé | 0 | select : owner OU ami OU coach-de OU admin ; write : admin only | ✅ conforme M1.2 |
| pilot-media | privé | 0 | owner + coach-de + admin | ✅ |
| telemetry_raw | privé | 3 | own-folder strict | ✅ |
| documents | privé | 5 | own-folder + admin | ✅ |
| invoices | privé | 0 | own + admin (lecture) | ✅ |
| audio_briefings | privé | 1 | tout accès public bloqué (`AND false`) | ✅ |
| coach-audio | privé | 0 | via coach_annotations (coach owner, pilote si shared) | ✅ |
| avatars | **PUBLIC** | 0 | own-folder write | acceptable (avatars) |
| **coach-media** | **PUBLIC** | 0 | « Anyone can view » | ⚠️ **M5 confirmé** : passer privé + URLs signées |
| **partner-media** | **PUBLIC** | 0 | read public | ⚠️ **M5 confirmé** : idem |
| vehicles | privé | 8 | own-folder + admin | ✅ |

Les deux buckets publics sont **vides** : la bascule privé+signé est à coût nul
si elle est faite avant tout upload réel. À faire tôt (M5 avancé), coordonné site.

## 7. Migrations `_pending_site_coordination`

Une seule : `20260614121000_sessions_mask_private_client_pii.sql` (+ README).
À appliquer/clore dans M5, coordonné site.

## 8. Services orphelins

Aucun service réellement mort : les « orphelins » détectés sont des services
admin/coach importés par leurs espaces respectifs, des logiques internes
(`*Logic.ts` importées par les services) ou des utilitaires composants.
`offlineQueue.ts` mérite une vérification d'usage réel au lot M7 (candidate au
retrait si rien ne la consomme).

## 9. Points relevés qui infléchissent les lots

1. **M-IA d'abord pilote** : `generate-debrief-ai` sert le PILOTE aujourd'hui —
   c'est le retrait le plus urgent doctrinalement, avant même l'assistant coach.
2. **Deep link** : le scheme réel est **`oxv`** (app.json), pas `oxvcoach`. La
   question fondateur n° 7 est sans objet telle que posée ; il reste à décider si
   `oxv://` convient (recommandation : oui, neutre et court) et à câbler les
   liens universels.
3. **Doublon pipeline** : `compute-session-insights` vs `-v3` — trancher avant M1.
4. **M7.2 devices** : pas de colonne alias — migration additive triviale, mais
   l'écran pilote `equipement.tsx` doit résoudre serial→alias.
5. **M4** : périmètre events confirmé (7 écrans + 4 services).
6. **Buckets M5** : bascule à faire AVANT tout upload réel (buckets vides = coût nul).

## 10. Corrections d'audit automatique (fiabilité)

Deux faux flags corrigés à la main (les auditeurs sur-signalent) :
- `carte-trophee.tsx` n'est PAS un mock : câblé prod (centerline circuit, laps,
  régularité, journal `media_exports`).
- `mon-equipement.tsx` = « Mon boîtier » sur `deviceHealthService`
  (device_health_logs), pas le garage.
