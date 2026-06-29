-- Fonction partagee : met a jour updated_at sur UPDATE (reutilisee par plusieurs
-- tables de ce lot). SECURITY DEFINER + search_path verrouille (hardening projet).
create or replace function public.tg_touch_updated_at()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- PR-45/46 : configuration applicative globale (singleton, une seule ligne id=true).
--   maintenance_mode + message : kill-switch distant (bloque l'app proprement).
--   min_supported_version : version native minimale ; en-dessous -> MAJ obligatoire.
-- Lecture publique (l'app lit l'etat tres tot, donnees non sensibles).
-- Ecriture admin uniquement (is_admin).
create table if not exists public.app_config (
  id boolean primary key default true,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  min_supported_version text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint app_config_singleton check (id = true)
);

alter table public.app_config enable row level security;

drop policy if exists app_config_read_all on public.app_config;
create policy app_config_read_all on public.app_config for select using (true);

drop policy if exists app_config_admin_write on public.app_config;
create policy app_config_admin_write on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.app_config to anon, authenticated;
grant insert, update on public.app_config to authenticated;

drop trigger if exists app_config_touch_trg on public.app_config;
create trigger app_config_touch_trg before update on public.app_config
  for each row execute function public.tg_touch_updated_at();

insert into public.app_config (id) values (true) on conflict (id) do nothing;
