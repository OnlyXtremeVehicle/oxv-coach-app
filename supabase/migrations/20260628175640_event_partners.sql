-- 0022_event_partners.sql — Présence partenaire à un événement (PR-37, M2)
--
-- Lien partenaire ↔ événement (présence). L'offre↔événement existe déjà
-- (`partner_offers.event_id`). Base du B2B Event Report. Aucune télémétrie.

create type public.event_partner_status as enum ('invited', 'confirmed', 'declined');

create table public.event_partners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  partner_id uuid not null references public.partner_accounts (id) on delete cascade,
  status public.event_partner_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (event_id, partner_id)
);
create index idx_event_partners_event on public.event_partners (event_id);
create index idx_event_partners_partner on public.event_partners (partner_id);

alter table public.event_partners enable row level security;

-- L'admin gère ; le partenaire voit SA présence (jamais celle des autres).
create policy event_partners_admin_all on public.event_partners
for all using (public.is_admin()) with check (public.is_admin());

create policy event_partners_partner_select on public.event_partners
for select using (public.owns_partner_account(partner_id));
