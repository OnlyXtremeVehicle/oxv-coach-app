-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 08:20:07 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Fige le « départ » au moment où le coaching commence : à la création d'un objectif
-- mesurable sans baseline fournie, capture la valeur actuelle du pilote au périmètre de l'objectif.
-- Régularité = dispersion de la dernière séance ; record = meilleur tour propre.
-- Reste null s'il n'y a pas encore de tour propre (le RPC retombe alors sur la 1re séance).
create or replace function public.coach_objectives_capture_baseline()
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
      where ts.user_id = new.pilot_id
        and (new.circuit_id is null or ts.circuit_id = new.circuit_id)
        and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
        and l.duration_seconds is not null and l.duration_seconds > 0
        and ts.id = (
          select ts2.id
          from public.telemetry_sessions ts2
          join public.laps l2 on l2.session_id = ts2.id
          where ts2.user_id = new.pilot_id
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
      where ts.user_id = new.pilot_id
        and (new.circuit_id is null or ts.circuit_id = new.circuit_id)
        and coalesce(l.is_outlap, false) = false and coalesce(l.is_inlap, false) = false
        and l.duration_seconds is not null and l.duration_seconds > 0;
    end if;
    new.baseline_value := v;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_baseline on public.coach_objectives;
create trigger trg_capture_baseline
  before insert on public.coach_objectives
  for each row execute function public.coach_objectives_capture_baseline();
