-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 08:48:38 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- 1) Helper de mesure unique (valeur ACTUELLE d'une métrique pour un pilote, à un périmètre).
-- ============================================================
create or replace function public.measure_metric_now(p_user uuid, p_metric public.objective_metric, p_circuit uuid)
returns numeric
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with sess as (
    select ts.id, coalesce(ts.started_at, ts.created_at) as ts_at,
           min(l.duration_seconds) as best_s,
           round(stddev_pop(l.duration_seconds), 3) as spread_s,
           round(avg(l.duration_seconds), 3) as avg_s,
           count(*) as lap_n
    from public.telemetry_sessions ts
    join public.laps l on l.session_id = ts.id
    where ts.user_id = p_user
      and (p_circuit is null or ts.circuit_id = p_circuit)
      and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
      and l.duration_seconds is not null and l.duration_seconds > 0
    group by ts.id, ts_at
  )
  select case p_metric
    when 'regularity'    then (select spread_s from sess order by ts_at desc limit 1)
    when 'personal_best' then (select round(min(best_s), 3) from sess)
    when 'avg_lap'       then (select avg_s from sess order by ts_at desc limit 1)
    when 'lap_count'     then (select case when count(*) = 0 then null else sum(lap_n) end from sess)
    when 'sessions'      then (select case when count(*) = 0 then null else count(*) end from sess)
    else null
  end;
$$;
grant execute on function public.measure_metric_now(uuid, public.objective_metric, uuid) to authenticated;

-- ============================================================
-- 2) Déclencheurs de départ figé : étendus aux nouvelles métriques via le helper.
-- ============================================================
create or replace function public.pilot_goals_capture_baseline()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.baseline_value is null and new.metric in ('regularity','personal_best','avg_lap','lap_count','sessions') then
    new.baseline_value := public.measure_metric_now(new.user_id, new.metric, new.circuit_id);
  end if;
  return new;
end $$;

create or replace function public.coach_objectives_capture_baseline()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.baseline_value is null and new.metric in ('regularity','personal_best','avg_lap','lap_count','sessions') then
    new.baseline_value := public.measure_metric_now(new.pilot_id, new.metric, new.circuit_id);
  end if;
  return new;
end $$;

-- ============================================================
-- 3) Archive : journal des événements d'objectifs privés (création, transitions de statut).
-- ============================================================
create table if not exists public.pilot_goal_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.pilot_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  from_status text,
  to_status text,
  value_at numeric,
  created_at timestamptz not null default now()
);
alter table public.pilot_goal_events enable row level security;
drop policy if exists pilot_goal_events_owner_read on public.pilot_goal_events;
create policy pilot_goal_events_owner_read on public.pilot_goal_events
  for select using (user_id = auth.uid());
create index if not exists pilot_goal_events_goal_idx on public.pilot_goal_events (goal_id, created_at);

create or replace function public.pilot_goals_log_event()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare k text; v numeric;
begin
  if tg_op = 'INSERT' then
    v := public.measure_metric_now(new.user_id, new.metric, new.circuit_id);
    insert into public.pilot_goal_events(goal_id, user_id, kind, from_status, to_status, value_at)
    values (new.id, new.user_id, 'created', null, new.status, coalesce(new.baseline_value, v));
    return new;
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    k := case new.status
      when 'achieved' then 'achieved'
      when 'abandoned' then 'abandoned'
      when 'continued' then 'continued'
      when 'active' then 'reactivated'
      else new.status end;
    v := public.measure_metric_now(new.user_id, new.metric, new.circuit_id);
    insert into public.pilot_goal_events(goal_id, user_id, kind, from_status, to_status, value_at)
    values (new.id, new.user_id, k, old.status, new.status, v);
    return new;
  end if;
  return new;
end $$;

drop trigger if exists trg_goal_log_insert on public.pilot_goals;
create trigger trg_goal_log_insert
  after insert on public.pilot_goals
  for each row execute function public.pilot_goals_log_event();

drop trigger if exists trg_goal_log_update on public.pilot_goals;
create trigger trg_goal_log_update
  after update of status on public.pilot_goals
  for each row execute function public.pilot_goals_log_event();

-- ============================================================
-- 4) RPC objectifs privés : mesure étendue + série par séance (évolution).
-- ============================================================
drop function if exists public.my_goal_progress();
create function public.my_goal_progress()
returns table(
  goal_id uuid, measurable boolean, baseline_value numeric, current_value numeric,
  sample_count integer, last_date date, series jsonb
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with me as (select auth.uid() as uid),
  sess as (
    select ts.id as session_id, ts.circuit_id,
           coalesce(ts.started_at, ts.created_at) as ts_at,
           coalesce(ts.started_at, ts.created_at)::date as day,
           min(l.duration_seconds) as best_s,
           round(stddev_pop(l.duration_seconds), 3) as spread_s,
           round(avg(l.duration_seconds), 3) as avg_s,
           count(*) as lap_n
    from public.telemetry_sessions ts
    join public.laps l on l.session_id = ts.id
    where ts.user_id = (select uid from me)
      and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
      and l.duration_seconds is not null and l.duration_seconds > 0
    group by ts.id, ts.circuit_id, ts_at, day
  ),
  g as (select pg.id, pg.metric, pg.circuit_id, pg.baseline_value
        from public.pilot_goals pg where pg.user_id = (select uid from me))
  select
    g.id,
    (g.metric in ('regularity','personal_best','avg_lap','lap_count','sessions')
      and exists (select 1 from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id))),
    coalesce(g.baseline_value, case g.metric
      when 'regularity'    then (select s.spread_s from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id) order by s.ts_at asc limit 1)
      when 'personal_best' then (select round(s.best_s, 3) from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id) order by s.ts_at asc limit 1)
      when 'avg_lap'       then (select s.avg_s from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id) order by s.ts_at asc limit 1)
      when 'lap_count'     then 0
      when 'sessions'      then 0
      else null end),
    public.measure_metric_now((select uid from me), g.metric, g.circuit_id),
    (select count(*)::int from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id)),
    (select max(s.day) from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id)),
    case
      when g.metric = 'regularity' then
        (select jsonb_agg(jsonb_build_object('d', s.day, 'v', s.spread_s) order by s.ts_at)
         from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id))
      when g.metric = 'avg_lap' then
        (select jsonb_agg(jsonb_build_object('d', s.day, 'v', s.avg_s) order by s.ts_at)
         from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id))
      when g.metric = 'personal_best' then
        (select jsonb_agg(jsonb_build_object('d', x.day, 'v', x.rmin) order by x.ts_at)
         from (select s.day, s.ts_at, round(min(s.best_s) over (order by s.ts_at), 3) as rmin
               from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id)) x)
      when g.metric = 'lap_count' then
        (select jsonb_agg(jsonb_build_object('d', x.day, 'v', x.cum) order by x.ts_at)
         from (select s.day, s.ts_at, sum(s.lap_n) over (order by s.ts_at) as cum
               from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id)) x)
      else null
    end
  from g;
$$;
grant execute on function public.my_goal_progress() to authenticated;

-- ============================================================
-- 5) RPC objectifs coach : mesure étendue (current via helper, fallback + measurable enrichis).
-- ============================================================
create or replace function public.my_objective_progress()
returns table(
  objective_id uuid, measurable boolean, baseline_value numeric, current_value numeric,
  sample_count integer, last_date date
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with me as (select auth.uid() as uid),
  sess as (
    select ts.id as session_id, ts.circuit_id,
           coalesce(ts.started_at, ts.created_at) as ts_at,
           coalesce(ts.started_at, ts.created_at)::date as day,
           min(l.duration_seconds) as best_s,
           round(stddev_pop(l.duration_seconds), 3) as spread_s,
           round(avg(l.duration_seconds), 3) as avg_s,
           count(*) as lap_n
    from public.telemetry_sessions ts
    join public.laps l on l.session_id = ts.id
    where ts.user_id = (select uid from me)
      and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
      and l.duration_seconds is not null and l.duration_seconds > 0
    group by ts.id, ts.circuit_id, ts_at, day
  ),
  o as (select co.id, co.metric, co.circuit_id, co.baseline_value
        from public.coach_objectives co
        where co.pilot_id = (select uid from me) and co.status = 'active')
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
    public.measure_metric_now((select uid from me), o.metric, o.circuit_id),
    (select count(*)::int from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)),
    (select max(s.day) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))
  from o;
$$;
grant execute on function public.my_objective_progress() to authenticated;

create or replace function public.objective_progress_for_pilot(p_pilot_id uuid)
returns table(
  objective_id uuid, measurable boolean, baseline_value numeric, current_value numeric,
  sample_count integer, last_date date
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
    (select max(s.day) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))
  from o;
$$;
grant execute on function public.objective_progress_for_pilot(uuid) to authenticated;
