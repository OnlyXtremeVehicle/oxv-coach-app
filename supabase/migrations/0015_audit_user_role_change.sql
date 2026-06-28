-- PR-A' : audit DB des changements de rôle (§10.1 cas 4 ; DoD §30 « audit des rôles
-- sensibles »). Décision Gabin 2026-06. APPLIQUÉE EN PROD le 2026-06-28 via MCP.
--
-- Avant : promoteToCoach/demoteToPilot mutaient users.role sans trace (« à câbler
-- en V1.1 »). Désormais un trigger insère systématiquement dans admin_audit, quel
-- que soit le chemin (client admin ou service_role).

create or replace function public.audit_user_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.role is distinct from old.role then
    insert into public.admin_audit (user_id, action, metadata)
    values (
      new.id,
      'role_changed',
      jsonb_build_object(
        'old_role', old.role,
        'new_role', new.role,
        'changed_by', auth.uid()
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_user_role_change on public.users;
create trigger trg_audit_user_role_change
  after update of role on public.users
  for each row
  execute function public.audit_user_role_change();
