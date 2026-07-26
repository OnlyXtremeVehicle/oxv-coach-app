-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 11:16:44 (UTC), elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Objectif de séance fixé par le coach, projeté sur le jour du bilan pilote.
-- Le bilan est groupé par jour (day_rollups) ; le contexte coach est clé sur session_id.
-- On renvoie, pour le pilote authentifié, l'objectif de la séance la plus récente de chaque jour.
-- SECURITY DEFINER : on reproduit explicitement le périmètre pilote dans le WHERE.
create or replace function public.my_session_objectives(p_circuit uuid)
returns table(day date, objective text)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select distinct on (d.day) d.day, d.objective
  from (
    select coalesce(ts.started_at, ts.created_at)::date as day,
           btrim(csc.objective) as objective,
           coalesce(ts.started_at, ts.created_at) as ts_at
    from public.coach_session_context csc
    join public.telemetry_sessions ts on ts.id = csc.session_id
    where csc.pilot_id = auth.uid()
      and ts.user_id = auth.uid()
      and (p_circuit is null or ts.circuit_id = p_circuit)
      and csc.objective is not null
      and length(btrim(csc.objective)) > 0
  ) d
  order by d.day, d.ts_at desc;
$$;
grant execute on function public.my_session_objectives(uuid) to authenticated;
