-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juillet 2026 a 01:12:06 UTC, elle n avait jamais ete
-- versionnee dans ce depot sous sa version reelle. Source : colonne statements, recollee
-- dans l ordre d execution. Le formatage d origine et les commentaires hors instruction
-- sont perdus ; le SQL, lui, est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- SEC-1 lot D — search_path des 2 triggers WARN + REVOKE anon bornés
-- (source repo : supabase/migrations/20260719123000_sec1_d_search_path.sql)

alter function public.email_templates_touch() set search_path = '';
alter function public.set_pavilion_optin_at() set search_path = '';

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

revoke execute on function public.oxv_coach_availability_open_gate() from public, anon;
grant execute on function public.oxv_coach_availability_open_gate() to service_role;

revoke execute on function public.oxv_partner_accounts_validation_gate() from public, anon;
grant execute on function public.oxv_partner_accounts_validation_gate() to service_role;

revoke execute on function public.oxv_partner_offers_publish_gate() from public, anon;
grant execute on function public.oxv_partner_offers_publish_gate() to service_role;
