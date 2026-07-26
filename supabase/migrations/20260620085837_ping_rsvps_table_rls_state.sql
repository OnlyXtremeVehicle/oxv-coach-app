-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 20 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

create table if not exists public.ping_rsvps (
  ping_id uuid not null references public.social_pings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ping_id, user_id)
);
alter table public.ping_rsvps enable row level security;

create policy ping_rsvps_insert_own on public.ping_rsvps
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_validated_member()
    and exists (select 1 from public.social_pings p where p.id = ping_id and p.is_published)
  );

create policy ping_rsvps_delete_own on public.ping_rsvps
  for delete to authenticated
  using (user_id = auth.uid());

create policy ping_rsvps_select_own_or_host on public.ping_rsvps
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from public.social_pings p
      where p.id = ping_id and (p.owner_id = auth.uid() or p.created_by = auth.uid())
    )
  );

create or replace function public.ping_rsvp_state(p_ids uuid[])
returns table(ping_id uuid, going_count int, i_go boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id as ping_id,
         coalesce(c.cnt, 0)::int as going_count,
         exists(select 1 from public.ping_rsvps r where r.ping_id = p.id and r.user_id = auth.uid()) as i_go
  from unnest(p_ids) as p(id)
  left join (
    select ping_id, count(*) as cnt from public.ping_rsvps group by ping_id
  ) c on c.ping_id = p.id;
$$;

revoke all on function public.ping_rsvp_state(uuid[]) from public, anon;
grant execute on function public.ping_rsvp_state(uuid[]) to authenticated;
