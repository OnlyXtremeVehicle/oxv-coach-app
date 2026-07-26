-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Ajoute l'id de l'annotation (le pilote l'utilise pour signer l'URL audio du bucket privé).
drop function if exists public.my_session_annotations(uuid);
create function public.my_session_annotations(p_circuit uuid)
returns table(
  id uuid, day date, corner_index integer, body text, has_audio boolean, coach_name text, created_at timestamptz
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    a.id,
    coalesce(ts.started_at, ts.created_at)::date as day,
    a.corner_index,
    btrim(a.body) as body,
    (a.audio_url is not null) as has_audio,
    coalesce(nullif(btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.public_handle, 'Votre coach') as coach_name,
    a.created_at
  from public.coach_annotations a
  join public.telemetry_sessions ts on ts.id = a.telemetry_session_id
  left join public.users u on u.id = a.coach_id
  where a.pilot_id = auth.uid()
    and a.visibility = 'shared'
    and a.deleted_at is null
    and ts.user_id = auth.uid()
    and (p_circuit is null or ts.circuit_id = p_circuit)
    and a.body is not null and length(btrim(a.body)) > 0
  order by day desc, a.corner_index nulls last, a.created_at;
$$;
grant execute on function public.my_session_annotations(uuid) to authenticated;
