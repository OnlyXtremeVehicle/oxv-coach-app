-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 06:06:08, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

create or replace function public.coach_public_card(p_coach_id uuid)
  returns table(coach_id uuid, first_name text, last_name text, public_handle text, avatar_url text)
  language sql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
  select u.id, u.first_name, u.last_name, u.public_handle, u.avatar_url
  from public.users u
  where u.id = p_coach_id
    and (
      u.id = auth.uid()
      or exists (select 1 from public.coach_profiles cp where cp.coach_id = u.id and cp.is_published = true)
      or exists (select 1 from public.coach_pilots l where l.coach_id = u.id and l.pilot_id = auth.uid())
      or public.is_admin()
    );
$function$;
