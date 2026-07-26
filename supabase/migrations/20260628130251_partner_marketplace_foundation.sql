-- PR-F1 (§8, §8.1, §22, §23) : fondation marketplace partenaire. Décision Gabin 2026-06.
-- APPLIQUÉE EN PROD le 2026-06-28 via MCP (migration partner_marketplace_foundation).
--
-- Tables PROPRES partner_accounts/offers/leads. L'ancienne table `partners` (modèle
-- places déprécié) reste en place, NON utilisée ici, NON supprimée.
-- Séparation stricte pilote / partenaire / admin. Le partenaire ne voit JAMAIS la
-- télémétrie (aucune policy sur telemetry_*). Lead = consenti uniquement
-- (consent_contact + consent_at).

-- compte business partenaire (lié à un user role='partner')
create table public.partner_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  type text not null default 'autre' check (type in ('photographe','garage','hotel','restaurant','transport','assurance','loueur','autre')),
  description text,
  logo_url text,
  contact_email text,
  contact_policy text,
  status text not null default 'pending' check (status in ('pending','validated','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_accounts enable row level security;
create trigger update_partner_accounts_updated_at before update on public.partner_accounts
  for each row execute function update_updated_at_column();

create or replace function public.owns_partner_account(account uuid)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.partner_accounts where id = account and profile_id = auth.uid());
$$;

-- Seul un admin peut changer le statut (validation) — pas d'auto-validation.
create or replace function public.guard_partner_account_status()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if new.status is distinct from old.status and not is_admin() then
    new.status := old.status;
  end if;
  return new;
end; $$;
create trigger trg_guard_partner_account_status before update on public.partner_accounts
  for each row execute function public.guard_partner_account_status();

create policy "partner_accounts_select" on public.partner_accounts for select
  using (profile_id = auth.uid() or is_admin() or status = 'validated');
create policy "partner_accounts_insert_self" on public.partner_accounts for insert
  with check (profile_id = auth.uid() and status = 'pending');
create policy "partner_accounts_update_own" on public.partner_accounts for update
  using (profile_id = auth.uid() or is_admin());
create policy "partner_accounts_delete_admin" on public.partner_accounts for delete using (is_admin());

-- offres
create table public.partner_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_accounts(id) on delete cascade,
  event_id uuid,
  title text not null,
  description text,
  price_eur integer,
  quota integer,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_offers enable row level security;
create trigger update_partner_offers_updated_at before update on public.partner_offers
  for each row execute function update_updated_at_column();
create index partner_offers_partner_idx on public.partner_offers(partner_id);

create policy "partner_offers_select" on public.partner_offers for select
  using (status = 'published' or owns_partner_account(partner_id) or is_admin());
create policy "partner_offers_insert_own" on public.partner_offers for insert
  with check (owns_partner_account(partner_id));
create policy "partner_offers_update_own" on public.partner_offers for update
  using (owns_partner_account(partner_id) or is_admin());
create policy "partner_offers_delete_own" on public.partner_offers for delete
  using (owns_partner_account(partner_id) or is_admin());

-- leads (§8.1) : demande de contact CONSENTIE uniquement
create table public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_accounts(id) on delete cascade,
  pilot_id uuid not null references public.users(id) on delete cascade,
  event_id uuid,
  offer_id uuid references public.partner_offers(id) on delete set null,
  consent_contact boolean not null default true,
  consent_at timestamptz not null default now(),
  channel text not null default 'app_oxv' check (channel in ('app_oxv','qr_event','admin')),
  status text not null default 'new' check (status in ('new','contacted','booked','lost','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_leads enable row level security;
create trigger update_partner_leads_updated_at before update on public.partner_leads
  for each row execute function update_updated_at_column();
create index partner_leads_partner_idx on public.partner_leads(partner_id);
create index partner_leads_pilot_idx on public.partner_leads(pilot_id);

create policy "partner_leads_select" on public.partner_leads for select
  using (owns_partner_account(partner_id) or is_admin() or pilot_id = auth.uid());
create policy "partner_leads_insert_pilot" on public.partner_leads for insert
  with check (
    pilot_id = auth.uid()
    and consent_contact = true
    and (offer_id is null or offer_id in (select id from public.partner_offers where status = 'published'))
  );
create policy "partner_leads_update_owner" on public.partner_leads for update
  using (owns_partner_account(partner_id) or is_admin());
create policy "partner_leads_delete_admin" on public.partner_leads for delete using (is_admin());
