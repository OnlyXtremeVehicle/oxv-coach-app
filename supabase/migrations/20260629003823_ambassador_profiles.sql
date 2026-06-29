-- PR-77 : Ambassadeur OXV. Le pilote pose sa candidature (pending) et redige sa
-- bio ; OXV (admin) valide le statut. Aucun classement, aucun rang : un role
-- factuel. Le statut est gouverne par OXV (garde trigger ci-dessous).
create table if not exists public.ambassador_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  bio text,
  since date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ambassador_profiles enable row level security;

drop policy if exists ambassador_owner_rw on public.ambassador_profiles;
create policy ambassador_owner_rw on public.ambassador_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ambassador_admin_all on public.ambassador_profiles;
create policy ambassador_admin_all on public.ambassador_profiles
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.ambassador_profiles to authenticated;

-- Le statut ne peut etre change que par un admin (anti auto-promotion).
create or replace function public.ambassador_guard_status()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Le statut ambassadeur est gere par OXV.';
  end if;
  return new;
end $$;

drop trigger if exists ambassador_guard_status_trg on public.ambassador_profiles;
create trigger ambassador_guard_status_trg before update on public.ambassador_profiles
  for each row execute function public.ambassador_guard_status();

drop trigger if exists ambassador_profiles_touch_trg on public.ambassador_profiles;
create trigger ambassador_profiles_touch_trg before update on public.ambassador_profiles
  for each row execute function public.tg_touch_updated_at();
