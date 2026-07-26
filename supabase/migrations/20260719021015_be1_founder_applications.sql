-- ============================================================================
-- BE-1 · Livrable 3 — Candidatures Membre Fondateur (A2).
-- ============================================================================
-- own insert/select ; admin all ; le STATUS ne peut passer à approved/declined
-- que par un admin (trigger anti self-approve, patron du guard users.role).
-- Compteur public « x/30 » via founders_count() (approved uniquement, jamais
-- de listing des candidats).
-- ============================================================================

create table if not exists public.founder_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  motivation text not null check (char_length(motivation) between 20 and 2000),
  referrer_code text null,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decided_by uuid null references public.users(id),
  decided_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.founder_applications enable row level security;

-- Le candidat lit SA candidature.
drop policy if exists founder_apps_select_own on public.founder_applications;
create policy founder_apps_select_own on public.founder_applications
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Le candidat crée SA candidature en 'pending' (le trigger garantit le statut).
drop policy if exists founder_apps_insert_own on public.founder_applications;
create policy founder_apps_insert_own on public.founder_applications
  for insert to authenticated
  with check (auth.uid() = user_id);

-- L'admin décide (UPDATE) et gère.
drop policy if exists founder_apps_admin_all on public.founder_applications;
create policy founder_apps_admin_all on public.founder_applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Garde anti self-approve : un non-admin ne peut ni insérer autre chose que
-- 'pending', ni changer le status d'une ligne existante. Seul un admin décide.
-- ----------------------------------------------------------------------------
create or replace function public.tg_founder_app_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    -- L'admin décide : on horodate et on trace le décideur.
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
    return new;
  end if;
  -- Non-admin : le status ne peut être QUE 'pending'.
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'Seul un administrateur peut décider d''une candidature fondateur';
  end if;
  return new;
end;
$$;

revoke all on function public.tg_founder_app_guard() from public, anon;

drop trigger if exists founder_app_guard on public.founder_applications;
create trigger founder_app_guard
  before insert or update on public.founder_applications
  for each row execute function public.tg_founder_app_guard();

-- ----------------------------------------------------------------------------
-- Compteur public « x/30 » — approved uniquement, aucun listing.
-- ----------------------------------------------------------------------------
create or replace function public.founders_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from public.founder_applications where status = 'approved';
$$;

comment on function public.founders_count() is
  'BE-1 : nombre de Membres Fondateurs validés (jauge x/30). Aucun listing.';

revoke all on function public.founders_count() from public;
grant execute on function public.founders_count() to anon, authenticated, service_role;
