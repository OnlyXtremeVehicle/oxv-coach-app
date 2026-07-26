-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 16:54:22, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Correctifs audit lancement (2026-07-04) :
-- 1) Compteur Founding public : le comptage client sur contact_messages était
--    bloqué par la RLS (anon lisait 0 -> compteur toujours faux). Agrégat sans PII.
create or replace function public.oxv_founding_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select least(30, count(*))::int
  from public.contact_messages
  where subject = 'Candidature Founding Members'
$$;
revoke execute on function public.oxv_founding_count() from public;
grant execute on function public.oxv_founding_count() to anon, authenticated;

-- 2) Annuaire plateau OPT-IN : loadPlateau visait une table profiles inexistante
--    et aurait exposé des noms sans consentement. Vue definer limitée aux membres
--    ayant choisi la visibilité NOMINATIVE (prénom + initiale + ville uniquement).
create view public.plateau_members_public as
select
  u.first_name,
  left(coalesce(u.last_name, ''), 1) as last_initial,
  u.address_city as city
from public.users u
where u.community_visibility = 'nominative'
  and coalesce(u.first_name, '') <> '';

comment on view public.plateau_members_public is
  'Annuaire public du plateau — UNIQUEMENT les membres opt-in nominatifs (users.community_visibility). Aucune donnée au-delà de prénom + initiale + ville.';

revoke all on public.plateau_members_public from public;
grant select on public.plateau_members_public to anon, authenticated;
