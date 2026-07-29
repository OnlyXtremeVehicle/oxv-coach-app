-- ============================================================================
-- D-1 : un coach rétrogradé conservait l'accès aux données de ses anciens pilotes
-- ============================================================================
--
-- APPLIQUÉE EN PRODUCTION le 29/07/2026, sur accord du fondateur.
--
-- ----------------------------------------------------------------------------
-- LE DÉFAUT
-- ----------------------------------------------------------------------------
--
-- `is_coach_of()` vérifiait l'affiliation active et le consentement du pilote,
-- mais PAS `users.role`. Or `demoteToPilot` n'écrivait que le rôle : les lignes
-- `coach_pilots` restaient à `active = true`.
--
-- Un compte rétrogradé passait donc toujours le test, et continuait de lire
-- séances, tours, télémétrie et bilans de ses anciens pilotes AU NIVEAU DE LA
-- BASE. La RLS ne s'y opposait pas.
--
-- ----------------------------------------------------------------------------
-- CE QUE J'AI TROUVÉ EN APPLIQUANT — LA FAILLE ÉTAIT OCCUPÉE
-- ----------------------------------------------------------------------------
--
--   affiliations totales ................................. 1
--   actives dont le compte n'est plus « coach » .......... 1
--   comptes portant role = 'coach' ....................... 0
--
-- Autrement dit : la seule affiliation de la base donnait un accès de coach à
-- un compte qui n'en était pas un, et aucun coach n'existait pour le
-- légitimer. Très probablement le compte fondateur passé en `partner` — mais le
-- mécanisme ne fait pas la différence, et c'est bien le problème.
--
-- L'application de cette migration a coupé cet accès immédiatement.
--
-- ----------------------------------------------------------------------------
-- LE RATTRAPAGE, QUI N'EST PAS FAIT
-- ----------------------------------------------------------------------------
--
-- Les lignes `coach_pilots` restent en l'état : le rôle ne colle plus, donc
-- l'accès est fermé, mais la trace de qui suivait qui subsiste. La nettoyer est
-- un geste SÉPARÉ et destructif — il efface cette trace — et il demande sa
-- propre décision.
-- ============================================================================

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
