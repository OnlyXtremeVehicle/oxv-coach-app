-- ============================================================================
-- Migration 0041 — is_admin() honore le flag booléen users.is_admin
-- ============================================================================
--
-- Contexte : permettre UN compte « admin + coach » simultané
-- (administration@oxvehicle.fr) sans casser le modèle mono-rôle pour tout le
-- monde. Le champ `role` reste unique (pilot | coach | admin) ; on ajoute la
-- possibilité de cumuler l'accès admin via le booléen `users.is_admin`, déjà
-- présent dans le schéma et à `false` partout aujourd'hui.
--
-- Avant : is_admin() = (role = 'admin')
-- Après : is_admin() = (role = 'admin' OR is_admin = true)
--
-- Sûreté :
--   - Aucun compte n'a is_admin=true au moment de cette migration (vérifié) ;
--     le comportement est donc identique pour tous les comptes existants.
--   - Seuls les comptes explicitement flaggés is_admin=true gagnent l'accès
--     admin (en plus de leur rôle). Les autres restent inchangés.
--   - SECURITY DEFINER + search_path préservés à l'identique.
--
-- Cette fonction est utilisée par les RLS admin (app ET site, base partagée).
-- Changement validé explicitement par Gabin (2026-06-17).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT role = 'admin' OR is_admin = true FROM public.users WHERE id = auth.uid()),
    false
  );
$function$;
