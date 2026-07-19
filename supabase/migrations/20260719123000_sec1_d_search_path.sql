-- ============================================================================
-- SEC-1 — PRÉPARÉE, NON APPLIQUÉE — approbation fondateur requise
-- ============================================================================
-- Lot D — search_path des fonctions + REVOKE anon sur les DEFINER sensibles
--
-- Constat prod (inspection 2026-07-19, lecture seule) :
--   - Advisors WARN « function_search_path_mutable » : email_templates_touch et
--     set_pavilion_optin_at UNIQUEMENT. Ce sont des triggers NON-definer dont
--     le corps ne touche que NEW/OLD → search_path = '' sans risque.
--   - Toutes les fonctions SECURITY DEFINER de public (82) ont DÉJÀ un
--     search_path épinglé (vérifié : pg_proc.proconfig non NULL partout,
--     oxv_founding_count compris) — rien d'autre à figer.
--   - Advisors WARN « anon_security_definer_function_executable » : 19
--     fonctions DEFINER exécutables par anon. Usages vérifiés (grep repo +
--     pg_policies) avant de trancher — voir les deux listes ci-dessous.
--
-- Rollback : GRANT EXECUTE ON FUNCTION <f> TO anon; (par fonction) ;
--            ALTER FUNCTION <f> RESET search_path; (pour les deux triggers).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. search_path figé sur les 2 fonctions WARN (triggers sans accès table).
-- ----------------------------------------------------------------------------
alter function public.email_templates_touch() set search_path = '';
alter function public.set_pavilion_optin_at() set search_path = '';

-- ----------------------------------------------------------------------------
-- 2. REVOKE anon sur les DEFINER sensibles SANS usage anonyme légitime.
--    Vérifié : aucune n'est référencée par une policy RLS à rôle {public}
--    (pg_policies scanné) ; toutes sont appelées par l'app (JWT authenticated)
--    ou par des edges service_role. On révoque PUBLIC puis on re-grant
--    explicitement authenticated + service_role (le droit d'anon venait du
--    GRANT implicite à PUBLIC).
-- ----------------------------------------------------------------------------
revoke execute on function public.admin_validate_inscription(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_validate_inscription(uuid, text, text, boolean) to authenticated, service_role;

revoke execute on function public.pilot_sessions_for_coach(uuid) from public, anon;
grant execute on function public.pilot_sessions_for_coach(uuid) to authenticated, service_role;

revoke execute on function public.pilot_sheet_for_coach(uuid) from public, anon;
grant execute on function public.pilot_sheet_for_coach(uuid) to authenticated, service_role;

revoke execute on function public.measure_metric_now(uuid, public.objective_metric, uuid) from public, anon;
grant execute on function public.measure_metric_now(uuid, public.objective_metric, uuid) to authenticated, service_role;

revoke execute on function public.objective_progress_for_pilot(uuid) from public, anon;
grant execute on function public.objective_progress_for_pilot(uuid) to authenticated, service_role;

revoke execute on function public.ping_attendees(uuid) from public, anon;
grant execute on function public.ping_attendees(uuid) to authenticated, service_role;

-- Fonctions de TRIGGER (gates) : personne n'a besoin de les appeler — les
-- triggers s'exécutent avec les droits du propriétaire de la table.
revoke execute on function public.oxv_coach_availability_open_gate() from public, anon;
grant execute on function public.oxv_coach_availability_open_gate() to service_role;

revoke execute on function public.oxv_partner_accounts_validation_gate() from public, anon;
grant execute on function public.oxv_partner_accounts_validation_gate() to service_role;

revoke execute on function public.oxv_partner_offers_publish_gate() from public, anon;
grant execute on function public.oxv_partner_offers_publish_gate() to service_role;

-- ----------------------------------------------------------------------------
-- 3. CONSERVÉES exécutables par anon — usages anonymes LÉGITIMES, documentés :
--    - oxv_founding_count            → compteur Founding Members de la landing
--                                      du site (anon) ; ne retourne qu'un entier ≤ 30.
--    - get_shared_progression        → lien de partage public par token
--    - get_shared_progression_values   (liste blanche de métriques, révocable).
--    - coach_public_card             → fiche coach publique du site.
--    - is_admin, oxv_is_admin, is_coach, is_my_coach, is_partner, is_pro_pilot,
--      is_subscription_current, is_detailed_coach_of, owns_partner_account,
--      are_friends, oxv_my_crew_id  → helpers référencés par des policies RLS
--      dont certaines à rôle {public} (ex. coach_profiles_read_published,
--      partner_offers_*, pro_team_owner_all, telemetry_frames_coach_select) :
--      révoquer anon ici casserait l'évaluation de ces policies pour le site.
-- ----------------------------------------------------------------------------
