-- 0023_b2b_event_reports.sql — B2B Event Report (PR-38, M2)
--
-- L'admin GÉNÈRE un rapport figé par (événement, partenaire) : les compteurs de
-- participation sont SNAPSHOTTÉS au moment de la génération (l'admin lit les
-- inscriptions ; le partenaire ne les lit JAMAIS — il ne voit que l'agrégat ici).
-- Le partenaire ne voit le rapport qu'une fois `status = 'shared'`. Aucune donnée
-- pilote individuelle, aucune télémétrie.

create type public.b2b_report_status as enum ('draft', 'shared');

create table public.b2b_event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  partner_id uuid not null references public.partner_accounts (id) on delete cascade,
  registered_count integer not null default 0,
  checked_in_count integer not null default 0,
  media_summary text,
  conclusion text,
  status public.b2b_report_status not null default 'draft',
  generated_by uuid references public.users (id),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, partner_id)
);
create index idx_b2b_reports_event on public.b2b_event_reports (event_id);
create index idx_b2b_reports_partner on public.b2b_event_reports (partner_id);

create trigger trg_b2b_reports_touch before update on public.b2b_event_reports
for each row execute function public.touch_events_updated_at();

alter table public.b2b_event_reports enable row level security;

-- L'admin gère ; le partenaire voit SON rapport UNIQUEMENT s'il est partagé.
create policy b2b_reports_admin_all on public.b2b_event_reports
for all using (public.is_admin()) with check (public.is_admin());

create policy b2b_reports_partner_select on public.b2b_event_reports
for select using (public.owns_partner_account(partner_id) and status = 'shared');
