-- 0021_events.sql — Socle Événements (PR-20, M2)
--
-- `events` : table PARTAGÉE site↔app, DDL aligné sur docs/test_alpha/02
-- (le site la crée aussi en `if not exists` → no-op si déjà là). Le site gère
-- la création/réservation ; l'app la LIT (Pass OXV, check-in, bandeau démo,
-- B2B Report) et y rattache ses captures via `telemetry_sessions.event_id`.
-- Le bandeau « mode démo » du Bilan se DÉRIVE de `event_type != 'session'`
-- (pas de colonne `context` séparée).
-- `event_registrations` : inscriptions + check-in QR, propres à l'app.
--
-- internal_notes n'est jamais sélectionné par les services pilote (contrôle au
-- niveau requête, comme users.admin_notes) — l'admin seul le lit.

-- events --------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  event_type text not null default 'session' check (event_type in (
    'session', 'balade_decouverte', 'test_alpha', 'partenaire', 'corporate'
  )),
  status text not null default 'draft' check (status in (
    'draft', 'private', 'public', 'closed', 'finished', 'cancelled'
  )),
  location_name text not null,
  location_address text,
  location_coordinates point,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  briefing_at timestamptz,
  max_pilots integer not null default 20,
  current_pilots integer not null default 0,
  pricing jsonb not null default '{}',
  description text,
  internal_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_status on public.events (status);
create index if not exists idx_events_starts_at on public.events (starts_at);
create index if not exists idx_events_slug on public.events (slug);

create or replace function public.touch_events_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_events_touch before update on public.events
for each row execute function public.touch_events_updated_at();

alter table public.events enable row level security;
-- Visibilité alignée spec : public/closed/finished pour tous ; private par lien
-- (slug obscur) ; draft/cancelled = admin seul. Admin gère tout.
create policy events_select_public on public.events
for select using (status in ('public', 'closed', 'finished'));
create policy events_select_private on public.events
for select using (status = 'private');
create policy events_admin_all on public.events
for all using (public.is_admin()) with check (public.is_admin());

-- lien capture app → événement ----------------------------------------------
alter table public.telemetry_sessions
  add column if not exists event_id uuid references public.events (id) on delete set null;
create index if not exists idx_telemetry_sessions_event_id
  on public.telemetry_sessions (event_id);

-- inscriptions app + check-in -----------------------------------------------
create type public.event_registration_status as enum (
  'registered', 'checked_in', 'cancelled', 'no_show'
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  pilot_id uuid not null references public.users (id) on delete cascade,
  status public.event_registration_status not null default 'registered',
  checked_in_at timestamptz,
  checked_in_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, pilot_id)
);
create index if not exists idx_event_registrations_event
  on public.event_registrations (event_id);
create index if not exists idx_event_registrations_pilot
  on public.event_registrations (pilot_id);

create trigger trg_event_registrations_touch before update on public.event_registrations
for each row execute function public.touch_events_updated_at();

alter table public.event_registrations enable row level security;
-- Le pilote voit/crée les SIENNES (inscription) ; le check-in (statut) = admin.
create policy event_reg_select on public.event_registrations
for select using (pilot_id = auth.uid() or public.is_admin());
create policy event_reg_insert on public.event_registrations
for insert with check (pilot_id = auth.uid() and status = 'registered');
create policy event_reg_admin_update on public.event_registrations
for update using (public.is_admin()) with check (public.is_admin());

-- seed Balade Découverte (idempotent) ---------------------------------------
insert into public.events (
  name, slug, event_type, status, location_name, location_address,
  starts_at, ends_at, briefing_at, max_pilots, pricing, description, internal_notes
) values (
  'Balade Découverte OXV — 5 juillet 2026',
  'balade-decouverte-5juillet-2026',
  'balade_decouverte', 'private',
  'Bouteville, Charente', 'Place de Bouteville, 16120 Bouteville',
  '2026-07-05 09:00:00+02', '2026-07-05 15:00:00+02', '2026-07-05 09:30:00+02',
  12, '{"balade_decouverte": 0}'::jsonb,
  'Demi-journée de balade automobile entre amis dans la campagne charentaise. Test alpha du parcours OXV Mirror. Conduite normale, respect du Code de la route, événement privé.',
  'Test alpha avec amis pour validation parcours client et app OXV Mirror. Décharge de responsabilité à faire signer sur place. Restauration prévue après le convoi.'
) on conflict (slug) do nothing;
