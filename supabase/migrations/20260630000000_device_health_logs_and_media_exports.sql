-- Partiels équipement + média (V9). device_health_logs = HISTORIQUE santé boîtier
-- (le snapshot courant reste sur devices) ; media_exports = journal d'exports
-- (OXV Moment). Décisions Gabin (30/06) : alim au connect BLE ; pilote lit via
-- device_assignments ; media_exports own-row.

create table public.device_health_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  battery_status text,
  health_status text,
  rssi integer,
  recorded_at timestamptz not null default now(),
  source text
);

create index idx_device_health_logs_device
  on public.device_health_logs (device_id, recorded_at desc);

alter table public.device_health_logs enable row level security;

-- Admin : gestion du parc (toutes opérations).
create policy device_health_logs_admin_all on public.device_health_logs
for all to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- Pilote : LECTURE des relevés d'un boîtier qui lui est (ou lui a été) affecté.
create policy device_health_logs_pilot_select on public.device_health_logs
for select to authenticated
using (
  exists (
    select 1 from public.device_assignments da
    where da.device_id = device_health_logs.device_id and da.pilot_id = auth.uid()
  )
);

create table public.media_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_media_id uuid references public.session_media (id) on delete set null,
  telemetry_session_id uuid references public.telemetry_sessions (id) on delete set null,
  export_type text not null check (export_type in ('image', 'link', 'story', 'pdf')),
  created_at timestamptz not null default now()
);

create index idx_media_exports_user
  on public.media_exports (user_id, created_at desc);

alter table public.media_exports enable row level security;

-- Own-row : le pilote voit/écrit SES exports. Aucun accès partenaire (§148).
create policy media_exports_owner_all on public.media_exports
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy media_exports_admin_select on public.media_exports
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

comment on table public.device_health_logs is
  'Historique sante boitier (V9) : batterie/health/signal horodate. Snapshot courant sur devices. Admin gere ; pilote lit son boitier affecte (device_assignments).';
comment on table public.media_exports is
  'Journal d exports media (V9, OXV Moment) : image/lien/story/pdf. Own-row pilote ; jamais partenaire.';
