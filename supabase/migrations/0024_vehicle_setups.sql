-- 0024_vehicle_setups.sql — Journal de réglages véhicule (Garage enrichi, M3)
--
-- La table `vehicles` existe déjà (own-row). On ajoute le JOURNAL DE RÉGLAGES :
-- pneus, freins, pressions départ/retour, notes, horodaté, lié optionnellement
-- à une session. Propriété dérivée du véhicule (own-row), pas de dénormalisation.
-- Pressions en bar. Aucun jugement sur les réglages (miroir).

create table public.vehicle_setups (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  session_id uuid references public.telemetry_sessions (id) on delete set null,
  tires text,
  brakes text,
  pressure_front_start numeric(3, 1),
  pressure_rear_start numeric(3, 1),
  pressure_front_end numeric(3, 1),
  pressure_rear_end numeric(3, 1),
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_vehicle_setups_vehicle on public.vehicle_setups (vehicle_id, recorded_at desc);

alter table public.vehicle_setups enable row level security;

-- Own-row dérivé du véhicule : le pilote gère les réglages de SES véhicules.
create policy vehicle_setups_owner_all on public.vehicle_setups
for all using (
  exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.user_id = auth.uid()
  )
);
