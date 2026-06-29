-- PR-85 : feature flags + versions d'algos. Cle/valeur, lecture par tout user
-- authentifie (l'app lit pour activer/desactiver une fonctionnalite), ecriture admin.
create table if not exists public.app_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  value jsonb,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_feature_flags enable row level security;

drop policy if exists app_feature_flags_read on public.app_feature_flags;
create policy app_feature_flags_read on public.app_feature_flags for select using (true);

drop policy if exists app_feature_flags_admin_write on public.app_feature_flags;
create policy app_feature_flags_admin_write on public.app_feature_flags
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.app_feature_flags to authenticated;
grant insert, update, delete on public.app_feature_flags to authenticated;

drop trigger if exists app_feature_flags_touch_trg on public.app_feature_flags;
create trigger app_feature_flags_touch_trg before update on public.app_feature_flags
  for each row execute function public.tg_touch_updated_at();
