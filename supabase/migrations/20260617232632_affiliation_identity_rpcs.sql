-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 a 23:26:32, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Carte publique d'un coach : pour un pilote authentifié si la fiche est publiée OU s'ils sont liés/invités
create or replace function public.coach_public_card(p_coach_id uuid)
returns table(coach_id uuid, first_name text, last_name text, public_handle text, avatar_url text)
language sql stable security definer set search_path to 'public','pg_temp' as $$
  select u.id, u.first_name, u.last_name, u.public_handle, u.avatar_url
  from public.users u
  where u.id = p_coach_id
    and (
      exists (select 1 from public.coach_profiles cp where cp.coach_id = u.id and cp.is_published = true)
      or exists (select 1 from public.coach_pilots l where l.coach_id = u.id and l.pilot_id = auth.uid())
      or public.is_admin()
    );
$$;
grant execute on function public.coach_public_card(uuid) to authenticated;

-- Fiche pilote (identité + sheet) pour un coach lié/invité à ce pilote
create or replace function public.pilot_sheet_for_coach(p_pilot_id uuid)
returns table(pilot_id uuid, first_name text, last_name text, public_handle text, avatar_url text, level text, experience_years integer, vehicles_note text, focus text)
language sql stable security definer set search_path to 'public','pg_temp' as $$
  select u.id, u.first_name, u.last_name, u.public_handle, u.avatar_url,
         s.level, s.experience_years, s.vehicles_note, s.focus
  from public.users u
  left join public.pilot_sheets s on s.pilot_id = u.id
  where u.id = p_pilot_id
    and (
      exists (select 1 from public.coach_pilots l where l.pilot_id = u.id and l.coach_id = auth.uid())
      or public.is_admin()
    );
$$;
grant execute on function public.pilot_sheet_for_coach(uuid) to authenticated;
