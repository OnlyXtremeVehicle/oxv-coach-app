-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 10:51:52 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- 1) Archive jumelle : journal des objectifs COACH (registre coach).
-- ============================================================
create table if not exists public.coach_objective_events (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.coach_objectives(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  pilot_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  from_status text,
  to_status text,
  value_at numeric,
  created_at timestamptz not null default now()
);
alter table public.coach_objective_events enable row level security;

-- Registre du coach : seul le coach auteur (ou un admin) lit l'historique.
drop policy if exists coach_objective_events_coach_read on public.coach_objective_events;
create policy coach_objective_events_coach_read on public.coach_objective_events
  for select using (coach_id = auth.uid() or public.is_admin());

create index if not exists coach_objective_events_obj_idx on public.coach_objective_events (objective_id, created_at);

-- Journalisation : création + transitions de statut, avec valeur mesurée à l'instant.
-- Statuts coach (objective_status) : active / achieved / archived → reactivated quand on revient à actif.
create or replace function public.coach_objectives_log_event()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare k text; v numeric;
begin
  if tg_op = 'INSERT' then
    v := public.measure_metric_now(new.pilot_id, new.metric, new.circuit_id);
    insert into public.coach_objective_events(objective_id, coach_id, pilot_id, kind, from_status, to_status, value_at)
    values (new.id, new.coach_id, new.pilot_id, 'created', null, new.status::text, coalesce(new.baseline_value, v));
    return new;
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    k := case new.status::text
      when 'achieved' then 'achieved'
      when 'archived' then 'archived'
      when 'active' then 'reactivated'
      else new.status::text end;
    v := public.measure_metric_now(new.pilot_id, new.metric, new.circuit_id);
    insert into public.coach_objective_events(objective_id, coach_id, pilot_id, kind, from_status, to_status, value_at)
    values (new.id, new.coach_id, new.pilot_id, k, old.status::text, new.status::text, v);
    return new;
  end if;
  return new;
end $$;

drop trigger if exists trg_obj_log_insert on public.coach_objectives;
create trigger trg_obj_log_insert
  after insert on public.coach_objectives
  for each row execute function public.coach_objectives_log_event();

drop trigger if exists trg_obj_log_update on public.coach_objectives;
create trigger trg_obj_log_update
  after update of status on public.coach_objectives
  for each row execute function public.coach_objectives_log_event();

-- ============================================================
-- 2) Série par séance dans le RPC coach (parité avec my_goal_progress).
-- ============================================================
drop function if exists public.objective_progress_for_pilot(uuid);
create function public.objective_progress_for_pilot(p_pilot_id uuid)
returns table(
  objective_id uuid, measurable boolean, baseline_value numeric, current_value numeric,
  sample_count integer, last_date date, series jsonb
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with sess as (
    select ts.id as session_id, ts.circuit_id,
           coalesce(ts.started_at, ts.created_at) as ts_at,
           coalesce(ts.started_at, ts.created_at)::date as day,
           min(l.duration_seconds) as best_s,
           round(stddev_pop(l.duration_seconds), 3) as spread_s,
           round(avg(l.duration_seconds), 3) as avg_s,
           count(*) as lap_n
    from public.telemetry_sessions ts
    join public.laps l on l.session_id = ts.id
    where ts.user_id = p_pilot_id
      and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
      and l.duration_seconds is not null and l.duration_seconds > 0
    group by ts.id, ts.circuit_id, ts_at, day
  ),
  o as (select co.id, co.metric, co.circuit_id, co.baseline_value
        from public.coach_objectives co
        where co.pilot_id = p_pilot_id and (co.coach_id = auth.uid() or public.is_admin()))
  select
    o.id,
    (o.metric in ('regularity','personal_best','avg_lap','lap_count','sessions')
      and exists (select 1 from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))),
    coalesce(o.baseline_value, case o.metric
      when 'regularity'    then (select s.spread_s from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id) order by s.ts_at asc limit 1)
      when 'personal_best' then (select round(s.best_s, 3) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id) order by s.ts_at asc limit 1)
      when 'avg_lap'       then (select s.avg_s from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id) order by s.ts_at asc limit 1)
      when 'lap_count'     then 0
      when 'sessions'      then 0
      else null end),
    public.measure_metric_now(p_pilot_id, o.metric, o.circuit_id),
    (select count(*)::int from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)),
    (select max(s.day) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)),
    case
      when o.metric = 'regularity' then
        (select jsonb_agg(jsonb_build_object('d', s.day, 'v', s.spread_s) order by s.ts_at)
         from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))
      when o.metric = 'avg_lap' then
        (select jsonb_agg(jsonb_build_object('d', s.day, 'v', s.avg_s) order by s.ts_at)
         from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))
      when o.metric = 'personal_best' then
        (select jsonb_agg(jsonb_build_object('d', x.day, 'v', x.rmin) order by x.ts_at)
         from (select s.day, s.ts_at, round(min(s.best_s) over (order by s.ts_at), 3) as rmin
               from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)) x)
      when o.metric = 'lap_count' then
        (select jsonb_agg(jsonb_build_object('d', x.day, 'v', x.cum) order by x.ts_at)
         from (select s.day, s.ts_at, sum(s.lap_n) over (order by s.ts_at) as cum
               from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)) x)
      else null
    end
  from o;
$$;
grant execute on function public.objective_progress_for_pilot(uuid) to authenticated;
