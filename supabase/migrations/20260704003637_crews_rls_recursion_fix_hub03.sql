-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:36:37 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-03 fix : récursion RLS sur crew_members (policy auto-référente détectée par test).
-- Helper definer : l'écurie de l'utilisateur courant, sans passer par la RLS.
create or replace function public.oxv_my_crew_id()
returns uuid language sql stable security definer set search_path = public as
$$ select crew_id from public.crew_members where user_id = (select auth.uid()) limit 1 $$;
revoke execute on function public.oxv_my_crew_id() from public, anon;
grant execute on function public.oxv_my_crew_id() to authenticated;

drop policy crew_members_select_own_crew on public.crew_members;
create policy crew_members_select_own_crew on public.crew_members
  for select to authenticated
  using (is_admin() or crew_id = public.oxv_my_crew_id());

drop policy crews_select_member on public.crews;
create policy crews_select_member on public.crews
  for select to authenticated
  using (is_admin() or id = public.oxv_my_crew_id());
