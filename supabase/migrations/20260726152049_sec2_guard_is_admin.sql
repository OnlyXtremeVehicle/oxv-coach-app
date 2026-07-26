-- ============================================================================
-- SEC-2 — Fermer l'élévation de privilège sur users.is_admin
--
-- APPLIQUÉE EN PRODUCTION le 26/07/2026 à 15:20:49 UTC, sur accord explicite du fondateur.
-- Les instructions exécutées sont celles de ce fichier ; seuls l'en-tête
-- explicatif et le protocole de vérification en fin de fichier n'en font pas
-- partie. Le texte exact exécuté est conservé dans
-- supabase_migrations.schema_migrations. Le déplacer dans supabase/migrations/ vaut
-- décision de l'appliquer.
--
-- LE DÉFAUT, vérifié en production le 26/07/2026
-- ---------------------------------------------------------------------------
-- 1. `authenticated` détient le privilège UPDATE sur la colonne
--    `public.users.is_admin`.
-- 2. La seule policy UPDATE de la table, `users_update_own_or_admin`, autorise
--    `(id = auth.uid()) OR is_admin()` : un utilisateur peut donc écrire sa
--    propre ligne.
-- 3. Le déclencheur de garde `guard_users_privileged_columns` ne protège que
--    `role` et `kyc_status`. La colonne `is_admin` n'y figure pas.
-- 4. Or `public.is_admin()` retourne vrai sur `role = 'admin' OR is_admin`.
--
-- Conséquence : n'importe quel compte authentifié peut exécuter
--   update public.users set is_admin = true where id = auth.uid();
-- et devenir administrateur au sens de la base — ce qui ouvre toutes les
-- policies gardées par `is_admin()`. Aucun audit ne le tracerait : le
-- déclencheur `trg_audit_user_role_change` n'observe que `role`.
--
-- CE QUE FAIT CE CORRECTIF
-- ---------------------------------------------------------------------------
-- Il étend la garde existante à `is_admin`, sans rien changer d'autre : même
-- fonction, même liste de rôles techniques autorisés, même code d'erreur. Un
-- administrateur véritable et le service_role gardent la main ; le propriétaire
-- de la ligne la perd. Il ajoute par ailleurs la trace d'audit qui manquait.
--
-- Purement restrictif. Aucune donnée modifiée. Réversible en restaurant la
-- version précédente de la fonction.
-- ============================================================================

begin;

create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- `is_admin` rejoint `role` et `kyc_status` : ce sont les trois colonnes qui
  -- décident de ce qu'un compte a le droit de lire et d'écrire.
  if (new.role is distinct from old.role
      or new.kyc_status is distinct from old.kyc_status
      or new.is_admin is distinct from old.is_admin) then
    if current_user not in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
       and not coalesce(public.is_admin(), false) then
      raise exception
        'OXV: la modification de role/kyc_status/is_admin est réservée aux administrateurs'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

comment on function public.guard_users_privileged_columns() is
  'Empêche un compte de modifier lui-même role, kyc_status ou is_admin. '
  'is_admin ajouté le 26/07/2026 : sans lui, tout compte authentifié pouvait '
  'se déclarer administrateur sur sa propre ligne.';

-- Trace d'audit sur is_admin : le déclencheur existant n'observe que `role`,
-- donc une élévation par is_admin ne laissait aucune trace.
create or replace function public.audit_user_is_admin_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Colonnes réelles de public.admin_audit, relevées en production le
  -- 26/07/2026 : id, user_id, action, ip_address, user_agent, metadata,
  -- created_at. L'auteur du changement va dans user_id ; la cible et les
  -- valeurs vont dans metadata.
  if new.is_admin is distinct from old.is_admin then
    insert into public.admin_audit (user_id, action, metadata)
    values (
      auth.uid(),
      'user_is_admin_change',
      jsonb_build_object(
        'cible', new.id,
        'avant', old.is_admin,
        'apres', new.is_admin
      )
    );
  end if;
  return new;
end;
$function$;

revoke execute on function public.audit_user_is_admin_change() from public, anon, authenticated;

drop trigger if exists trg_audit_user_is_admin_change on public.users;
create trigger trg_audit_user_is_admin_change
  after update on public.users
  for each row
  execute function public.audit_user_is_admin_change();

commit;

-- ============================================================================
-- VÉRIFICATION APRÈS APPLICATION
-- ============================================================================
-- 1. La garde couvre bien la colonne :
--      select pg_get_functiondef('public.guard_users_privileged_columns'::regproc)
--      ilike '%is_admin is distinct from%';
--    doit renvoyer true.
--
-- 2. Essai réel, depuis une session `authenticated` NON administratrice :
--      update public.users set is_admin = true where id = auth.uid();
--    doit échouer avec 42501.
--
-- 3. AVANT d'appliquer, relever qui porte déjà le drapeau — le correctif ferme
--    la porte, il ne referme pas ce qui est déjà passé :
--      select id, email, role, is_admin from public.users where is_admin is true;
--    Relevé du 26/07/2026 : UNE seule ligne, administration@oxvehicle.fr, avec
--    role = 'pilot'. Le drapeau n'a donc pas été utilisé au-delà de votre propre
--    compte. Si d'autres lignes apparaissent d'ici l'application, elles
--    demandent une explication avant d'aller plus loin.
--
--    À noter : les deux comptes role = 'admin' portent is_admin = false. Ils
--    sont administrateurs au sens de la base — is_admin() teste
--    role = 'admin' OR is_admin — mais BLOQUÉS dans l'application, dont la
--    garde app/(admin)/_layout.tsx ne teste que is_admin. Ce désaccord entre
--    le client et le serveur est un sujet distinct, à trancher séparément.
-- ============================================================================
