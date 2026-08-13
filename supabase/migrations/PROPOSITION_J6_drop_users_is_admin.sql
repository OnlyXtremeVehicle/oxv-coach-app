-- =============================================================================
-- PROPOSITION — supprimer `public.users.is_admin`
-- =============================================================================
--
-- NON APPLIQUÉE. Elle SUPPRIME une colonne ; c'est irréversible sans
-- restauration, et c'est au fondateur.
--
-- Autorisation reçue le 14/08/2026 : *« sur is_admin, ma vérification du site
-- tient sur les dix branches : la colonne peut être supprimée. »*
--
-- -----------------------------------------------------------------------------
-- POURQUOI ELLE PEUT PARTIR
--
-- `role` fait seule autorité depuis le 28/07/2026. Vérifié :
--
--   • `is_admin()` et `oxv_is_admin()` lisent `role`, jamais la colonne ;
--   • `accesLogic.estAdmin`, côté application, ne lit QUE `role` — le repli
--     `OR is_admin` a été retiré au lot 8 ;
--   • aucune policy, vue, index ni contrainte ne la référence (balayage du
--     14/08 sur `pg_policies`, `pg_views`, `pg_indexes`, `pg_constraint`) ;
--   • le site l'a vérifiée sur ses dix branches.
--
-- -----------------------------------------------------------------------------
-- CE QUI L'AURAIT CASSÉE, ET QUI NE SE VOIT PAS
--
-- **DEUX TRIGGERS SUR `users` LISENT `new.is_admin`.** Un `ALTER TABLE … DROP
-- COLUMN` ne les supprime pas et ne les signale pas : plpgsql ne vérifie ses
-- colonnes qu'à L'EXÉCUTION.
--
--   `trg_guard_users_privileged_columns` → garde role / kyc_status / is_admin
--   `trg_audit_user_is_admin_change`     → journalise les bascules de la colonne
--
-- Les deux sont `BEFORE`/`AFTER UPDATE` sur `public.users`. Supprimer la colonne
-- sans les traiter d'abord ferait échouer **tout UPDATE sur la table** — donc
-- toute édition de profil, tout changement de rôle, tout parcours qui touche un
-- utilisateur — au premier écrit, avec une erreur qui ne dit pas d'où elle
-- vient.
--
-- C'est le même piège que `purge_user_data` cassée par un `DROP TABLE` le 01/08.
-- L'ordre ci-dessous est donc contraignant.
--
-- -----------------------------------------------------------------------------
-- CE QU'ON PERD, ET C'EST VOULU
--
-- `trg_audit_user_is_admin_change` journalisait les bascules de la colonne dans
-- `admin_audit`. Il disparaît avec elle. La garde équivalente sur `role` — la
-- seule qui décide encore d'un accès — reste tenue par
-- `guard_users_privileged_columns`, réécrite ci-dessous sans la clause morte.
--
-- Les lignes déjà écrites dans `admin_audit` ne sont pas touchées.
-- =============================================================================

BEGIN;

-- 1. L'audit de la colonne n'a plus d'objet.
DROP TRIGGER IF EXISTS trg_audit_user_is_admin_change ON public.users;
DROP FUNCTION IF EXISTS public.audit_user_is_admin_change();

-- 2. La garde perd sa clause morte, garde les deux vivantes.
CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- `is_admin` retirée le 14/08/2026 : la colonne n'existe plus, et `role`
  -- faisait seule autorité depuis le 28/07.
  if (new.role is distinct from old.role
      or new.kyc_status is distinct from old.kyc_status) then
    if current_user not in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
       and not coalesce(public.is_admin(), false) then
      raise exception
        'OXV: la modification de role/kyc_status est réservée aux administrateurs'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

-- 3. Et seulement maintenant, la colonne.
ALTER TABLE public.users DROP COLUMN IF EXISTS is_admin;

COMMIT;

-- -----------------------------------------------------------------------------
-- APRÈS APPLICATION — la vérification qui compte
--
-- Un UPDATE quelconque sur `users` doit passer. Si un trigger oublié lisait
-- encore la colonne, il échouerait ICI plutôt qu'au prochain pilote qui édite
-- son profil :
--
--   begin;
--     update public.users set updated_at = now() where id = (select id from public.users limit 1);
--   rollback;
--
-- Puis régénérer les types :
--   npx supabase gen types typescript --project-id fouvuqkdxarjpjbqnsjq > src/types/database.types.ts
-- -----------------------------------------------------------------------------
