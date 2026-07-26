-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 17 juin 2026 a 23:26:46, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Drapeau global : facturation activée ? (off tant que Stripe/SIRET pas prêts)
create table public.app_settings (
  id boolean primary key default true,
  billing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);
comment on table public.app_settings is 'Paramètres globaux (ligne unique). billing_enabled=false -> portillon abonnement permissif (Phase 0).';
insert into public.app_settings (id) values (true) on conflict do nothing;
alter table public.app_settings enable row level security;
create policy app_settings_read_authenticated on public.app_settings for select using (auth.uid() is not null);
create policy app_settings_admin_all on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- Abonnements OXV (par rôle, par saison). Créés par le système de facturation / admin, jamais self-insert.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope public.subscription_scope not null,
  season text not null,
  status public.subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, season)
);
comment on table public.subscriptions is 'Abonnements OXV (coach 750/saison, pilote ~99/an). À jour = status active et période non échue. Encaissement Phase 1 (Stripe).';
alter table public.subscriptions enable row level security;
create policy subscriptions_owner_select on public.subscriptions for select using (user_id = auth.uid());
create policy subscriptions_admin_all on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

-- Portillon : permissif si facturation off, sinon exige un abonnement actif et non échu
create or replace function public.is_subscription_current(p_user_id uuid, p_scope public.subscription_scope)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select case
    when not coalesce((select billing_enabled from public.app_settings where id), false) then true
    else exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user_id and s.scope = p_scope
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
    )
  end;
$$;
grant execute on function public.is_subscription_current(uuid, public.subscription_scope) to authenticated;
