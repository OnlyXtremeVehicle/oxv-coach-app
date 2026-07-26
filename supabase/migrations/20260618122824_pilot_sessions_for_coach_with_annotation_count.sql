-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Enrichit la liste des séances d'un coach d'un compteur d'annotations (les siennes, non supprimées),
-- pour marquer dans le sélecteur les séances déjà annotées. Le contexte reste en regard.
drop function if exists public.pilot_sessions_for_coach(uuid);
create function public.pilot_sessions_for_coach(p_pilot_id uuid)
returns table(
  session_id uuid, day date, circuit_id uuid, circuit_name text, vehicle_label text,
  lap_count integer, best_lap_s numeric,
  has_context boolean, objective text, pilot_level text, equipment text, weather_note text,
  annotation_count integer
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    ts.id,
    coalesce(ts.started_at, ts.created_at)::date,
    ts.circuit_id,
    coalesce(c.name, ts.circuit_name),
    coalesce(ts.vehicle_label, ts.custom_name),
    ts.lap_count,
    case when ts.best_lap_seconds is not null then round(ts.best_lap_seconds::numeric, 3) else null end,
    (csc.id is not null),
    csc.objective, csc.pilot_level, csc.equipment, csc.weather_note,
    (select count(*)::int from public.coach_annotations a
       where a.telemetry_session_id = ts.id and a.coach_id = auth.uid() and a.deleted_at is null)
  from public.telemetry_sessions ts
  left join public.circuits c on c.id = ts.circuit_id
  left join public.coach_session_context csc on csc.session_id = ts.id and csc.coach_id = auth.uid()
  where ts.user_id = p_pilot_id and public.is_coach_of(p_pilot_id)
  order by coalesce(ts.started_at, ts.created_at) desc
  limit 50;
$$;
grant execute on function public.pilot_sessions_for_coach(uuid) to authenticated;
