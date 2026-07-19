-- ============================================================================
-- BE-1 · Livrable 5.4 — Convois (C2) : rejoindre une route certifiée vers une
-- journée. crews/crew_members existent déjà (cf. 12_CREWS_PROD.md) — SEULS
-- convoys / convoy_participants sont créés ici.
-- ============================================================================
-- Accès borné aux INSCRITS de la journée : on lit/rejoint un convoi seulement
-- si l'on a une inscription non annulée à la session concernée (EXISTS
-- registrations). Le créateur du convoi gère le sien.
-- ============================================================================

create table if not exists public.convoys (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  route_id uuid null references public.scenic_routes(id) on delete set null,
  created_by uuid not null references public.users(id) on delete cascade,
  meeting_point text null,
  rdv_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.convoy_participants (
  convoy_id uuid not null references public.convoys(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (convoy_id, user_id)
);

alter table public.convoys enable row level security;
alter table public.convoy_participants enable row level security;

-- ----------------------------------------------------------------------------
-- Helper : suis-je inscrit (non annulé) à la journée d'un convoi ?
-- ----------------------------------------------------------------------------
create or replace function public.is_registered_for_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.registrations r
    where r.session_id = p_session
      and r.user_id = auth.uid()
      and r.status <> 'cancelled'
  );
$$;

revoke all on function public.is_registered_for_session(uuid) from public, anon;
grant execute on function public.is_registered_for_session(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- convoys : les inscrits de la journée lisent ; le créateur (inscrit) gère.
-- ----------------------------------------------------------------------------
drop policy if exists convoys_select_registered on public.convoys;
create policy convoys_select_registered on public.convoys
  for select to authenticated
  using (public.is_admin() or public.is_registered_for_session(session_id));

drop policy if exists convoys_insert_registered on public.convoys;
create policy convoys_insert_registered on public.convoys
  for insert to authenticated
  with check (auth.uid() = created_by and public.is_registered_for_session(session_id));

drop policy if exists convoys_owner_manage on public.convoys;
create policy convoys_owner_manage on public.convoys
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists convoys_owner_delete on public.convoys;
create policy convoys_owner_delete on public.convoys
  for delete to authenticated
  using (auth.uid() = created_by or public.is_admin());

-- ----------------------------------------------------------------------------
-- convoy_participants : lecture par les inscrits de la journée du convoi ;
-- on rejoint/quitte pour SOI seulement (et si inscrit à la journée).
-- ----------------------------------------------------------------------------
drop policy if exists convoy_participants_select on public.convoy_participants;
create policy convoy_participants_select on public.convoy_participants
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.convoys c
      where c.id = convoy_participants.convoy_id
        and public.is_registered_for_session(c.session_id)
    )
  );

drop policy if exists convoy_participants_join on public.convoy_participants;
create policy convoy_participants_join on public.convoy_participants
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.convoys c
      where c.id = convoy_participants.convoy_id
        and public.is_registered_for_session(c.session_id)
    )
  );

drop policy if exists convoy_participants_leave on public.convoy_participants;
create policy convoy_participants_leave on public.convoy_participants
  for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

create index if not exists convoys_session on public.convoys(session_id);
create index if not exists convoy_participants_user on public.convoy_participants(user_id);

-- Purge compte : couverte par purge_user_data() (migration _purge_extend).
