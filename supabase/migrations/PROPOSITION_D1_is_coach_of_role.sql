-- ============================================================================
-- PROPOSITION — D-1 : un coach rétrogradé conserve l'accès aux données
-- ============================================================================
--
-- ⚠️  NON APPLIQUÉE. Ce fichier est délibérément nommé `PROPOSITION_` et non
--     horodaté : il n'est PAS ramassé par `supabase db push`. Modifier le schéma
--     de production demande l'accord du fondateur (CLAUDE.md). À renommer en
--     `<timestamp>_d1_is_coach_of_role.sql` le jour où c'est décidé.
--
-- ----------------------------------------------------------------------------
-- LE DÉFAUT, ÉTABLI SUR PIÈCES
-- ----------------------------------------------------------------------------
--
-- `demoteToPilot` (coachAdminService.ts) n'écrivait QUE `users.role = 'pilot'`.
-- Les lignes `coach_pilots` gardaient `active = true`.
--
-- Or `is_coach_of()` vérifie `active = true` et `pilot_consent_at IS NOT NULL`,
-- mais PAS `users.role`. Un compte rétrogradé passait donc toujours le test :
-- il continuait de lire séances, tours et bilans de ses anciens pilotes AU
-- NIVEAU DE LA BASE — la RLS ne s'y opposait pas.
--
-- Correction d'une inexactitude de `docs/DETTE.md` : la fiche D-1 affirmait que
-- `is_coach_of` ne vérifie pas non plus `active`. C'est faux, il le vérifie. Le
-- seul chaînon manquant est `users.role`.
--
-- ----------------------------------------------------------------------------
-- POURQUOI LE CORRECTIF APPLICATIF NE SUFFIT PAS
-- ----------------------------------------------------------------------------
--
-- `demoteToPilot` coupe désormais les affiliations avant de changer le rôle.
-- Cela ferme le chemin NORMAL. Cela ne ferme pas les autres :
--
--   — un `UPDATE users SET role` passé depuis le SQL Editor, un script, ou une
--     future fonction d'administration ;
--   — une suspension de compte qui toucherait le rôle sans penser aux
--     affiliations ;
--   — un rollback partiel laissant les deux tables désaccordées.
--
-- Tant que la RLS ne dépend que de `coach_pilots`, la sécurité repose sur la
-- discipline de CHAQUE écrivain. Ce n'est pas une barrière, c'est une consigne.
--
-- ----------------------------------------------------------------------------
-- CE QUE FAIT CETTE MIGRATION
-- ----------------------------------------------------------------------------
--
-- Ajoute une troisième condition à `is_coach_of` : l'appelant doit ENCORE être
-- `role = 'coach'`. La rétrogradation devient alors suffisante à elle seule, et
-- l'oubli de couper une affiliation cesse d'être exploitable.
--
-- Coût : une jointure sur `users` par appel. La fonction est STABLE, donc
-- évaluée une fois par requête et non par ligne.

CREATE OR REPLACE FUNCTION public.is_coach_of(pilot_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_pilots cp
    JOIN public.users u ON u.id = cp.coach_id
    WHERE cp.coach_id = auth.uid()
      AND cp.pilot_id = pilot_uuid
      AND cp.active = true
      AND cp.pilot_consent_at IS NOT NULL
      -- D-1 : le rôle doit être ENCORE coach. Sans cette ligne, une
      -- rétrogradation ne retire aucun accès tant qu'une affiliation reste
      -- active — et rien n'oblige l'écrivain du rôle à s'en occuper.
      AND u.role = 'coach'
  );
$$;

COMMENT ON FUNCTION public.is_coach_of(UUID) IS
  'Vérifie que auth.uid() est ENCORE coach (users.role), affilié actif et consenti par pilot_uuid. Les trois conditions sont nécessaires : voir D-1.';

REVOKE EXECUTE ON FUNCTION public.is_coach_of(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- RATTRAPAGE DE L'EXISTANT — à décider séparément
-- ----------------------------------------------------------------------------
--
-- Les comptes DÉJÀ rétrogradés gardent des affiliations actives en base. La
-- migration ci-dessus leur retire l'accès immédiatement (le rôle ne colle plus),
-- mais laisse les lignes en l'état.
--
-- Les nettoyer est un geste SÉPARÉ, et destructif au sens où il efface la trace
-- de qui suivait qui. À ne lancer qu'après avoir vérifié combien de lignes sont
-- concernées :
--
--   SELECT count(*)
--   FROM public.coach_pilots cp
--   JOIN public.users u ON u.id = cp.coach_id
--   WHERE cp.active = true AND u.role <> 'coach';
--
-- Puis, si et seulement si le fondateur le décide :
--
--   UPDATE public.coach_pilots cp
--   SET active = false
--   FROM public.users u
--   WHERE u.id = cp.coach_id AND cp.active = true AND u.role <> 'coach';
