-- ============================================================================
-- V2-L2 · C1 « Qui roule » — mini-migration AUTORISÉE par le prompt L2.
-- ============================================================================
-- Opt-in de présence : users.show_attendance (défaut false — fail-closed).
-- Lecture par fonction DEFINER gatée : seuls les INSCRITS de la journée voient
-- la liste, et seuls les pilotes OPT-IN y figurent (avatar + handle, jamais le
-- nom complet). users est en RLS own-or-admin : sans cette fonction, aucun
-- pilote ne peut voir les autres — c'est le SEUL canal, borné.
-- ============================================================================

alter table public.users
  add column if not exists show_attendance boolean not null default false;

comment on column public.users.show_attendance is
  'V2-L2 C1 : opt-in « Qui roule » — apparaître (handle + avatar) aux autres inscrits de la même journée. Défaut false.';

create or replace function public.session_attendance_public(p_session uuid)
returns table (user_id uuid, public_handle text, avatar_url text, crew_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id as user_id,
         u.public_handle,
         u.avatar_url,
         cm.crew_id
  from public.registrations r
  join public.users u on u.id = r.user_id
  left join public.crew_members cm on cm.user_id = u.id
  where r.session_id = p_session
    and r.status <> 'cancelled'
    and u.show_attendance = true
    and u.suspended_at is null
    -- Gate : seul un inscrit de CETTE journée peut lire la liste.
    and public.is_registered_for_session(p_session)
$$;

comment on function public.session_attendance_public(uuid) is
  'V2-L2 C1 : inscrits opt-in d''une journée (handle/avatar/crew), lisibles uniquement par un inscrit de la même journée. Fail-closed (opt-in false ou lecteur non inscrit = rien).';

revoke all on function public.session_attendance_public(uuid) from public, anon;
grant execute on function public.session_attendance_public(uuid) to authenticated, service_role;
