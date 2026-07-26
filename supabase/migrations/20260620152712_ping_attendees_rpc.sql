-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 20 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Liste des présents d'un rendez-vous, réservée à l'hôte (owner/created_by) ou admin.
-- SECURITY DEFINER : la garde interne limite l'accès aux inscrits du rendez-vous de l'appelant,
-- sans ouvrir la lecture de `users` à autrui côté client.
create or replace function public.ping_attendees(p_ping_id uuid)
returns table (user_id uuid, display_name text, avatar_url text, responded_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id,
         nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), '') as display_name,
         u.avatar_url,
         r.created_at as responded_at
  from ping_rsvps r
  join users u on u.id = r.user_id
  where r.ping_id = p_ping_id
    and (
      is_admin()
      or exists (
        select 1 from social_pings p
        where p.id = p_ping_id and (p.owner_id = auth.uid() or p.created_by = auth.uid())
      )
    )
  order by r.created_at asc;
$$;

revoke all on function public.ping_attendees(uuid) from public;
grant execute on function public.ping_attendees(uuid) to authenticated;
