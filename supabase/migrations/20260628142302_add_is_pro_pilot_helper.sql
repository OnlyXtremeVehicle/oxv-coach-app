-- PR-I : helper de rôle pilote pro (miroir is_partner / is_admin).
-- APPLIQUÉE EN PROD le 2026-06-28 via MCP.
create or replace function public.is_pro_pilot()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'pro_pilot');
$$;
