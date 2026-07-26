-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 07:45:37 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Mesure factuelle des objectifs (côté pilote appelant).
-- Régularité = stddev_pop des tours propres ; record = meilleur tour propre.
-- Périmètre : circuit de l'objectif si défini, sinon toutes pistes confondues.
-- Métriques mesurables aujourd'hui : regularity, personal_best. Les autres (repères/pointe/qualitatif) → non mesurables ici.
create or replace function public.my_objective_progress()
returns table(
  objective_id uuid,
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
  obj as (
    select o.id, o.metric, o.circuit_id, o.baseline_value
    from public.coach_objectives o
    where o.pilot_id = (select uid from me) and o.status = 'active'
  )
  select
    o.id as objective_id,
    (o.metric in ('regularity','personal_best')
      and exists (select 1 from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))) as measurable,
    coalesce(
      o.baseline_value,
      case o.metric
        when 'regularity' then (select s.spread_s from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id) order by s.ts_at asc limit 1)
        when 'personal_best' then (select round(s.best_s, 3) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id) order by s.ts_at asc limit 1)
        else null
      end
    ) as baseline_value,
    case o.metric
      when 'regularity' then (select s.spread_s from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id) order by s.ts_at desc limit 1)
      when 'personal_best' then (select round(min(s.best_s), 3) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id))
      else null
    end as current_value,
    (select count(*)::int from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)) as sample_count,
    (select max(s.day) from sess s where (o.circuit_id is null or s.circuit_id = o.circuit_id)) as last_date
  from obj o;
$$;

grant execute on function public.my_objective_progress() to authenticated;
