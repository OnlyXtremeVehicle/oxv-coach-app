-- Durcissement sécurité — verrou anti-élévation de privilèges (T10) + search_path
--
-- Contexte : audit advisors (projet prod fouvuqkdxarjpjbqnsjq) du 2026-06-20.
-- Deux éléments, tous deux confirmés sûrs et non destructifs :
--
--   BLOC 1 (T10, CORRECTIF SÉCURITÉ RÉEL) — empêche un utilisateur de modifier
--           lui-même les colonnes privilégiées `role` et `kyc_status`.
--   BLOC 2 (hygiène) — fixe le search_path de uuid_or_null, oubliée dans la
--           migration 20260615190000_harden_function_search_path_and_revoke_internal.
--
-- Migration idempotente (CREATE OR REPLACE, DROP TRIGGER IF EXISTS, ALTER).
-- NON destructive : aucune donnée touchée, aucune policy modifiée.

-- ============================================================================
-- BLOC 1 — Verrou role / kyc_status (T10)
-- ============================================================================
-- Faille fermée : la policy `users_update_own_or_admin` est
--   USING/WITH CHECK = ((id = auth.uid()) OR is_admin())
-- sans restriction de colonne. Un pilote connecté peut donc exécuter
--   UPDATE public.users SET role = 'admin' WHERE id = auth.uid();
-- et s'auto-promouvoir admin, ou poser kyc_status = 'validated' pour
-- contourner le KYC. Restreindre la policy par colonne n'est pas possible en
-- RLS Postgres ; on pose donc un trigger BEFORE UPDATE qui bloque tout
-- changement de ces deux colonnes émanant d'un rôle non habilité.
--
-- Rôles autorisés à changer role/kyc_status :
--   - service_role        : Edge Functions / backend (validation KYC, etc.)
--   - postgres / supabase_admin / supabase_auth_admin : migrations, dashboard
--   - un authenticated qui est admin (public.is_admin() = true) : promotion
--     coach/admin depuis le back-office app.
-- Bloqué : un authenticated non-admin modifiant sa propre ligne.
--
-- SECURITY INVOKER (défaut) : current_user reflète le rôle réel de l'appelant
-- (PostgREST fait SET ROLE authenticated|service_role). is_admin() reste
-- SECURITY DEFINER et fonctionne indépendamment.

create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if (new.role is distinct from old.role
      or new.kyc_status is distinct from old.kyc_status) then
    if current_user not in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
       and not coalesce(public.is_admin(), false) then
      raise exception
        'OXV: la modification de role/kyc_status est réservée aux administrateurs'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$function$;

-- Fonction trigger : EXECUTE par anon/authenticated inutile (Postgres invoque
-- les triggers sans vérifier le privilège EXECUTE de l'appelant). On révoque
-- par hygiène, comme dans la migration de durcissement précédente.
revoke execute on function public.guard_users_privileged_columns() from public, anon, authenticated;

-- `before update of role, kyc_status` : le trigger ne se déclenche que si l'une
-- de ces colonnes figure dans le SET (les updates de profil courants — nom,
-- avatar — ne le déclenchent pas).
drop trigger if exists trg_guard_users_privileged_columns on public.users;
create trigger trg_guard_users_privileged_columns
  before update of role, kyc_status on public.users
  for each row
  execute function public.guard_users_privileged_columns();

-- ============================================================================
-- BLOC 2 — search_path de uuid_or_null (anti-injection, oubli du lot précédent)
-- ============================================================================
-- Fonction IMMUTABLE qui ne fait qu'un cast t::uuid (résolu via pg_catalog,
-- toujours implicitement dans le search_path). Fixer le search_path est sans
-- effet sur le comportement ; ferme juste l'avertissement advisor restant.

alter function public.uuid_or_null(t text) set search_path = public, pg_temp;
