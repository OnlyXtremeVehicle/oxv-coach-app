-- PR-D (§7, §7.1, §22, §25) : Admin Qualité Data + Équipements. Décision Gabin 2026-06.
-- 3 tables admin-only + source_device_id sur telemetry_sessions.
-- APPLIQUÉE EN PROD le 2026-06-28 via MCP (migration admin_quality_data_and_devices).

-- devices : parc d'équipement (RaceBox, Flic, batteries)
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  type text not null default 'racebox' check (type in ('racebox', 'flic', 'battery', 'other')),
  serial text,
  battery_status text check (battery_status in ('ok', 'low', 'critical', 'unknown')),
  health_status text not null default 'ok' check (health_status in ('ok', 'maintenance', 'defect')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.devices enable row level security;
create policy "devices_admin_all" on public.devices for all using (is_admin()) with check (is_admin());
create trigger update_devices_updated_at before update on public.devices
  for each row execute function update_updated_at_column();

-- device_assignments : affectation d'un boîtier à une session/pilote
create table public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  session_id uuid references public.telemetry_sessions(id) on delete set null,
  pilot_id uuid references public.users(id) on delete set null,
  event_id uuid,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.device_assignments enable row level security;
create policy "device_assignments_admin_all" on public.device_assignments for all using (is_admin()) with check (is_admin());
create index device_assignments_device_idx on public.device_assignments(device_id);
create index device_assignments_session_idx on public.device_assignments(session_id);

-- telemetry_sessions.source_device_id : traçabilité par boîtier
alter table public.telemetry_sessions
  add column source_device_id uuid references public.devices(id) on delete set null;

-- data_quality_reports : état résolu/assigné des anomalies
create table public.data_quality_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.telemetry_sessions(id) on delete cascade,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  type text not null,
  message text,
  status text not null default 'open' check (status in ('open', 'assigned', 'resolved')),
  owner_admin_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.data_quality_reports enable row level security;
create policy "data_quality_reports_admin_all" on public.data_quality_reports for all using (is_admin()) with check (is_admin());
create trigger update_data_quality_reports_updated_at before update on public.data_quality_reports
  for each row execute function update_updated_at_column();
create index data_quality_reports_session_idx on public.data_quality_reports(session_id);
create index data_quality_reports_status_idx on public.data_quality_reports(status);
