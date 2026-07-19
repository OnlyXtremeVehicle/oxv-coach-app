# BE-1 — état du socle backend (2026-07-19)

> Créé vs adossé à l'existant. Migrations **appliquées en prod** `fouvuqkdxarjpjbqnsjq`,
> types régénérés (`src/types/database.types.ts`), advisors sécurité **0 ERROR**.

## Feature flags (Livrable 1) — CRÉÉS (OFF)

`app_payments`, `biometry`, `founders`, `video_overlay`, `convoys` insérés dans
`app_feature_flags` (existant), tous `enabled=false`. `isFlagEnabled` (fail-closed)
les lit sans modification. Flags existants conservés : `coach_billing`, `pilot_waivers`.

## Biométrie (Livrable 2) — CRÉÉ

- **Table `biometry_raw`** (santé, art. 9) : RLS own-all + coach read (si
  `is_detailed_coach_of(user_id)` ET `users.biometry_coach_share_consent_at`
  non-null). Jamais partner/staff/anon. UNIQUE(session_id, ts, source) = idempotence.
- **Consentement** : adapté au modèle existant (colonnes sur `users`). Deux
  colonnes **timestamptz** `biometry_capture_consent_at` / `biometry_coach_share_consent_at`
  (NULL=OFF, date=consentement horodaté — piste d'audit art. 9 ; révocation=NULL).
  Étend `consentService` (patron `ai_debrief_enabled`/`coach_ai_enabled`).
- **Rétention 30 j** : `purge_old_biometry()` (SECURITY DEFINER, search_path figé,
  service_role only). **Cron `biometry-retention-daily` (15 3 \* \* \*) PLANIFIÉ** (jobid 11).
- **Purge compte** : `biometry_raw` couvert par `purge_user_data()` (delete).

## Fondateurs (Livrable 3) — CRÉÉ

`founder_applications` (own select/insert + admin all). Trigger `tg_founder_app_guard` :
un non-admin ne peut insérer qu'en `pending` ni changer un status (anti self-approve,
patron guard `users.role`). Compteur public `founders_count()` (approved only, aucun
listing). Purge compte : delete.

## Incidents (Livrable 4) — CRÉÉ

`incident_reports` : insert own + select own/admin, **AUCUN update/delete** (immuable,
valeur probatoire). Photo dans `pilot-media/{uid}/incidents/` (SEC-1 a déjà retiré
l'accès coach à ce sous-dossier). Purge compte : **anonymisation** (`user_id`→NULL,
TODO_AVOCAT E5), jamais suppression.

## Vidéo du tour (Livrable 4bis) — CRÉÉ

`video_overlays` : métadonnées d'alignement UNIQUEMENT (`local_asset_id` local,
`offset_ms`) — jamais le média. RLS own-only strict (ni coach ni staff). UNIQUE
idempotence. Purge compte : delete. Utilisée par B1.

## Groupes & convois (Livrable 5)

- **crews / crew_members : DÉJÀ EN PROD** (cf. `12_CREWS_PROD.md`) — non recréés.
  `referralService` s'adosse aux RPC `oxv_get_my_referral_code`/`oxv_redeem_referral`/
  `oxv_my_crew_id`/`oxv_name_my_crew`. Le code de parrainage = `users.affiliation_code`.
- **convoys / convoy_participants : CRÉÉS**. RLS bornée aux inscrits de la journée
  via `is_registered_for_session(session_id)` (registrations non annulées) ;
  `created_by` gère son convoi. Purge compte : delete.

## Services (Livrable 6) — `src/services/v2/`

`biometryService`, `healthKitService` (iOS-only, no-op prêt pour BIO-1),
`founderService`, `incidentService`, `referralService`, `convoysService`,
`videoOverlayService` + extension `consentService` (kind biometry). Logique pure
séparée et testée par service. Tests RLS ajoutés `src/__tests__/rls/be1RLS.test.ts`.

## À poser manuellement (fondateur / lots ultérieurs)

- **`cycle_templates` (D2)** : hors périmètre BE-1 (série coach v2 ultérieure).
- Activation des flags : au fil des lots (biometry→BIO-2, video_overlay→B1,
  app_payments→A1-ON, founders/convoys→L4/L5 quand validés).
- Cron `biometry-retention-daily` : DÉJÀ planifié (jobid 11).
