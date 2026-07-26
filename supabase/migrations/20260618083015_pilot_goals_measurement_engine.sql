-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 08:30:15 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Objectifs PRIVÉS du pilote (soi vs soi), même moteur de mesure que les objectifs coach.
-- pilot_goals existait en version qualitative (body 1..200 = intitulé). On l'enrichit.
-- Statuts conservés tels quels : active / achieved / continued / abandoned.
alter table public.pilot_goals
  add column if not exists detail text,
  add column if not exists metric public.objective_metric not null default 'qualitative',
  add column if not exists corner_index int,
  add column if not exists target_value numeric,
  add column if not exists target_direction public.objective_direction not null default 'reach',
  add column if not exists baseline_value numeric,
  add column if not exists circuit_id uuid references public.circuits(id) on delete set null,
  add column if not exists priority int not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pilot_goals_corner_index_check') then
    alter table public.pilot_goals add constraint pilot_goals_corner_index_check
      check (corner_index is null or corner_index >= 1);
  end if;
end $$;

comment on column public.pilot_goals.body is 'Intitulé de l''objectif (1..200). Sert de titre côté app.';
comment on column public.pilot_goals.detail is 'Consigne / précision libre (optionnel).';

-- Départ figé à la création (mêmes règles que coach_objectives), sur les sessions du pilote.
create or replace function public.pilot_goals_capture_baseline()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v numeric;
begin
  if new.baseline_value is null and new.metric in ('regularity','personal_best') then
    if new.metric = 'regularity' then
      select round(stddev_pop(l.duration_seconds), 3) into v
      from public.telemetry_sessions ts
      join public.laps l on l.session_id = ts.id
      where ts.user_id = new.user_id
        and (new.circuit_id is null or ts.circuit_id = new.circuit_id)
        and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
        and l.duration_seconds is not null and l.duration_seconds > 0
        and ts.id = (
          select ts2.id from public.telemetry_sessions ts2
          join public.laps l2 on l2.session_id = ts2.id
          where ts2.user_id = new.user_id
            and (new.circuit_id is null or ts2.circuit_id = new.circuit_id)
            and coalesce(l2.is_outlap, false) = false and coalesce(l2.is_inlap, false) = false
            and l2.duration_seconds is not null and l2.duration_seconds > 0
          order by coalesce(ts2.started_at, ts2.created_at) desc
          limit 1
        );
    else
      select round(min(l.duration_seconds), 3) into v
      from public.telemetry_sessions ts
      join public.laps l on l.session_id = ts.id
      where ts.user_id = new.user_id
        and (new.circuit_id is null or ts.circuit_id = new.circuit_id)
        and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
        and l.duration_seconds is not null and l.duration_seconds > 0;
    end if;
    new.baseline_value := v;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_goal_capture_baseline on public.pilot_goals;
create trigger trg_goal_capture_baseline
  before insert on public.pilot_goals
  for each row execute function public.pilot_goals_capture_baseline();

-- Mesure des objectifs privés (pilote appelant), tous statuts confondus.
create or replace function public.my_goal_progress()
returns table(
  goal_id uuid,
  measurable boolean,
  baseline_value numeric,
  current_value numeric,
  sample_count integer,
  last_date date
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with me as (select auth.uid() as uid),
  sess as (
    select ts.id as session_id, ts.circuit_id,
           coalesce(ts.started_at, ts.created_at) as ts_at,
           coalesce(ts.started_at, ts.created_at)::date as day,
           min(l.duration_seconds) as best_s,
           round(stddev_pop(l.duration_seconds), 3) as spread_s
    from public.telemetry_sessions ts
    join public.laps l on l.session_id = ts.id
    where ts.user_id = (select uid from me)
      and coalesce(l.is_outlap, false) = false
      and coalesce(l.is_inlap, false) = false
      and l.duration_seconds is not null
      and l.duration_seconds > 0
    group by ts.id, ts.circuit_id, ts_at, day
  ),
  g as (
    select pg.id, pg.metric, pg.circuit_id, pg.baseline_value
    from public.pilot_goals pg
    where pg.user_id = (select uid from me)
  )
  select
    g.id as goal_id,
    (g.metric in ('regularity','personal_best')
      and exists (select 1 from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id))) as measurable,
    coalesce(
      g.baseline_value,
      case g.metric
        when 'regularity' then (select s.spread_s from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id) order by s.ts_at asc limit 1)
        when 'personal_best' then (select round(s.best_s, 3) from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id) order by s.ts_at asc limit 1)
        else null
      end
    ) as baseline_value,
    case g.metric
      when 'regularity' then (select s.spread_s from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id) order by s.ts_at desc limit 1)
      when 'personal_best' then (select round(min(s.best_s), 3) from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id))
      else null
    end as current_value,
    (select count(*)::int from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id)) as sample_count,
    (select max(s.day) from sess s where (g.circuit_id is null or s.circuit_id = g.circuit_id)) as last_date
  from g;
$$;

grant execute on function public.my_goal_progress() to authenticated;
