-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 00:07:32, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

create type public.objective_metric as enum ('regularity','personal_best','corner_braking','corner_speed','top_speed','qualitative');
create type public.objective_direction as enum ('below','above','reach');
create type public.objective_status as enum ('active','achieved','archived');

-- Objectifs de progression : prescription du coach, mesurée factuellement (soi vs soi) contre une cible.
create table public.coach_objectives (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  pilot_id uuid not null references public.users(id) on delete cascade,
  circuit_id uuid references public.circuits(id) on delete set null,
  title text not null,
  detail text,
  metric public.objective_metric not null default 'qualitative',
  corner_index integer check (corner_index is null or corner_index >= 1),
  target_value numeric,
  target_direction public.objective_direction not null default 'below',
  baseline_value numeric,
  priority integer not null default 0,
  status public.objective_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  achieved_at timestamptz
);
comment on table public.coach_objectives is 'Objectifs de progression posés par un coach pour un pilote. La cible (target_value/direction) est mesurée factuellement contre la télémétrie. La prescription appartient au coach ; l''app ne restitue qu''un écart factuel.';
comment on column public.coach_objectives.metric is 'Métrique factuelle de mesure : regularity (spread_s), personal_best (record), corner_braking/corner_speed (adhérence au repère), top_speed, qualitative (apprécié manuellement).';
comment on column public.coach_objectives.baseline_value is 'Valeur de départ figée à la création (référence de progression). NULL tant qu''aucune donnée.';

create index coach_objectives_pilot_status_idx on public.coach_objectives (pilot_id, status);
create index coach_objectives_coach_idx on public.coach_objectives (coach_id);

alter table public.coach_objectives enable row level security;
create policy coach_objectives_coach_manage on public.coach_objectives
  for all using (coach_id = auth.uid() and public.is_coach()) with check (coach_id = auth.uid() and public.is_coach());
create policy coach_objectives_pilot_select on public.coach_objectives
  for select using (pilot_id = auth.uid() and public.is_my_coach(coach_id));
create policy coach_objectives_admin_all on public.coach_objectives
  for all using (public.is_admin()) with check (public.is_admin());
